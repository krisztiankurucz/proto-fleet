import { useMemo } from "react";
import type { AsicData, FanData, HashboardData, HashboardTelemetryData, MinerData, PsuData } from "../types";
import useMinerStore from "../useMinerStore";
import { aggregateLiveTail } from "./aggregateLiveTail";
import type { AsicData as AsicTableData } from "@/shared/components/AsicTablePreview";
import { getDurationMs } from "@/shared/components/DurationSelector";
import type { ChartData } from "@/shared/components/LineChart";
import { buildSmoothedLiveSeries } from "@/shared/components/LineChart/smoothing";
import { useSegmentDrawProgress } from "@/shared/hooks/useSegmentDrawProgress";

// How long the leading "1m" segment takes to draw from the previous point to
// the newest one. Matched to the ~1s sample cadence so the pen reaches the new
// value as the next sample lands — continuous draw, no settle pause. (Dropping
// this slightly below the cadence, e.g. 950, trades a tiny settle pause for
// removing the ~1-frame sub-pixel snap at the boundary if that ever shows.)
const SEGMENT_DRAW_MS = 1000;
// Keep extra committed samples beyond the visible window's left edge so old
// points scroll off and get clipped cleanly, and are only dropped from the data
// well off-screen. Too small a pad drops the oldest point while the smoothing's
// new leftmost segment is still at the visible edge — dropping it re-bends that
// segment (Catmull-Rom depends on neighbours), which looks like a point popping
// out. Must comfortably exceed the tip's animation lag (~1s) plus the smoothing
// reach (~1 segment).
const WINDOW_LEFT_PAD_MS = 5000;

// =============================================================================
// Miner Convenience Hooks (combining hardware + telemetry slices)
// =============================================================================

/**
 * Get combined miner data combining hardware info + telemetry
 */
export const useMiner = (): MinerData | null => {
  const hardware = useMinerStore((state) => state.hardware.miner);
  const telemetry = useMinerStore((state) => state.telemetry.miner);

  return useMemo(() => {
    if (!hardware || !telemetry) return null;

    return {
      ...hardware,
      ...telemetry,
    };
  }, [hardware, telemetry]);
};

/**
 * Get combined hashboard data combining hardware info + telemetry
 */
export const useMinerHashboard = (serial: string | null): HashboardData | null => {
  const hardware = useMinerStore((state) => (serial ? state.hardware.getHashboard(serial) : null));
  const telemetry = useMinerStore((state) => (serial ? state.telemetry.hashboards.get(serial) : undefined));

  return useMemo(() => {
    if (!serial || !hardware) return null;

    return {
      ...hardware,
      ...telemetry,
    };
  }, [serial, hardware, telemetry]);
};

/**
 * Get all combined hashboards for the miner
 */
export const useMinerHashboards = (): HashboardData[] => {
  const hardwareHashboards = useMinerStore((state) => state.hardware.hashboards);
  const telemetryHashboards = useMinerStore((state) => state.telemetry.hashboards);

  return useMemo(() => {
    const hashboards = Array.from(hardwareHashboards.values());

    return hashboards.map((hardware) => {
      const telemetry = telemetryHashboards.get(hardware.serial);

      return {
        ...hardware,
        ...telemetry,
      };
    });
  }, [hardwareHashboards, telemetryHashboards]);
};

/**
 * Get combined ASIC data combining hardware info + telemetry
 */
export const useMinerAsic = (asicId: string): AsicData | null => {
  const hardware = useMinerStore((state) => state.hardware.getAsic(asicId));
  const telemetry = useMinerStore((state) => state.telemetry.asics.get(asicId));

  return useMemo(() => {
    if (!hardware) return null;

    return {
      ...hardware,
      ...telemetry,
    };
  }, [hardware, telemetry]);
};

/**
 * Get all combined ASICs for a specific hashboard
 */
export const useMinerHashboardAsics = (hashboardSerial: string): AsicData[] => {
  const hashboard = useMinerStore((state) => state.hardware.getHashboard(hashboardSerial));
  const allAsics = useMinerStore((state) => state.hardware.asics);
  const telemetryData = useMinerStore((state) => state.telemetry.asics);

  return useMemo(() => {
    if (!hashboard || !hashboard.asicIds) return [];

    return hashboard.asicIds.reduce<AsicData[]>((acc, asicId) => {
      const hardware = allAsics.get(asicId);
      if (!hardware) return acc;

      const telemetry = telemetryData.get(asicId);

      acc.push({
        ...hardware,
        ...telemetry,
      });

      return acc;
    }, []);
  }, [hashboard, allAsics, telemetryData]);
};

/**
 * Get combined PSU data combining hardware info + telemetry
 */
export const useMinerPsu = (id: number): PsuData | null => {
  const hardware = useMinerStore((state) => state.hardware.psus.get(id));
  const telemetry = useMinerStore((state) => state.telemetry.psus.get(id));

  return useMemo(() => {
    if (!hardware) return null;

    return {
      ...hardware,
      ...telemetry,
    };
  }, [hardware, telemetry]);
};

/**
 * Get all combined PSUs for the miner
 */
export const useMinerPsus = (): PsuData[] => {
  const hardwarePsus = useMinerStore((state) => state.hardware.psus);
  const telemetryPsus = useMinerStore((state) => state.telemetry.psus);

  return useMemo(() => {
    const psus = Array.from(hardwarePsus.values());

    return psus.map((hardware) => {
      const telemetry = telemetryPsus.get(hardware.id);

      return {
        ...hardware,
        ...telemetry,
      };
    });
  }, [hardwarePsus, telemetryPsus]);
};

/**
 * Get combined Fan data combining hardware info + telemetry
 */
export const useMinerFan = (id: number): FanData | null => {
  const hardware = useMinerStore((state) => state.hardware.fans.get(id));
  const telemetry = useMinerStore((state) => state.telemetry.fans.get(id));

  return useMemo(() => {
    if (!hardware) return null;

    return {
      ...hardware,
      ...telemetry,
    };
  }, [hardware, telemetry]);
};

/**
 * Get all combined Fans for the miner
 */
export const useMinerFans = (): FanData[] => {
  const hardwareFans = useMinerStore((state) => state.hardware.fans);
  const telemetryFans = useMinerStore((state) => state.telemetry.fans);

  return useMemo(() => {
    const fans = Array.from(hardwareFans.values());

    return fans.map((hardware) => {
      const telemetry = telemetryFans.get(hardware.slot);

      return {
        ...hardware,
        ...telemetry,
      };
    });
  }, [hardwareFans, telemetryFans]);
};

// =============================================================================
// Chart Data Hooks
// =============================================================================

/**
 * Main chart data hook that combines miner and hashboard data for a specific metric
 * Transforms telemetry store data into chart-ready format
 */
export const useChartDataForMetric = (
  metricName: "hashrate" | "temperature" | "power" | "efficiency",
): { chartData: ChartData[]; chartLines: string[]; xAxisDomain?: [number, number] } => {
  // Select primitive values and lastUpdated to trigger re-render when data clears
  const miner = useMinerStore((state) => state.telemetry.miner);
  const hashboardsTelemetry = useMinerStore((state) => state.telemetry.hashboards);
  const hashboardsHardware = useMinerStore((state) => state.hardware.hashboards);
  const intervalMs = useMinerStore((state) => state.telemetry.intervalMs);
  const duration = useMinerStore((state) => state.ui.duration);

  // Newest live sample time for this metric — changes once per sample (~1Hz) and
  // (re)triggers the leading-segment draw animation for the "1m" view only.
  const liveTipTime = useMinerStore((state) => {
    const tail = state.telemetry.miner?.[metricName]?.timeSeries?.liveTail;
    return tail && tail.length ? tail[tail.length - 1].datetime : undefined;
  });
  const drawProgress = useSegmentDrawProgress(liveTipTime, SEGMENT_DRAW_MS, duration === "1m");

  return useMemo(() => {
    if (!miner) return { chartData: [], chartLines: [] };

    const minerMetric = miner[metricName]?.timeSeries;
    const hasHistorical = !!minerMetric?.values.length;
    const hasLiveTail = !!minerMetric?.liveTail?.length;
    if (!hasHistorical && !hasLiveTail) return { chartData: [], chartLines: [] };

    // Get hashboards associated with this miner
    const minerHashboards = miner.hashboards
      .map((id) => hashboardsTelemetry.get(id))
      .filter(Boolean) as HashboardTelemetryData[];

    // Sort hashboards by slot using hardware slice
    const sortedMinerHashboards = minerHashboards.sort((a, b) => {
      const slotA = hashboardsHardware.get(a.serial)?.slot;
      const slotB = hashboardsHardware.get(b.serial)?.slot;
      return (slotA ?? 0) - (slotB ?? 0);
    });

    // Generate chart lines (keys that will be in the data)
    const chartLines = ["miner", ...sortedMinerHashboards.map((hb) => hb.serial)];

    const durationMs = getDurationMs(duration);

    // "1m" is a sliding 60s window of live-tail-only data. Hashboard tails are
    // joined to miner samples by datetime (positional indexing is unsafe once
    // we filter the array).
    if (duration === "1m") {
      const minerTail = minerMetric!.liveTail ?? [];
      if (!minerTail.length) return { chartData: [], chartLines };

      const realEnd = minerTail[minerTail.length - 1].datetime;
      const filterStart = realEnd - durationMs - WINDOW_LEFT_PAD_MS;

      const hashboardTailMaps = new Map<string, Map<number, number>>();
      sortedMinerHashboards.forEach((hb) => {
        const tail = hb[metricName]?.timeSeries?.liveTail;
        if (!tail?.length) return;
        const lookup = new Map<number, number>();
        for (const p of tail) lookup.set(p.datetime, p.value);
        hashboardTailMaps.set(hb.serial, lookup);
      });

      const controlRows: ChartData[] = [];
      for (const p of minerTail) {
        if (p.datetime < filterStart) continue;
        const row: ChartData = { datetime: p.datetime, miner: p.value };
        hashboardTailMaps.forEach((lookup, serial) => {
          const v = lookup.get(p.datetime);
          if (v !== undefined) row[serial] = v;
        });
        controlRows.push(row);
      }

      // Smooth the committed samples into a dense curve and reveal the newest
      // segment by drawProgress, so the leading edge animates in. The curve is
      // derived only from committed points, so the settled line stays put as the
      // tip advances (no whole-section reshaping).
      const chartData = buildSmoothedLiveSeries(controlRows, chartLines, drawProgress);
      const windowEnd = chartData.length ? chartData[chartData.length - 1].datetime : realEnd;
      const xAxisDomain: [number, number] = [windowEnd - durationMs, windowEnd];
      return { chartData, chartLines, xAxisDomain };
    }

    // The server's most recent bucket(s) often come back null (the current
    // interval isn't aggregated yet). Find the last real sample so we can drop
    // those trailing nulls and let the live tail fill right up to it — otherwise
    // the null region between real history and the live data renders as a gap.
    let lastRealIndex = -1;
    for (let i = minerMetric!.values.length - 1; i >= 0; i--) {
      if (typeof minerMetric!.values[i] === "number") {
        lastRealIndex = i;
        break;
      }
    }

    // Historical points: uniformly spaced by intervalMs starting at startTime,
    // up to the last real sample (trailing nulls dropped).
    const chartData: ChartData[] = [];
    for (let index = 0; index <= lastRealIndex; index++) {
      const dataPoint: ChartData = {
        datetime: minerMetric!.startTime + index * intervalMs,
        miner: minerMetric!.values[index],
      };

      sortedMinerHashboards.forEach((hashboard) => {
        const hashboardValues = hashboard[metricName]?.timeSeries?.values;
        if (hashboardValues && hashboardValues.length > index) {
          dataPoint[hashboard.serial] = hashboardValues[index];
        }
      });

      chartData.push(dataPoint);
    }

    // Live tail: aggregate NATS samples to the view's interval (mean), matching
    // the historical series, so the live tip is as smooth as the rest of the line
    // instead of jittery raw 1s samples. Anchored to the last real historical
    // point so it fills the gap left by trailing nulls / server aggregation lag.
    if (minerMetric?.liveTail?.length) {
      const hashboardTails = new Map<string, { datetime: number; value: number }[]>();
      sortedMinerHashboards.forEach((hb) => {
        const tail = hb[metricName]?.timeSeries?.liveTail;
        if (tail?.length) hashboardTails.set(hb.serial, tail);
      });

      const afterTime = lastRealIndex >= 0 ? minerMetric.startTime + lastRealIndex * intervalMs : -Infinity;
      const aggregated = aggregateLiveTail(
        minerMetric.liveTail,
        hashboardTails,
        minerMetric.startTime,
        intervalMs,
        afterTime,
      );
      for (const row of aggregated) chartData.push(row);
    }

    // Anchor the X-axis to the data's startTime and extend by the exact
    // selected duration; if the live tail extends beyond that, expand the domain
    // so the latest live points stay visible on the right edge.
    // minerMetric is non-null here — the early return above guarantees that hasHistorical || hasLiveTail.
    const ts = minerMetric!;
    const historicalStart = ts.startTime;
    const lastLive = ts.liveTail?.[ts.liveTail.length - 1]?.datetime;
    const naturalEnd = historicalStart + durationMs;
    const xAxisDomain: [number, number] = [historicalStart, Math.max(naturalEnd, lastLive ?? naturalEnd)];

    return { chartData, chartLines, xAxisDomain };
  }, [miner, hashboardsTelemetry, hashboardsHardware, intervalMs, metricName, duration, drawProgress]);
};

// =============================================================================
// Data Transformation Hooks
// =============================================================================

/**
 * Transforms ProtoOS ASIC data to the shared AsicData format used by AsicTablePreview component.
 *
 * This hook provides a consistent way to transform the store's ASIC data structure
 * (which includes hardware and telemetry information) into the simplified format
 * expected by the shared AsicTablePreview component.
 *
 * @param asics - Array of ProtoOS ASIC data from the store
 * @returns Array of AsicData formatted for AsicTablePreview component
 *
 * @example
 * ```typescript
 * const asics = useMinerHashboardAsics(serialNumber);
 * const asicData = useAsicDataTransform(asics);
 *
 * return <AsicTablePreview asics={asicData} />;
 * ```
 */
export const useAsicDataTransform = (asics: AsicData[] | undefined | null): AsicTableData[] => {
  return useMemo((): AsicTableData[] => {
    if (!asics || asics.length === 0) return [];

    return asics
      .filter((asic) => asic.row !== undefined && asic.column !== undefined)
      .map((asic) => ({
        row: asic.row!,
        col: asic.column!,
        value: asic.temperature?.latest?.value ?? null,
      }));
  }, [asics]);
};

import type { HashboardOperatingStats } from "@/protoOS/api/generated/nats/miner_hb_api_pb";

export interface StreamingMetrics {
  hashrateThs: number;
  powerW: number;
  efficiencyJTh: number;
  temperatureC: number;
}

export interface StreamingPoint {
  datetime: number;
  miner: StreamingMetrics;
  hashboards: Map<number, StreamingMetrics>;
}

export interface StreamingSourceState {
  hashboardStats: Map<number, HashboardOperatingStats>;
  psuInputPowerW: Map<number, number>;
}

function hashboardMetricsFromStats(stats: HashboardOperatingStats): StreamingMetrics {
  return {
    hashrateThs: stats.boardHashrate,
    powerW: stats.boardPower,
    efficiencyJTh: stats.boardEfficiency,
    // Use the AVERAGE board temperature so the live tip matches the recorded /
    // historical miner temp (firmware telemetry temperature_c is an average).
    // boardTemps.max is the hottest chip and would read far higher than history.
    temperatureC: stats.boardTemps?.average ?? stats.boardTemps?.max ?? 0,
  };
}

/**
 * Aggregate the latest per-hashboard + per-PSU snapshot into a single chart point.
 * Returns null when no hashboard data has arrived yet.
 *
 * Miner-level metrics:
 *   hashrate    = Σ boardHashrate (across hashboards)
 *   power       = Σ PSU INPUT_POWER (wall power); falls back to Σ boardPower when no PSU data
 *   temperature = mean(boardTemps.average) across reporting hashboards (matches
 *                 the recorded average miner temp; boards with no temp are skipped)
 *   efficiency  = power / hashrate (J/TH)
 */
export function aggregateStreamingPoint(state: StreamingSourceState, now: number): StreamingPoint | null {
  if (state.hashboardStats.size === 0) return null;

  const hashboards = new Map<number, StreamingMetrics>();
  let totalHashrate = 0;
  let totalBoardPower = 0;
  let totalTemp = 0;
  let tempCount = 0;

  state.hashboardStats.forEach((stats, slot) => {
    const m = hashboardMetricsFromStats(stats);
    hashboards.set(slot, m);
    totalHashrate += m.hashrateThs;
    totalBoardPower += m.powerW;
    // Skip boards with no temperature reported (0) so they don't drag the mean down.
    if (m.temperatureC > 0) {
      totalTemp += m.temperatureC;
      tempCount += 1;
    }
  });

  let totalPsuPower = 0;
  state.psuInputPowerW.forEach((w) => {
    totalPsuPower += w;
  });

  const powerW = totalPsuPower > 0 ? totalPsuPower : totalBoardPower;
  const efficiencyJTh = totalHashrate > 0 ? powerW / totalHashrate : 0;
  const temperatureC = tempCount > 0 ? totalTemp / tempCount : 0;

  return {
    datetime: now,
    miner: {
      hashrateThs: totalHashrate,
      powerW,
      efficiencyJTh,
      temperatureC,
    },
    hashboards,
  };
}

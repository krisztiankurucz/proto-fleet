import { useEffect, useMemo, useRef } from "react";
import type { Subscription } from "@nats-io/nats-core";

import { TOTAL_FAN_SLOTS } from "@/protoOS/api/constants";
import type {
  AsicOperatingStats,
  FanData,
  HashboardOperatingStats,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import type { PsuMeasurements } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PsuMeasurementType } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PSU_COUNT } from "@/protoOS/features/devConsole/constants";
import { scaleMetricValue } from "@/protoOS/features/kpis/streaming/units";
import {
  subscribeFanData,
  subscribeHashboardAsicStats,
  subscribeHashboardOperatingStats,
  subscribePsuMeasurements,
  useNatsConnection,
} from "@/protoOS/nats";
import {
  type DiagnosticsStreamHashboard,
  type DiagnosticsStreamPayload,
  type DiagnosticsStreamPsu,
  useMinerStore,
} from "@/protoOS/store";

const STREAMING_EMIT_INTERVAL_MS = 1000;

/**
 * Subscribes to per-hashboard / per-PSU / per-fan NATS subjects and pushes a
 * batched diagnostics snapshot into the telemetry store every
 * STREAMING_EMIT_INTERVAL_MS, decoupling chart cadence from the firmware's
 * per-component publish pattern.
 */
export function useStreamingDiagnostics(): void {
  const { connection, state } = useNatsConnection();
  const applyDiagnosticsStream = useMinerStore((s) => s.telemetry.applyDiagnosticsStream);
  const hashboardsHardware = useMinerStore((s) => s.hardware.hashboards);

  const slotToSerial = useMemo(() => {
    const map = new Map<number, string>();
    hashboardsHardware.forEach((hb, serial) => {
      if (hb.slot !== undefined) map.set(hb.slot, serial);
    });
    return map;
  }, [hashboardsHardware]);

  const slotsKey = useMemo(
    () =>
      Array.from(slotToSerial.keys())
        .sort((a, b) => a - b)
        .join(","),
    [slotToSerial],
  );

  const hbOperatingRef = useRef<Map<number, HashboardOperatingStats>>(new Map());
  const hbAsicRef = useRef<Map<number, AsicOperatingStats>>(new Map());
  const psuRef = useRef<Map<number, PsuMeasurements>>(new Map());
  const fanRef = useRef<Map<number, FanData>>(new Map());
  const slotToSerialRef = useRef(slotToSerial);
  slotToSerialRef.current = slotToSerial;

  useEffect(() => {
    if (state !== "connected" || !connection) return;

    const subs: Subscription[] = [];

    for (const slot of slotToSerialRef.current.keys()) {
      subs.push(
        subscribeHashboardOperatingStats(connection, slot, (msg) => {
          hbOperatingRef.current.set(slot, msg);
        }),
        subscribeHashboardAsicStats(connection, slot, (msg) => {
          hbAsicRef.current.set(slot, msg);
        }),
      );
    }

    for (let psuId = 1; psuId <= PSU_COUNT; psuId++) {
      subs.push(
        subscribePsuMeasurements(connection, psuId, (msg) => {
          psuRef.current.set(psuId, msg);
        }),
      );
    }

    for (let fanId = 1; fanId <= TOTAL_FAN_SLOTS; fanId++) {
      subs.push(
        subscribeFanData(connection, fanId, (msg) => {
          fanRef.current.set(fanId, msg);
        }),
      );
    }

    const emit = () => {
      const payload: DiagnosticsStreamPayload = {
        datetime: Date.now(),
        hashboards: new Map(),
        psus: new Map(),
        fans: new Map(),
      };

      hbOperatingRef.current.forEach((stats, slot) => {
        const serial = slotToSerialRef.current.get(slot);
        if (!serial) return;
        const entry: DiagnosticsStreamHashboard = {
          hashrate: stats.boardHashrate,
          power: stats.boardPower,
          efficiency: stats.boardEfficiency,
          boardTempAvg: stats.boardTemps?.average,
          boardTempMin: stats.boardTemps?.min,
          boardTempMax: stats.boardTemps?.max,
          boardTempInlet: stats.boardTemps?.inletFront,
          boardTempOutlet: stats.boardTemps?.outletRear,
        };
        const asicMsg = hbAsicRef.current.get(slot);
        if (asicMsg && asicMsg.asicStats.length > 0) {
          entry.asics = asicMsg.asicStats.map((a, index) => ({
            index,
            temperature: a.temperature,
            hashRate: a.hashRate,
            voltage: a.voltage,
            frequency: a.frequency,
          }));
        }
        payload.hashboards.set(serial, entry);
      });

      psuRef.current.forEach((msg, psuId) => {
        const entry: DiagnosticsStreamPsu = {};
        for (const m of msg.measurements) {
          const scaled = scaleMetricValue(m.value, m.unit);
          switch (m.measurementType) {
            case PsuMeasurementType.INPUT_VOLTAGE:
              entry.inputVoltage = scaled;
              break;
            case PsuMeasurementType.OUTPUT_VOLTAGE:
              entry.outputVoltage = scaled;
              break;
            case PsuMeasurementType.INPUT_CURRENT:
              entry.inputCurrent = scaled;
              break;
            case PsuMeasurementType.OUTPUT_CURRENT:
              entry.outputCurrent = scaled;
              break;
            case PsuMeasurementType.INPUT_POWER:
              entry.inputPower = scaled;
              break;
            case PsuMeasurementType.OUTPUT_POWER:
              entry.outputPower = scaled;
              break;
            case PsuMeasurementType.AVERAGE_TEMPERATURE:
              entry.temperatureAverage = scaled;
              break;
            case PsuMeasurementType.HOTSPOT_TEMPERATURE:
              entry.temperatureHotspot = scaled;
              break;
            case PsuMeasurementType.AMBIENT_TEMPERATURE:
              entry.temperatureAmbient = scaled;
              break;
          }
        }
        payload.psus.set(psuId, entry);
      });

      fanRef.current.forEach((data, slot) => {
        payload.fans.set(slot, { rpm: data.fanRpm, connected: data.connected });
      });

      if (payload.hashboards.size === 0 && payload.psus.size === 0 && payload.fans.size === 0) return;
      applyDiagnosticsStream(payload);
    };

    const intervalId = window.setInterval(emit, STREAMING_EMIT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const sub of subs) {
        sub.unsubscribe();
      }
    };
  }, [connection, state, slotsKey, applyDiagnosticsStream]);
}

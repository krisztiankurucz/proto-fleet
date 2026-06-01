import { useEffect, useMemo, useRef } from "react";
import type { Subscription } from "@nats-io/nats-core";

import { aggregateStreamingPoint } from "./aggregator";
import { scaleMetricValue } from "./units";
import type { HashboardOperatingStats } from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import { PsuMeasurementType } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PSU_COUNT } from "@/protoOS/features/devConsole/constants";
import { subscribeHashboardOperatingStats, subscribePsuMeasurements, useNatsConnection } from "@/protoOS/nats";
import { type StreamingMetricValues, type StreamingPointPayload, useMinerStore } from "@/protoOS/store";

const STREAMING_EMIT_INTERVAL_MS = 1000;

/**
 * Subscribes to per-hashboard operating stats and per-PSU measurements over NATS,
 * keeping the latest values in refs. A fixed-rate timer aggregates and appends one
 * chart sample every STREAMING_EMIT_INTERVAL_MS, decoupling chart cadence from the
 * firmware's per-board publish pattern.
 *
 * Re-subscribes whenever the set of known hashboard slots changes.
 */
export function useStreamingTelemetry(): void {
  const { connection, state } = useNatsConnection();
  const appendStreamingPoint = useMinerStore((s) => s.telemetry.appendStreamingPoint);
  const hashboardsHardware = useMinerStore((s) => s.hardware.hashboards);

  const slotToSerial = useMemo(() => {
    const map = new Map<number, string>();
    hashboardsHardware.forEach((hb, serial) => {
      if (hb.slot !== undefined) map.set(hb.slot, serial);
    });
    return map;
  }, [hashboardsHardware]);

  // Stable key so subscriptions don't churn unless the slot set actually changes.
  const slotsKey = useMemo(
    () =>
      Array.from(slotToSerial.keys())
        .sort((a, b) => a - b)
        .join(","),
    [slotToSerial],
  );

  const hashboardStatsRef = useRef<Map<number, HashboardOperatingStats>>(new Map());
  const psuInputPowerWRef = useRef<Map<number, number>>(new Map());
  const slotToSerialRef = useRef(slotToSerial);
  slotToSerialRef.current = slotToSerial;

  useEffect(() => {
    if (state !== "connected" || !connection) return;
    if (slotToSerialRef.current.size === 0) return;

    const subs: Subscription[] = [];

    const emit = () => {
      const hashboardStats = hashboardStatsRef.current;
      if (hashboardStats.size === 0) return;

      const point = aggregateStreamingPoint({ hashboardStats, psuInputPowerW: psuInputPowerWRef.current }, Date.now());
      if (!point) return;

      const hashboardsBySerial = new Map<string, StreamingMetricValues>();
      point.hashboards.forEach((metrics, slot) => {
        const serial = slotToSerialRef.current.get(slot);
        if (!serial) return;
        hashboardsBySerial.set(serial, {
          hashrate: metrics.hashrateThs,
          power: metrics.powerW,
          efficiency: metrics.efficiencyJTh,
          temperature: metrics.temperatureC,
        });
      });

      const payload: StreamingPointPayload = {
        datetime: point.datetime,
        miner: {
          hashrate: point.miner.hashrateThs,
          power: point.miner.powerW,
          efficiency: point.miner.efficiencyJTh,
          temperature: point.miner.temperatureC,
        },
        hashboards: hashboardsBySerial,
      };
      appendStreamingPoint(payload);
    };

    for (const slot of slotToSerialRef.current.keys()) {
      subs.push(
        subscribeHashboardOperatingStats(connection, slot, (msg) => {
          hashboardStatsRef.current.set(slot, msg);
        }),
      );
    }

    for (let psuId = 1; psuId <= PSU_COUNT; psuId++) {
      subs.push(
        subscribePsuMeasurements(connection, psuId, (msg) => {
          const inputPower = msg.measurements.find((m) => m.measurementType === PsuMeasurementType.INPUT_POWER);
          if (inputPower) {
            psuInputPowerWRef.current.set(psuId, scaleMetricValue(inputPower.value, inputPower.unit));
          }
        }),
      );
    }

    const intervalId = window.setInterval(emit, STREAMING_EMIT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const sub of subs) {
        sub.unsubscribe();
      }
      // Don't clear refs — keep last-known values around if we re-subscribe.
    };
  }, [connection, state, slotsKey, appendStreamingPoint]);
}

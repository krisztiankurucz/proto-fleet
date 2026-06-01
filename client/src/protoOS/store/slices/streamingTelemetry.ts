import type { Measurement, MetricTelemetry, MetricTimeSeries, MetricUnit } from "../types";

export const LIVE_TAIL_MAX_ENTRIES = 1000;

export const STREAMABLE_METRICS = ["hashrate", "power", "efficiency", "temperature"] as const;
export type StreamableMetric = (typeof STREAMABLE_METRICS)[number];

export const DEFAULT_STREAMING_UNITS: Record<StreamableMetric, MetricUnit> = {
  hashrate: "TH/s",
  power: "W",
  efficiency: "J/TH",
  temperature: "C",
};

export interface StreamingMetricValues {
  hashrate: number;
  power: number;
  efficiency: number;
  temperature: number;
}

export interface StreamingPointPayload {
  datetime: number;
  miner: StreamingMetricValues;
  hashboards: Map<string, StreamingMetricValues>;
}

const createMeasurement = (value: number | null, units: MetricUnit | undefined): Measurement => ({
  value,
  units,
});

/**
 * Append a streaming sample onto a metric's live tail and refresh its aggregates.
 * Mutates `metric` in place (called inside an Immer `set`).
 */
export function appendLiveSample(
  metric: MetricTelemetry,
  datetime: number,
  value: number,
  defaultUnit: MetricUnit,
): void {
  if (!metric.timeSeries) {
    metric.timeSeries = {
      units: defaultUnit,
      values: [],
      startTime: datetime,
      endTime: datetime,
      liveTail: [],
    };
  }

  const ts = metric.timeSeries;
  if (!ts.liveTail) ts.liveTail = [];

  ts.liveTail.push({ datetime, value });
  if (ts.liveTail.length > LIVE_TAIL_MAX_ENTRIES) {
    ts.liveTail.splice(0, ts.liveTail.length - LIVE_TAIL_MAX_ENTRIES);
  }

  ts.endTime = Math.max(ts.endTime ?? datetime, datetime);
  refreshAggregates(ts);

  metric.latest = createMeasurement(value, ts.units);
}

export function refreshAggregates(ts: MetricTimeSeries): void {
  const samples: number[] = [];
  for (const v of ts.values) {
    if (typeof v === "number" && !Number.isNaN(v)) samples.push(v);
  }
  if (ts.liveTail) {
    for (const p of ts.liveTail) samples.push(p.value);
  }
  if (samples.length === 0) {
    ts.aggregates = undefined;
    return;
  }

  let min = samples[0];
  let max = samples[0];
  let sum = 0;
  for (const s of samples) {
    if (s < min) min = s;
    if (s > max) max = s;
    sum += s;
  }
  const avg = sum / samples.length;

  ts.aggregates = {
    min: createMeasurement(min, ts.units),
    avg: createMeasurement(avg, ts.units),
    max: createMeasurement(max, ts.units),
  };
}

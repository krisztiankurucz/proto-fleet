import { MetricUnit } from "@/protoOS/api/generated/nats/miner_common_api_pb";

const UNIT_SCALES: Record<MetricUnit, number> = {
  [MetricUnit.UNKNOWN]: 1,
  [MetricUnit.MICRO]: 1e-6,
  [MetricUnit.MILLI]: 1e-3,
  [MetricUnit.CENTI]: 1e-2,
  [MetricUnit.DECI]: 1e-1,
  [MetricUnit.BASE]: 1,
  [MetricUnit.DECA]: 10,
  [MetricUnit.HECTO]: 100,
  [MetricUnit.KILO]: 1e3,
  [MetricUnit.MEGA]: 1e6,
  [MetricUnit.GIGA]: 1e9,
  [MetricUnit.TERA]: 1e12,
  [MetricUnit.PETA]: 1e15,
};

export function scaleMetricValue(value: number, unit: MetricUnit): number {
  return value * (UNIT_SCALES[unit] ?? 1);
}

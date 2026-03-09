import { MetricUnit } from "@/protoOS/api/generated/nats/miner_common_api_pb";

export const UNIT_DIVISORS: Record<number, number> = {
  [MetricUnit.MICRO]: 1_000_000,
  [MetricUnit.MILLI]: 1000,
  [MetricUnit.CENTI]: 100,
  [MetricUnit.DECI]: 10,
  [MetricUnit.BASE]: 1,
  [MetricUnit.DECA]: 0.1,
  [MetricUnit.HECTO]: 0.01,
  [MetricUnit.KILO]: 0.001,
};

export function getDivisor(unit: MetricUnit): number {
  return UNIT_DIVISORS[unit] ?? 1;
}

export function formatDecimals(divisor: number): number {
  if (divisor >= 1000) return 2;
  if (divisor >= 10) return 1;
  return 0;
}

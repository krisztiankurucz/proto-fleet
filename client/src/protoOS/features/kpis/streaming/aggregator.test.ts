import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";

import { aggregateStreamingPoint, type StreamingSourceState } from "./aggregator";
import { HashboardOperatingStatsSchema } from "@/protoOS/api/generated/nats/miner_hb_api_pb";

const makeStats = (overrides: {
  hashrate?: number;
  power?: number;
  efficiency?: number;
  tempMax?: number;
  tempAvg?: number;
}) =>
  create(HashboardOperatingStatsSchema, {
    boardHashrate: overrides.hashrate ?? 0,
    boardPower: overrides.power ?? 0,
    boardEfficiency: overrides.efficiency ?? 0,
    boardTemps: {
      max: overrides.tempMax ?? 0,
      average: overrides.tempAvg ?? 0,
      min: 0,
    },
  });

const NOW = 1_700_000_000_000;

describe("aggregateStreamingPoint", () => {
  it("returns null when no hashboards have reported", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map(),
      psuInputPowerW: new Map([[1, 1000]]),
    };
    expect(aggregateStreamingPoint(state, NOW)).toBeNull();
  });

  it("sums per-hashboard hashrate and averages board temps across hashboards", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map([
        [0, makeStats({ hashrate: 100, power: 1500, tempAvg: 60 })],
        [1, makeStats({ hashrate: 110, power: 1600, tempAvg: 70 })],
        [2, makeStats({ hashrate: 90, power: 1450, tempAvg: 65 })],
      ]),
      psuInputPowerW: new Map(),
    };
    const point = aggregateStreamingPoint(state, NOW);
    expect(point).not.toBeNull();
    expect(point!.miner.hashrateThs).toBe(300);
    // mean(60, 70, 65)
    expect(point!.miner.temperatureC).toBe(65);
    // No PSU data → falls back to Σ boardPower
    expect(point!.miner.powerW).toBe(4550);
    expect(point!.hashboards.size).toBe(3);
  });

  it("ignores hashboards with no temperature when averaging", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map([
        [0, makeStats({ hashrate: 100, tempAvg: 60 })],
        [1, makeStats({ hashrate: 100, tempAvg: 0 })], // no temp reported → skipped
      ]),
      psuInputPowerW: new Map(),
    };
    const point = aggregateStreamingPoint(state, NOW)!;
    expect(point.miner.temperatureC).toBe(60);
  });

  it("prefers PSU INPUT_POWER sum over hashboard board power when available", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map([[0, makeStats({ hashrate: 100, power: 1500, tempMax: 60 })]]),
      psuInputPowerW: new Map([
        [1, 1700],
        [2, 1750],
      ]),
    };
    const point = aggregateStreamingPoint(state, NOW)!;
    expect(point.miner.powerW).toBe(3450);
  });

  it("derives efficiency as power / hashrate", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map([[0, makeStats({ hashrate: 100, power: 1500 })]]),
      psuInputPowerW: new Map([[1, 2000]]),
    };
    const point = aggregateStreamingPoint(state, NOW)!;
    expect(point.miner.efficiencyJTh).toBe(20);
  });

  it("returns 0 efficiency when hashrate is 0 (avoid div-by-zero)", () => {
    const state: StreamingSourceState = {
      hashboardStats: new Map([[0, makeStats({ hashrate: 0, power: 500 })]]),
      psuInputPowerW: new Map(),
    };
    const point = aggregateStreamingPoint(state, NOW)!;
    expect(point.miner.efficiencyJTh).toBe(0);
  });

  it("uses boardTemps.average even when max is higher (match recorded average temp)", () => {
    const stats = create(HashboardOperatingStatsSchema, {
      boardHashrate: 50,
      boardPower: 800,
      boardEfficiency: 16,
      boardTemps: { average: 55, min: 50, max: 82 },
    });
    const state: StreamingSourceState = {
      hashboardStats: new Map([[0, stats]]),
      psuInputPowerW: new Map(),
    };
    const point = aggregateStreamingPoint(state, NOW)!;
    expect(point.miner.temperatureC).toBe(55);
  });
});

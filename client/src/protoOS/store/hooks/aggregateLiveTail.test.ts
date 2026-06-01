import { describe, expect, it } from "vitest";
import { aggregateLiveTail, type TailPoint } from "./aggregateLiveTail";

const miner = (pairs: [number, number][]): TailPoint[] => pairs.map(([datetime, value]) => ({ datetime, value }));

describe("aggregateLiveTail", () => {
  it("returns nothing for an empty tail or non-positive interval", () => {
    expect(aggregateLiveTail([], new Map(), 0, 1000, -1)).toEqual([]);
    expect(aggregateLiveTail(miner([[0, 10]]), new Map(), 0, 0, -1)).toEqual([]);
  });

  it("averages samples within each interval bucket and places the row at the latest sample time", () => {
    const out = aggregateLiveTail(
      miner([
        [0, 10],
        [500, 20],
        [1000, 30],
        [1500, 40],
      ]),
      new Map(),
      0,
      1000,
      -1,
    );
    expect(out).toEqual([
      { datetime: 500, miner: 15 },
      { datetime: 1500, miner: 35 },
    ]);
  });

  it("excludes samples at or before afterTime (no overlap with history)", () => {
    const out = aggregateLiveTail(
      miner([
        [0, 10],
        [500, 20],
        [1000, 30],
        [1500, 40],
      ]),
      new Map(),
      0,
      1000,
      500,
    );
    expect(out).toEqual([{ datetime: 1500, miner: 35 }]);
  });

  it("averages each hashboard series per bucket alongside the miner series", () => {
    const hashboards = new Map<string, TailPoint[]>([
      [
        "hbA",
        miner([
          [0, 100],
          [500, 200],
          [1000, 300],
        ]),
      ],
    ]);
    const out = aggregateLiveTail(
      miner([
        [0, 10],
        [500, 20],
        [1000, 30],
      ]),
      hashboards,
      0,
      1000,
      -1,
    );
    expect(out).toEqual([
      { datetime: 500, miner: 15, hbA: 150 },
      { datetime: 1000, miner: 30, hbA: 300 },
    ]);
  });
});

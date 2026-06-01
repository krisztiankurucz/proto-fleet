import { describe, expect, it } from "vitest";
import { buildSmoothedLiveSeries } from "./smoothing";
import type { ChartData } from "./types";

const rows = (pairs: [number, number][]): ChartData[] => pairs.map(([datetime, miner]) => ({ datetime, miner }));

describe("buildSmoothedLiveSeries", () => {
  it("returns input unchanged when there are fewer than 2 points", () => {
    const single = rows([[0, 5]]);
    expect(buildSmoothedLiveSeries(single, ["miner"], 1)).toBe(single);
  });

  it("passes exactly through every control point when fully revealed", () => {
    const control = rows([
      [0, 10],
      [1000, 20],
      [2000, 15],
      [3000, 25],
    ]);
    const out = buildSmoothedLiveSeries(control, ["miner"], 1);

    for (const point of control) {
      const match = out.find((o) => o.datetime === point.datetime);
      expect(match).toBeDefined();
      expect(match!.miner).toBeCloseTo(point.miner as number, 6);
    }
  });

  it("produces strictly increasing datetimes", () => {
    const out = buildSmoothedLiveSeries(
      rows([
        [0, 10],
        [1000, 30],
        [2000, 5],
        [3000, 25],
      ]),
      ["miner"],
      1,
    );
    for (let i = 1; i < out.length; i++) {
      expect(out[i].datetime).toBeGreaterThan(out[i - 1].datetime);
    }
  });

  it("ends at the previous point when drawProgress is 0, and at the newest when 1", () => {
    const control = rows([
      [0, 10],
      [1000, 20],
      [2000, 40],
    ]);

    const atStart = buildSmoothedLiveSeries(control, ["miner"], 0);
    expect(atStart[atStart.length - 1].datetime).toBe(1000);
    expect(atStart[atStart.length - 1].miner).toBeCloseTo(20, 6);

    const atEnd = buildSmoothedLiveSeries(control, ["miner"], 1);
    expect(atEnd[atEnd.length - 1].datetime).toBe(2000);
    expect(atEnd[atEnd.length - 1].miner).toBeCloseTo(40, 6);
  });

  it("keeps collinear input on the straight line (no spline overshoot)", () => {
    // value = 2 * datetime, perfectly linear
    const out = buildSmoothedLiveSeries(
      rows([
        [0, 0],
        [100, 200],
        [200, 400],
        [300, 600],
      ]),
      ["miner"],
      1,
    );
    for (const point of out) {
      expect(point.miner).toBeCloseTo(point.datetime * 2, 6);
    }
  });

  it("falls back to linear for a series key with missing neighbours", () => {
    const control: ChartData[] = [
      { datetime: 0, miner: 0, hb: null },
      { datetime: 1000, miner: 10, hb: 100 },
      { datetime: 2000, miner: 20, hb: 200 },
    ];
    const out = buildSmoothedLiveSeries(control, ["miner", "hb"], 1);
    // No NaNs anywhere
    for (const point of out) {
      expect(Number.isNaN(point.miner)).toBe(false);
      if (point.hb !== null) expect(Number.isNaN(point.hb as number)).toBe(false);
    }
  });
});

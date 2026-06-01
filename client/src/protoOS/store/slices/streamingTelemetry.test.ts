import { describe, expect, it } from "vitest";

import type { MetricTelemetry } from "../types";
import { appendLiveSample, LIVE_TAIL_MAX_ENTRIES } from "./streamingTelemetry";

describe("appendLiveSample", () => {
  it("initializes timeSeries when none exists and seeds aggregates", () => {
    const metric: MetricTelemetry = {};
    appendLiveSample(metric, 1_700_000_000_000, 42, "TH/s");

    expect(metric.timeSeries).toBeDefined();
    expect(metric.timeSeries!.units).toBe("TH/s");
    expect(metric.timeSeries!.liveTail).toEqual([{ datetime: 1_700_000_000_000, value: 42 }]);
    expect(metric.timeSeries!.aggregates?.min?.value).toBe(42);
    expect(metric.timeSeries!.aggregates?.max?.value).toBe(42);
    expect(metric.timeSeries!.aggregates?.avg?.value).toBe(42);
    expect(metric.latest?.value).toBe(42);
  });

  it("recomputes aggregates incrementally across historical values and live tail", () => {
    const metric: MetricTelemetry = {
      timeSeries: {
        units: "TH/s",
        values: [100, 200, 300],
        startTime: 0,
        endTime: 1000,
      },
    };
    appendLiveSample(metric, 2000, 50, "TH/s");
    appendLiveSample(metric, 3000, 400, "TH/s");

    expect(metric.timeSeries!.aggregates?.min?.value).toBe(50);
    expect(metric.timeSeries!.aggregates?.max?.value).toBe(400);
    expect(metric.timeSeries!.aggregates?.avg?.value).toBeCloseTo((100 + 200 + 300 + 50 + 400) / 5);
    expect(metric.timeSeries!.endTime).toBe(3000);
    expect(metric.latest?.value).toBe(400);
  });

  it("evicts the oldest live tail entries when the cap is exceeded", () => {
    const metric: MetricTelemetry = {};
    for (let i = 0; i < LIVE_TAIL_MAX_ENTRIES + 50; i++) {
      appendLiveSample(metric, i, i, "TH/s");
    }

    expect(metric.timeSeries!.liveTail!.length).toBe(LIVE_TAIL_MAX_ENTRIES);
    // The earliest retained datetime should be the one right after the evicted prefix.
    expect(metric.timeSeries!.liveTail![0].datetime).toBe(50);
    expect(metric.timeSeries!.liveTail![LIVE_TAIL_MAX_ENTRIES - 1].datetime).toBe(LIVE_TAIL_MAX_ENTRIES + 49);
  });

  it("ignores nulls in values[] when computing aggregates", () => {
    const metric: MetricTelemetry = {
      timeSeries: {
        units: "TH/s",
        values: [null, 100, null, 200],
        startTime: 0,
        endTime: 1000,
      },
    };
    appendLiveSample(metric, 2000, 300, "TH/s");

    expect(metric.timeSeries!.aggregates?.min?.value).toBe(100);
    expect(metric.timeSeries!.aggregates?.max?.value).toBe(300);
    expect(metric.timeSeries!.aggregates?.avg?.value).toBe((100 + 200 + 300) / 3);
  });
});

import type { ChartData } from "@/shared/components/LineChart";

export type TailPoint = { datetime: number; value: number };

/**
 * Aggregate live-tail samples into interval-aligned buckets (mean per bucket),
 * mirroring how the historical series is mean-aggregated by the time-series API.
 *
 * On coarse views (1h+) the historical line is smooth (e.g. 1-minute means) while
 * the raw ~1s live tail is jittery and grows a new point every second — visibly
 * noisy. Bucketing the tail to the view's `intervalMs` makes the live tip as
 * smooth as the rest of the line (the trailing partial bucket is a running mean,
 * so it stays responsive without the per-second jitter).
 *
 * Buckets are aligned to `startTime` so they continue the historical grid, and
 * only samples strictly after `afterTime` are included (avoids overlapping the
 * last historical point). Each row is placed at the latest sample time in its
 * bucket. Per-series means are anchored to buckets that contain a miner sample.
 */
export function aggregateLiveTail(
  minerTail: TailPoint[],
  hashboardTails: Map<string, TailPoint[]>,
  startTime: number,
  intervalMs: number,
  afterTime: number,
): ChartData[] {
  if (intervalMs <= 0 || minerTail.length === 0) return [];

  const bucketKey = (datetime: number) => Math.floor((datetime - startTime) / intervalMs);

  type Mean = { sum: number; count: number };
  type Bucket = { time: number; miner: Mean; hashboards: Map<string, Mean> };
  const buckets = new Map<number, Bucket>();

  for (const point of minerTail) {
    if (point.datetime <= afterTime) continue;
    const key = bucketKey(point.datetime);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { time: point.datetime, miner: { sum: 0, count: 0 }, hashboards: new Map() };
      buckets.set(key, bucket);
    }
    if (point.datetime > bucket.time) bucket.time = point.datetime;
    bucket.miner.sum += point.value;
    bucket.miner.count += 1;
  }

  hashboardTails.forEach((tail, serial) => {
    for (const point of tail) {
      if (point.datetime <= afterTime) continue;
      const bucket = buckets.get(bucketKey(point.datetime));
      if (!bucket) continue; // rows are anchored to buckets with a miner sample
      let mean = bucket.hashboards.get(serial);
      if (!mean) {
        mean = { sum: 0, count: 0 };
        bucket.hashboards.set(serial, mean);
      }
      mean.sum += point.value;
      mean.count += 1;
    }
  });

  return Array.from(buckets.keys())
    .sort((a, b) => a - b)
    .map((key) => {
      const bucket = buckets.get(key)!;
      const row: ChartData = {
        datetime: bucket.time,
        miner: bucket.miner.count ? bucket.miner.sum / bucket.miner.count : null,
      };
      bucket.hashboards.forEach((mean, serial) => {
        row[serial] = mean.count ? mean.sum / mean.count : null;
      });
      return row;
    });
}

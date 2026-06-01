import type { ChartData } from "./types";

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && !Number.isNaN(v);

/** Uniform Catmull-Rom scalar interpolation through p1→p2, shaped by neighbours p0/p3. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Build a dense, smooth polyline through `controlRows` (sorted by datetime) that
 * the chart renders with straight segments — visually a Catmull-Rom curve, but
 * with geometry we control.
 *
 * The newest segment is revealed progressively by `drawProgress` (0→1) so the
 * leading edge animates in. Crucially the curve is derived only from committed
 * control points, so already-drawn geometry is identical frame-to-frame: the
 * settled line never reshapes as the tip advances (unlike a chart-native spline,
 * which re-bends neighbouring segments whenever a point moves or is appended).
 *
 * Per series key it falls back to linear interpolation wherever a Catmull-Rom
 * neighbour is missing (e.g. a hashboard series with gaps).
 */
export function buildSmoothedLiveSeries(
  controlRows: ChartData[],
  keys: string[],
  drawProgress: number,
  samplesPerSegment = 4,
): ChartData[] {
  const m = controlRows.length;
  if (m < 2 || samplesPerSegment < 1) return controlRows;

  const lastSeg = m - 2;
  const out: ChartData[] = [];

  const interp = (i: number, t: number): ChartData => {
    const p1 = controlRows[i];
    const p2 = controlRows[i + 1];

    const row: ChartData = { datetime: p1.datetime + (p2.datetime - p1.datetime) * t };
    for (const key of keys) {
      const v1 = p1[key];
      const v2 = p2[key];
      if (!isNum(v1) || !isNum(v2)) {
        row[key] = isNum(v2) ? v2 : null;
        continue;
      }
      // Reflect a phantom neighbour (2·p − next) when the real one is missing or
      // out of range, so the tangent stays correct: endpoints don't sag and
      // collinear data stays straight (duplicating the neighbour would halve the
      // slope and bow the first/last segment).
      const rawV0 = i - 1 >= 0 ? controlRows[i - 1][key] : undefined;
      const rawV3 = i + 2 < m ? controlRows[i + 2][key] : undefined;
      const v0 = isNum(rawV0) ? rawV0 : 2 * v1 - v2;
      const v3 = isNum(rawV3) ? rawV3 : 2 * v2 - v1;
      row[key] = catmullRom(v0, v1, v2, v3, t);
    }
    return row;
  };

  for (let i = 0; i <= lastSeg; i++) {
    const tEnd = i === lastSeg ? Math.min(Math.max(drawProgress, 0), 1) : 1;
    // First segment emits its start point; later segments skip it (it's the
    // previous segment's already-emitted end point).
    const startStep = i === 0 ? 0 : 1;
    for (let s = startStep; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      if (t >= tEnd) break;
      out.push(interp(i, t));
    }
    // Exact segment end: a control point for complete segments, the animated tip
    // for the leading one.
    out.push(interp(i, tEnd));
  }

  return out;
}

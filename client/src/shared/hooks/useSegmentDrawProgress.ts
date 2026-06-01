import { useEffect, useRef, useState } from "react";

// Re-render cadence for the draw animation. The 1m window slides only ~15px/s,
// so ~20fps looks smooth while re-rendering the chart far less often than once
// per animation frame. This matters: a continuous 60fps re-render loop floods
// React's dev-mode render profiling (a performance.measure per component render,
// which accumulates unbounded) until the tab runs out of memory. We still drive
// it from requestAnimationFrame — not setInterval — so it pauses while the tab
// is hidden instead of churning in the background.
const FRAME_INTERVAL_MS = 50;

/**
 * Progress value (0→1) for "drawing in" the most recent line segment.
 *
 * Progress is derived from a wall-clock that ticks via requestAnimationFrame —
 * `clamp((now - targetTime) / durationMs, 0, 1)` — rather than from a separately
 * reset counter. That matters: because both `targetTime` and the clock share the
 * same epoch clock, the very render in which a new sample first appears already
 * reads progress ≈ 0, so the new value is never painted un-animated for a frame
 * (no pop/snap-back hiccup at the segment boundary).
 *
 * The loop ticks at ~FRAME_INTERVAL_MS and runs only for `durationMs` after
 * `targetTime` changes, then stops — a settled or stalled stream costs no idle
 * renders. Returns a stable 1 when `enabled` is false, so non-animated callers
 * pay nothing.
 *
 * Drives a manual line-draw animation because the shared LineChart keeps
 * Recharts' own animation disabled (known JavascriptAnimate infinite-loop bug).
 */
export function useSegmentDrawProgress(targetTime: number | undefined, durationMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef(0);

  // React's dev build emits a `performance.measure` per component render for its
  // profiling tracks, and those entries accumulate in the performance buffer with
  // no cap. A continuously re-rendering view (like this animation) piles them up
  // until the tab runs out of memory and `performance.measure` itself throws.
  // Bound the buffer by clearing it on an interval while the animation is live.
  // Dev-only: production never emits these measures, so there's nothing to clear.
  useEffect(() => {
    if (!enabled || !import.meta.env.DEV || typeof performance.clearMeasures !== "function") return;

    const id = window.setInterval(() => performance.clearMeasures(), 2000);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || targetTime === undefined || durationMs <= 0) return;

    const start = performance.now();
    let lastEmit = -Infinity;
    const tick = () => {
      const elapsed = performance.now() - start;
      const done = elapsed >= durationMs;
      // Throttle re-renders to ~FRAME_INTERVAL_MS; always emit the first and the
      // final frame so the tip starts fresh and settles exactly on the value.
      if (done || elapsed - lastEmit >= FRAME_INTERVAL_MS) {
        lastEmit = elapsed;
        setNow(Date.now());
      }
      if (!done) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => cancelAnimationFrame(rafRef.current);
  }, [targetTime, durationMs, enabled]);

  if (!enabled || targetTime === undefined || durationMs <= 0) return 1;
  return Math.min(Math.max((now - targetTime) / durationMs, 0), 1);
}

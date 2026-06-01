import { useStreamingTelemetry } from "./useStreamingTelemetry";

/**
 * Headless runner that keeps the live telemetry tail filling regardless of which
 * route is mounted. Mounted once at the app root (inside NatsGate) rather than in
 * a page layout, so the live tip / "1m" data stays continuous even while the user
 * is on non-chart pages.
 *
 * Without this, the subscription stops when the chart page unmounts, so returning
 * later bridges the missing span with a misleading straight line and eventually a
 * gap as the stale point scrolls off.
 */
export function StreamingTelemetryRunner(): null {
  useStreamingTelemetry();
  return null;
}

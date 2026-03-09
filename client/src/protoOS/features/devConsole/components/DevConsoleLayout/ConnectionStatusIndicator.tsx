import clsx from "clsx";

import { useNatsConnection } from "@/protoOS/features/devConsole/hooks/useNatsConnection";
import type { ConnectionState } from "@/protoOS/features/devConsole/nats/connection";

const STATE_COLORS: Record<ConnectionState, string> = {
  connected: "bg-intent-success-fill",
  connecting: "bg-intent-warning-fill",
  disconnected: "bg-text-primary-30",
  error: "bg-intent-critical-fill",
};

const STATE_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
  error: "Connection Error",
};

function ConnectionStatusIndicator() {
  const { state, reconnect } = useNatsConnection();

  return (
    <button
      onClick={state !== "connected" ? reconnect : undefined}
      className="flex items-center gap-1.5 text-300 text-text-primary-70"
      title={state !== "connected" ? "Click to reconnect" : undefined}
    >
      <span className={clsx("inline-block h-2 w-2 rounded-full", STATE_COLORS[state])} />
      {STATE_LABELS[state]}
    </button>
  );
}

export default ConnectionStatusIndicator;

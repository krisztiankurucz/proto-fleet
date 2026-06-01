import { ReactNode } from "react";

import { NatsContext } from "./NatsContext";
import NatsProvider from "./NatsProvider";
import { useNatsAvailability } from "./useNatsAvailability";

interface NatsGateProps {
  children: ReactNode;
}

const noop = () => {};

/**
 * Mounts a real NatsProvider once the WebSocket probe has confirmed NATS is reachable.
 * While probing or when unavailable, provides a stub context so useNatsConnection still
 * returns (with state="disconnected") instead of throwing.
 */
export function NatsGate({ children }: NatsGateProps) {
  const availability = useNatsAvailability();
  if (availability === "available") {
    return <NatsProvider>{children}</NatsProvider>;
  }
  return (
    <NatsContext.Provider value={{ connection: null, state: "disconnected", reconnect: noop }}>
      {children}
    </NatsContext.Provider>
  );
}

import { createContext, ReactNode, useEffect, useRef, useState } from "react";

import { NATS_WS_URL } from "./constants";
import { probeWebSocket } from "./probeWebSocket";

export type DevConsoleAvailability = "probing" | "available" | "unavailable";

export const DevConsoleAvailabilityContext = createContext<DevConsoleAvailability | null>(null);

interface DevConsoleAvailabilityProviderProps {
  children: ReactNode;
}

export function DevConsoleAvailabilityProvider({ children }: DevConsoleAvailabilityProviderProps) {
  const [availability, setAvailability] = useState<DevConsoleAvailability>("probing");
  const probed = useRef(false);

  useEffect(() => {
    if (probed.current) return;
    probed.current = true;

    probeWebSocket(NATS_WS_URL).then((ok) => {
      setAvailability(ok ? "available" : "unavailable");
    });
  }, []);

  return (
    <DevConsoleAvailabilityContext.Provider value={availability}>{children}</DevConsoleAvailabilityContext.Provider>
  );
}

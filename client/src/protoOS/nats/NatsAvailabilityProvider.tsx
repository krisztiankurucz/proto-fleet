import { ReactNode, useEffect, useRef, useState } from "react";

import { NATS_WS_URL } from "./constants";
import { type NatsAvailability, NatsAvailabilityContext } from "./NatsAvailabilityContext";
import { probeWebSocket } from "./probeWebSocket";

interface NatsAvailabilityProviderProps {
  children: ReactNode;
}

export function NatsAvailabilityProvider({ children }: NatsAvailabilityProviderProps) {
  const [availability, setAvailability] = useState<NatsAvailability>("probing");
  const probed = useRef(false);

  useEffect(() => {
    if (probed.current) return;
    probed.current = true;

    probeWebSocket(NATS_WS_URL).then((ok) => {
      setAvailability(ok ? "available" : "unavailable");
    });
  }, []);

  return <NatsAvailabilityContext.Provider value={availability}>{children}</NatsAvailabilityContext.Provider>;
}

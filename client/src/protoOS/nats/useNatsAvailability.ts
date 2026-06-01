import { useContext } from "react";

import { type NatsAvailability, NatsAvailabilityContext } from "./NatsAvailabilityContext";

export function useNatsAvailability(): NatsAvailability {
  const availability = useContext(NatsAvailabilityContext);
  if (availability === null) {
    throw new Error("useNatsAvailability must be used within a NatsAvailabilityProvider");
  }
  return availability;
}

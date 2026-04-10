import { useContext } from "react";

import { DevConsoleAvailabilityContext } from "../DevConsoleAvailabilityProvider";
import type { DevConsoleAvailability } from "../DevConsoleAvailabilityProvider";

export function useDevConsoleAvailability(): DevConsoleAvailability {
  const availability = useContext(DevConsoleAvailabilityContext);
  if (availability === null) {
    throw new Error("useDevConsoleAvailability must be used within a DevConsoleAvailabilityProvider");
  }
  return availability;
}

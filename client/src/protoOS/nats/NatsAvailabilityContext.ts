import { createContext } from "react";

export type NatsAvailability = "probing" | "available" | "unavailable";

export const NatsAvailabilityContext = createContext<NatsAvailability | null>(null);

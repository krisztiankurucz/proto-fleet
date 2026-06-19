import { useContext } from "react";

import { NatsContext, type NatsContextValue } from "./NatsContext";

export function useNatsConnection(): NatsContextValue {
  const context = useContext(NatsContext);
  if (!context) {
    throw new Error("useNatsConnection must be used within a NatsProvider");
  }
  return context;
}

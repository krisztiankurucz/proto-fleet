import { createContext, useContext } from "react";

import type { LedStatus } from "@/protoOS/api/generated/nats/miner_ui_api_pb";
import type { PsuData } from "@/protoOS/features/devConsole/hooks/usePsuData";
import type { UseRawMessagesResult } from "@/protoOS/features/devConsole/hooks/useRawMessages";

export interface DevConsoleDataContextValue {
  psuData: PsuData[];
  ledStatus: LedStatus | null;
  rawMessages: UseRawMessagesResult;
}

export const DevConsoleDataContext = createContext<DevConsoleDataContextValue | null>(null);

export function useDevConsoleData(): DevConsoleDataContextValue {
  const context = useContext(DevConsoleDataContext);
  if (!context) {
    throw new Error("useDevConsoleData must be used within a DevConsoleDataProvider");
  }
  return context;
}

import { ReactNode, useMemo } from "react";

import { DevConsoleDataContext } from "./DevConsoleDataContext";
import { PSU_COUNT } from "@/protoOS/features/devConsole/constants";
import { useLedStatus } from "@/protoOS/features/devConsole/hooks/useLedStatus";
import { usePsuData } from "@/protoOS/features/devConsole/hooks/usePsuData";
import { useRawMessages } from "@/protoOS/features/devConsole/hooks/useRawMessages";

interface DevConsoleDataProviderProps {
  children: ReactNode;
}

function DevConsoleDataProvider({ children }: DevConsoleDataProviderProps) {
  const psu1 = usePsuData(1);
  const psu2 = usePsuData(2);
  const psu3 = usePsuData(3);
  const ledStatus = useLedStatus();
  const rawMessages = useRawMessages();

  const psuData = useMemo(() => {
    const data = [psu1, psu2, psu3];
    if (PSU_COUNT > data.length) {
      return data;
    }
    return data.slice(0, PSU_COUNT);
  }, [psu1, psu2, psu3]);

  const value = useMemo(() => ({ psuData, ledStatus, rawMessages }), [psuData, ledStatus, rawMessages]);

  return <DevConsoleDataContext.Provider value={value}>{children}</DevConsoleDataContext.Provider>;
}

export default DevConsoleDataProvider;

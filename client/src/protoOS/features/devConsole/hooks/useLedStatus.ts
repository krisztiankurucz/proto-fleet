import { useEffect, useState } from "react";

import { useNatsConnection } from "./useNatsConnection";
import type { LedStatus } from "@/protoOS/api/generated/nats/miner_ui_api_pb";
import { subscribeLedStatus } from "@/protoOS/features/devConsole/nats/subscriptions";

export function useLedStatus(): LedStatus | null {
  const { connection } = useNatsConnection();
  const [ledStatus, setLedStatus] = useState<LedStatus | null>(null);

  useEffect(() => {
    if (!connection) return;

    const sub = subscribeLedStatus(connection, setLedStatus);

    return () => {
      sub.unsubscribe();
    };
  }, [connection]);

  return ledStatus;
}

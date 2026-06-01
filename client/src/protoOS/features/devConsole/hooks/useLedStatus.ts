import { useEffect, useState } from "react";

import type { LedStatus } from "@/protoOS/api/generated/nats/miner_ui_api_pb";
import { subscribeLedStatus, useNatsConnection } from "@/protoOS/nats";

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

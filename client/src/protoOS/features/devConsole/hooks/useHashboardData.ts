import { useEffect, useState } from "react";

import type {
  AsicOperatingStats,
  HashboardOperatingStats,
  HashboardStatus,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import {
  subscribeHashboardAsicStats,
  subscribeHashboardOperatingStats,
  subscribeHashboardStatus,
  useNatsConnection,
} from "@/protoOS/nats";

export interface HashboardData {
  operatingStats: HashboardOperatingStats | null;
  asicStats: AsicOperatingStats | null;
  status: HashboardStatus | null;
}

export function useHashboardData(slot: number): HashboardData {
  const { connection } = useNatsConnection();
  const [operatingStats, setOperatingStats] = useState<HashboardOperatingStats | null>(null);
  const [asicStats, setAsicStats] = useState<AsicOperatingStats | null>(null);
  const [status, setStatus] = useState<HashboardStatus | null>(null);

  useEffect(() => {
    if (!connection) return;

    const subs = [
      subscribeHashboardOperatingStats(connection, slot, setOperatingStats),
      subscribeHashboardAsicStats(connection, slot, setAsicStats),
      subscribeHashboardStatus(connection, slot, setStatus),
    ];

    return () => {
      subs.forEach((sub) => sub.unsubscribe());
    };
  }, [connection, slot]);

  return { operatingStats, asicStats, status };
}

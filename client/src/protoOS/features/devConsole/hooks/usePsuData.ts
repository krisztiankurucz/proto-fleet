import { useEffect, useState } from "react";

import type {
  PsuErrors,
  PsuInfoMsg,
  PsuMeasurements,
  PsuStatusMsg,
} from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import {
  subscribePsuErrors,
  subscribePsuInfo,
  subscribePsuMeasurements,
  subscribePsuStatus,
  useNatsConnection,
} from "@/protoOS/nats";

export interface PsuData {
  measurements: PsuMeasurements | null;
  status: PsuStatusMsg | null;
  info: PsuInfoMsg | null;
  errors: PsuErrors | null;
}

export function usePsuData(psuId: number): PsuData {
  const { connection } = useNatsConnection();
  const [measurements, setMeasurements] = useState<PsuMeasurements | null>(null);
  const [status, setStatus] = useState<PsuStatusMsg | null>(null);
  const [info, setInfo] = useState<PsuInfoMsg | null>(null);
  const [errors, setErrors] = useState<PsuErrors | null>(null);

  useEffect(() => {
    if (!connection) return;

    const subs = [
      subscribePsuMeasurements(connection, psuId, setMeasurements),
      subscribePsuStatus(connection, psuId, setStatus),
      subscribePsuInfo(connection, psuId, setInfo),
      subscribePsuErrors(connection, psuId, setErrors),
    ];

    return () => {
      subs.forEach((sub) => sub.unsubscribe());
    };
  }, [connection, psuId]);

  return { measurements, status, info, errors };
}

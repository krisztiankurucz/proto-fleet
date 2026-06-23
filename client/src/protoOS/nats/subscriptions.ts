import { fromBinary } from "@bufbuild/protobuf";
import type { NatsConnection, Subscription } from "@nats-io/nats-core";

import {
  type HashboardOperatingStats,
  HashboardOperatingStatsSchema,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import { type PsuMeasurements, PsuMeasurementsSchema } from "@/protoOS/api/generated/nats/miner_psu_api_pb";

export function subscribePsuMeasurements(
  nc: NatsConnection,
  psuId: number,
  onMessage: (data: PsuMeasurements) => void,
): Subscription {
  const sub = nc.subscribe(`psu.${psuId}.data`);
  processSubscription(sub, PsuMeasurementsSchema, onMessage);
  return sub;
}

export function subscribeHashboardOperatingStats(
  nc: NatsConnection,
  slot: number,
  onMessage: (data: HashboardOperatingStats) => void,
): Subscription {
  const sub = nc.subscribe(`hb.${slot}.data.board`);
  processSubscription(sub, HashboardOperatingStatsSchema, onMessage);
  return sub;
}

export function processSubscription<T>(
  sub: Subscription,
  schema: { readonly typeName: string } & Parameters<typeof fromBinary>[0],
  onMessage: (data: T) => void,
): void {
  (async () => {
    for await (const msg of sub) {
      if (!msg.data) continue;
      let decoded: T;
      try {
        decoded = fromBinary(schema, msg.data) as T;
      } catch (error) {
        console.warn(`Failed to decode ${schema.typeName} message`, error);
        continue;
      }
      try {
        onMessage(decoded);
      } catch (error) {
        console.error(`Error handling ${schema.typeName} message`, error);
      }
    }
  })();
}

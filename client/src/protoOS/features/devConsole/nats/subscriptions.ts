import { fromBinary } from "@bufbuild/protobuf";
import type { NatsConnection, Subscription } from "@nats-io/nats-core";

import {
  type PsuErrors,
  PsuErrorsSchema,
  type PsuInfoMsg,
  PsuInfoMsgSchema,
  type PsuMeasurements,
  PsuMeasurementsSchema,
  type PsuStatusMsg,
  PsuStatusMsgSchema,
} from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import {
  type ButtonEvent,
  ButtonEventSchema,
  type LedStatus,
  LedStatusSchema,
} from "@/protoOS/api/generated/nats/miner_ui_api_pb";

export function subscribePsuMeasurements(
  nc: NatsConnection,
  psuId: number,
  onMessage: (data: PsuMeasurements) => void,
): Subscription {
  const sub = nc.subscribe(`psu.${psuId}.data`);
  processSubscription(sub, PsuMeasurementsSchema, onMessage);
  return sub;
}

export function subscribePsuStatus(
  nc: NatsConnection,
  psuId: number,
  onMessage: (data: PsuStatusMsg) => void,
): Subscription {
  const sub = nc.subscribe(`psu.${psuId}.status`);
  processSubscription(sub, PsuStatusMsgSchema, onMessage);
  return sub;
}

export function subscribePsuInfo(
  nc: NatsConnection,
  psuId: number,
  onMessage: (data: PsuInfoMsg) => void,
): Subscription {
  const sub = nc.subscribe(`psu.${psuId}.info`);
  processSubscription(sub, PsuInfoMsgSchema, onMessage);
  return sub;
}

export function subscribePsuErrors(
  nc: NatsConnection,
  psuId: number,
  onMessage: (data: PsuErrors) => void,
): Subscription {
  const sub = nc.subscribe(`psu.${psuId}.error`);
  processSubscription(sub, PsuErrorsSchema, onMessage);
  return sub;
}

export function subscribeLedStatus(nc: NatsConnection, onMessage: (data: LedStatus) => void): Subscription {
  const sub = nc.subscribe("ui.led.status");
  processSubscription(sub, LedStatusSchema, onMessage);
  return sub;
}

export function subscribeButtonEvent(nc: NatsConnection, onMessage: (data: ButtonEvent) => void): Subscription {
  const sub = nc.subscribe("ui.button.event");
  processSubscription(sub, ButtonEventSchema, onMessage);
  return sub;
}

export interface RawNatsMessage {
  subject: string;
  timestamp: number;
  size: number;
  data: Uint8Array;
}

export function subscribeAll(nc: NatsConnection, onMessage: (msg: RawNatsMessage) => void): Subscription {
  const sub = nc.subscribe(">");
  (async () => {
    for await (const msg of sub) {
      onMessage({
        subject: msg.subject,
        timestamp: Date.now(),
        size: msg.data?.length ?? 0,
        data: msg.data ?? new Uint8Array(),
      });
    }
  })();
  return sub;
}

function processSubscription<T>(
  sub: Subscription,
  schema: { readonly typeName: string } & Parameters<typeof fromBinary>[0],
  onMessage: (data: T) => void,
): void {
  (async () => {
    for await (const msg of sub) {
      if (!msg.data) continue;
      try {
        const decoded = fromBinary(schema, msg.data) as T;
        onMessage(decoded);
      } catch {
        console.warn(`Failed to decode ${schema.typeName} message`);
      }
    }
  })();
}

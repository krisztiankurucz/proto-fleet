import { type NatsConnection, wsconnect } from "@nats-io/nats-core";

import { NATS_WS_URL } from "@/protoOS/features/devConsole/constants";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export interface NatsConnectionManager {
  connection: NatsConnection | null;
  state: ConnectionState;
}

export async function connectToNats(): Promise<NatsConnection> {
  return wsconnect({ servers: NATS_WS_URL });
}

export async function disconnectFromNats(connection: NatsConnection): Promise<void> {
  await connection.drain();
}

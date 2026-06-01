import { createContext } from "react";
import type { NatsConnection } from "@nats-io/nats-core";

import type { ConnectionState } from "./connection";

export interface NatsContextValue {
  connection: NatsConnection | null;
  state: ConnectionState;
  reconnect: () => void;
}

export const NatsContext = createContext<NatsContextValue | null>(null);

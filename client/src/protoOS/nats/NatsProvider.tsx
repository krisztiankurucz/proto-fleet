import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { NatsConnection } from "@nats-io/nats-core";

import { connectToNats, disconnectFromNats } from "./connection";
import type { ConnectionState } from "./connection";
import { NatsContext } from "./NatsContext";

interface NatsProviderProps {
  children: ReactNode;
}

function NatsProvider({ children }: NatsProviderProps) {
  const [connection, setConnection] = useState<NatsConnection | null>(null);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const connectionRef = useRef<NatsConnection | null>(null);

  const connect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await disconnectFromNats(connectionRef.current);
      } catch {
        // Ignore disconnect errors during reconnect
      }
      connectionRef.current = null;
    }

    setState("connecting");
    try {
      const nc = await connectToNats();
      connectionRef.current = nc;
      setConnection(nc);
      setState("connected");

      (async () => {
        try {
          await nc.closed();
        } finally {
          if (connectionRef.current === nc) {
            setConnection(null);
            connectionRef.current = null;
            setState("disconnected");
          }
        }
      })();
    } catch {
      setState("error");
      setConnection(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- connect() is async and is the entry point for external WebSocket subscription
    connect();

    return () => {
      const nc = connectionRef.current;
      if (nc) {
        connectionRef.current = null;
        disconnectFromNats(nc).catch(() => {});
      }
    };
  }, [connect]);

  return <NatsContext.Provider value={{ connection, state, reconnect: connect }}>{children}</NatsContext.Provider>;
}

export default NatsProvider;

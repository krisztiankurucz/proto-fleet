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
  const connectionAttemptRef = useRef(0);
  const mountedRef = useRef(false);

  const disconnectQuietly = useCallback(async (nc: NatsConnection) => {
    try {
      await disconnectFromNats(nc);
    } catch {
      // Ignore disconnect errors during reconnect or cleanup
    }
  }, []);

  const connect = useCallback(async () => {
    const attemptId = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attemptId;

    const previousConnection = connectionRef.current;
    if (previousConnection) {
      connectionRef.current = null;
      disconnectQuietly(previousConnection);
    }

    setConnection(null);
    setState("connecting");
    try {
      const nc = await connectToNats();
      if (!mountedRef.current || connectionAttemptRef.current !== attemptId) {
        disconnectQuietly(nc);
        return;
      }

      connectionRef.current = nc;
      setConnection(nc);
      setState("connected");

      (async () => {
        try {
          await nc.closed();
        } finally {
          if (mountedRef.current && connectionRef.current === nc && connectionAttemptRef.current === attemptId) {
            setConnection(null);
            connectionRef.current = null;
            setState("disconnected");
          }
        }
      })();
    } catch {
      if (mountedRef.current && connectionAttemptRef.current === attemptId) {
        setState("error");
        setConnection(null);
      }
    }
  }, [disconnectQuietly]);

  useEffect(() => {
    mountedRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- connect() is async and is the entry point for external WebSocket subscription
    connect();

    return () => {
      mountedRef.current = false;
      connectionAttemptRef.current += 1;

      const nc = connectionRef.current;
      if (nc) {
        connectionRef.current = null;
        disconnectQuietly(nc);
      }
    };
  }, [connect, disconnectQuietly]);

  return <NatsContext.Provider value={{ connection, state, reconnect: connect }}>{children}</NatsContext.Provider>;
}

export default NatsProvider;

import { useCallback, useEffect, useRef, useState } from "react";

import { useNatsConnection } from "./useNatsConnection";
import { MAX_RAW_MESSAGES } from "@/protoOS/features/devConsole/constants";
import { type RawNatsMessage, subscribeAll } from "@/protoOS/features/devConsole/nats/subscriptions";

export interface UseRawMessagesResult {
  messages: RawNatsMessage[];
  paused: boolean;
  subjectFilter: string;
  setSubjectFilter: (filter: string) => void;
  togglePause: () => void;
  clear: () => void;
}

export function useRawMessages(): UseRawMessagesResult {
  const { connection } = useNatsConnection();
  const [messages, setMessages] = useState<RawNatsMessage[]>([]);
  const [paused, setPaused] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const pausedRef = useRef(false);
  const filterRef = useRef("");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    filterRef.current = subjectFilter;
  }, [subjectFilter]);

  useEffect(() => {
    if (!connection) return;

    const sub = subscribeAll(connection, (msg) => {
      if (pausedRef.current) return;

      const filter = filterRef.current;
      if (filter && !msg.subject.includes(filter)) return;

      setMessages((prev) => {
        const next = [...prev, msg];
        if (next.length > MAX_RAW_MESSAGES) {
          return next.slice(next.length - MAX_RAW_MESSAGES);
        }
        return next;
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [connection]);

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, paused, subjectFilter, setSubjectFilter, togglePause, clear };
}

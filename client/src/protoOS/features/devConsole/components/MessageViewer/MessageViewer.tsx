import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import MessageList from "./MessageList";
import { useDevConsoleData } from "@/protoOS/features/devConsole/nats/DevConsoleDataContext";
import Button from "@/shared/components/Button";
import { variants } from "@/shared/components/Button";

const SAMPLE_INTERVAL_MS = 1000;
const WINDOW_SIZE = 5;
const BYTES_PER_KB = 1024;

function formatThroughput(bytesPerSec: number): string {
  if (bytesPerSec >= BYTES_PER_KB) {
    return `${(bytesPerSec / BYTES_PER_KB).toFixed(1)} kB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}

function MessageViewer() {
  const { rawMessages } = useDevConsoleData();
  const { messages, paused, subjectFilter, setSubjectFilter, togglePause, clear } = rawMessages;
  const [throughput, setThroughput] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const prevTotalRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const totalBytes = messages.reduce((sum, m) => sum + m.size, 0);
      const delta = Math.max(0, totalBytes - prevTotalRef.current);
      prevTotalRef.current = totalBytes;

      const samples = samplesRef.current;
      samples.push(delta);
      if (samples.length > WINDOW_SIZE) samples.shift();

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      setThroughput(avg);
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [messages]);

  const handleFilterChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSubjectFilter(e.target.value);
    },
    [setSubjectFilter],
  );

  return (
    <div className="flex max-h-[calc(100vh-220px)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by subject..."
          value={subjectFilter}
          onChange={handleFilterChange}
          className="flex-1 rounded-lg border border-core-primary-20 bg-surface-elevated-base px-3 py-2 text-emphasis-300 text-text-primary placeholder:text-text-primary-30"
        />
        <Button
          variant={paused ? variants.primary : variants.secondary}
          text={paused ? "Resume" : "Pause"}
          onClick={togglePause}
          size="compact"
        />
        <Button variant={variants.secondary} text="Clear" onClick={clear} size="compact" />
      </div>
      <div className="flex items-center gap-3 text-300 text-text-primary-50">
        <span>
          {messages.length} message{messages.length !== 1 ? "s" : ""}
          {paused ? " (paused)" : null}
        </span>
        <span className="text-text-primary-30">|</span>
        <span>{formatThroughput(throughput)}</span>
      </div>
      <MessageList messages={messages} />
    </div>
  );
}

export default MessageViewer;

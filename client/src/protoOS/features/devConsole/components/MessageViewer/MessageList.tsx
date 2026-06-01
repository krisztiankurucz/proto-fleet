import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import { type DecodedMessage, type RawNatsMessage, tryDecodeMessage } from "@/protoOS/nats";

interface MessageListProps {
  messages: RawNatsMessage[];
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const time = date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

function messageKey(msg: RawNatsMessage): string {
  return `${msg.timestamp}-${msg.subject}-${msg.size}`;
}

interface MessageRowProps {
  msg: RawNatsMessage;
  isExpanded: boolean;
  onClick: () => void;
}

function MessageRow({ msg, isExpanded, onClick }: MessageRowProps) {
  const decoded = useMemo<DecodedMessage | null>(
    () => (isExpanded ? tryDecodeMessage(msg.subject, msg.data) : null),
    [isExpanded, msg.subject, msg.data],
  );

  return (
    <>
      <tr
        onClick={onClick}
        className={clsx(
          "cursor-pointer border-t border-core-primary-10 text-text-primary",
          isExpanded ? "bg-core-primary-10" : "hover:bg-core-primary-10",
        )}
      >
        <td className="py-1 pr-3 pl-4">
          <span className="whitespace-nowrap text-text-primary-50">{formatTimestamp(msg.timestamp)}</span>
        </td>
        <td className="px-3 py-1 break-all">
          {msg.subject}
          {isExpanded && decoded ? (
            <span className="ml-2 rounded bg-core-accent-fill/20 px-1.5 py-0.5 text-core-accent-fill">
              {decoded.label}
            </span>
          ) : null}
        </td>
        <td className="px-3 py-1 pr-4 text-right whitespace-nowrap text-text-primary-50">{msg.size} B</td>
      </tr>
      {isExpanded ? (
        <tr className="bg-core-primary-10">
          <td colSpan={3} className="p-0">
            {decoded ? (
              <pre className="max-h-64 overflow-auto border-t border-core-primary-20 bg-core-primary-5 py-2 pr-3 pl-4 text-text-primary-70">
                {decoded.json}
              </pre>
            ) : msg.data.length > 0 ? (
              <div className="border-t border-core-primary-20 px-3 py-2 text-text-primary-50">
                {msg.data.length} bytes (unknown schema)
              </div>
            ) : (
              <div className="border-t border-core-primary-20 px-3 py-2 text-text-primary-50">(empty payload)</div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const autoScrollThreshold = 50;
    shouldAutoScrollRef.current = distanceFromBottom < autoScrollThreshold;
  }, []);

  const handleRowClick = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  if (messages.length === 0) {
    return (
      <div className="rounded-xl bg-core-primary-5 p-8 text-center text-300 text-text-primary-50">
        No messages received yet. Messages will appear here as they arrive.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-auto rounded-xl bg-core-primary-5 font-mono text-xs"
    >
      <table className="w-full">
        <thead className="sticky top-0 z-10 border-b border-core-primary-20 bg-surface-elevated-base shadow-[inset_0_-1px_0_var(--color-core-primary-20)]">
          <tr className="text-left text-text-primary-70">
            <th className="py-2 pr-3 pl-4 font-normal whitespace-nowrap">Time</th>
            <th className="w-full px-3 py-2 font-normal">Subject</th>
            <th className="px-3 py-2 pr-4 text-right font-normal whitespace-nowrap">Size</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((msg) => {
            const key = messageKey(msg);
            return (
              <MessageRow key={key} msg={msg} isExpanded={expandedKey === key} onClick={() => handleRowClick(key)} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MessageList;

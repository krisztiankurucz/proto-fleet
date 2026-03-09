import { useCallback } from "react";

import { ButtonEventType } from "@/protoOS/api/generated/nats/miner_ui_api_pb";
import { useNatsConnection } from "@/protoOS/features/devConsole/hooks/useNatsConnection";
import { publishButtonEvent } from "@/protoOS/features/devConsole/nats/commands";
import Card from "@/protoOS/features/diagnostic/components/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader";

const BUTTON_EVENTS: { type: ButtonEventType; label: string; description: string }[] = [
  {
    type: ButtonEventType.BUTTON_EVENT_SLEEP,
    label: "Sleep",
    description: "Simulate a sleep button press",
  },
  {
    type: ButtonEventType.BUTTON_EVENT_IP_ADDR,
    label: "IP Address",
    description: "Simulate an IP address button press",
  },
  {
    type: ButtonEventType.BUTTON_EVENT_PAIRING,
    label: "Pairing",
    description: "Simulate a pairing button press",
  },
  {
    type: ButtonEventType.BUTTON_EVENT_LONG_PRESS,
    label: "Long Press",
    description: "Simulate a long button press",
  },
];

function ButtonPanel() {
  const { connection } = useNatsConnection();

  const handleButtonPress = useCallback(
    (eventType: ButtonEventType) => {
      if (!connection) return;
      publishButtonEvent(connection, eventType);
    },
    [connection],
  );

  return (
    <Card>
      <CardHeader title="Button Events" />
      <div className="flex flex-col gap-3">
        <div className="text-300 text-text-primary-70">
          Simulate physical button presses by publishing events to the NATS bus.
        </div>
        <div className="grid grid-cols-2 gap-3">
          {BUTTON_EVENTS.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => handleButtonPress(type)}
              disabled={!connection}
              className="flex flex-col gap-1 rounded-xl border border-core-primary-20 bg-surface-elevated-base p-4 text-left transition-colors hover:bg-core-primary-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-emphasis-300 text-text-primary">{label}</span>
              <span className="text-300 text-text-primary-50">{description}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default ButtonPanel;

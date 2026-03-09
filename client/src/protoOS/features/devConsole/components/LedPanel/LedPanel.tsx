import { useCallback, useMemo, useState } from "react";

import LedIndicator from "./LedIndicator";
import SevenSegmentDisplay from "./SevenSegmentDisplay";
import { LedId, LedSeqName, type LedState } from "@/protoOS/api/generated/nats/miner_ui_api_pb";
import { useNatsConnection } from "@/protoOS/features/devConsole/hooks/useNatsConnection";
import { publishLedClear, publishLedPlay } from "@/protoOS/features/devConsole/nats/commands";
import { useDevConsoleData } from "@/protoOS/features/devConsole/nats/DevConsoleDataContext";
import Card from "@/protoOS/features/diagnostic/components/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader";
import Button, { variants } from "@/shared/components/Button";

const LED_SEQ_OPTIONS: { value: LedSeqName; label: string }[] = [
  { value: LedSeqName.START_UP, label: "Start Up" },
  { value: LedSeqName.LOADING, label: "Loading" },
  { value: LedSeqName.NUMBERS, label: "Numbers" },
  { value: LedSeqName.MINING, label: "Mining" },
  { value: LedSeqName.PAIRING, label: "Pairing" },
  { value: LedSeqName.LOCATING, label: "Locating" },
  { value: LedSeqName.IDLE, label: "Idle" },
  { value: LedSeqName.BLANK, label: "Blank" },
  { value: LedSeqName.BUTTON_PRESS, label: "Button Press" },
  { value: LedSeqName.REBOOTING, label: "Rebooting" },
  { value: LedSeqName.HASHBOARD_UPDATE, label: "Hashboard Update" },
  { value: LedSeqName.PSU_UPDATE, label: "PSU Update" },
  { value: LedSeqName.IP_ADDR, label: "IP Address" },
  { value: LedSeqName.RIG_ERROR, label: "Rig Error" },
  { value: LedSeqName.FAN_ERROR, label: "Fan Error" },
  { value: LedSeqName.HB_ERROR, label: "HB Error" },
  { value: LedSeqName.PSU_ERROR, label: "PSU Error" },
  { value: LedSeqName.GENERIC_ERROR, label: "Generic Error" },
  { value: LedSeqName.ALL_ERROR, label: "All Error" },
  { value: LedSeqName.MULTIPLE_ERROR, label: "Multiple Error" },
  { value: LedSeqName.FACTORY_TEST, label: "Factory Test" },
];

const LED_ID_LABELS: Record<number, string> = {
  [LedId.STATUS]: "Status",
  [LedId.HB]: "Hashboard",
  [LedId.FAN]: "Fan",
  [LedId.PSU]: "PSU",
  [LedId.CB]: "Control Board",
  [LedId.SEGDISPLAY]: "Display",
};

const INDICATOR_LED_IDS = [LedId.STATUS, LedId.HB, LedId.FAN, LedId.PSU, LedId.CB] as const;

function findLedState(ledStates: LedState[], ledId: LedId): LedState | undefined {
  return ledStates.find((s) => s.ledId === ledId);
}

function getRgbColor(led: LedState | undefined) {
  if (led?.val.case === "rgb") return led.val.value;
  return undefined;
}

function LedPanel() {
  const { connection } = useNatsConnection();
  const { ledStatus } = useDevConsoleData();
  const [selectedSeq, setSelectedSeq] = useState<LedSeqName>(LedSeqName.MINING);
  const [persist, setPersist] = useState(false);

  const handlePlay = useCallback(() => {
    if (!connection) return;
    publishLedPlay(connection, selectedSeq, persist);
  }, [connection, selectedSeq, persist]);

  const handleClear = useCallback(() => {
    if (!connection) return;
    publishLedClear(connection);
  }, [connection]);

  const currentSeqLabel = LED_SEQ_OPTIONS.find((o) => o.value === ledStatus?.currentSeq)?.label ?? "Unknown";

  const segDisplayState = useMemo(
    () => (ledStatus ? findLedState(ledStatus.ledStates, LedId.SEGDISPLAY) : undefined),
    [ledStatus],
  );

  const segDisplayValue = segDisplayState?.val.case === "sevenSegment" ? segDisplayState.val.value.value : undefined;
  const segDisplayColor = getRgbColor(segDisplayState);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader title="Status LEDs" />
        {ledStatus?.ledStates && ledStatus.ledStates.length > 0 ? (
          <div className="flex flex-col gap-3">
            {INDICATOR_LED_IDS.map((ledId) => {
              const led = findLedState(ledStatus.ledStates, ledId);
              return (
                <LedIndicator
                  key={ledId}
                  label={LED_ID_LABELS[ledId] ?? `LED ${ledId}`}
                  color={getRgbColor(led)}
                  setting={led?.setting}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-300 text-text-primary-50">No LED status received yet</div>
        )}
      </Card>

      <Card>
        <CardHeader title="Seven Segment" />
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg bg-black p-4">
            <SevenSegmentDisplay value={segDisplayValue} color={segDisplayColor ?? undefined} />
          </div>
          <div className="text-300 text-text-primary-70">
            Current Sequence: <span className="text-text-primary">{currentSeqLabel}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Control" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-300 text-text-primary-70" htmlFor="led-seq-select">
              Sequence
            </label>
            <select
              id="led-seq-select"
              className="rounded-lg border border-core-primary-20 bg-surface-elevated-base px-3 py-2 text-emphasis-300 text-text-primary"
              value={selectedSeq}
              onChange={(e) => setSelectedSeq(Number(e.target.value) as LedSeqName)}
            >
              {LED_SEQ_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-300 text-text-primary">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="h-4 w-4"
            />
            Persist
          </label>
          <div className="flex gap-2">
            <Button variant={variants.primary} text="Play" onClick={handlePlay} disabled={!connection} size="compact" />
            <Button
              variant={variants.secondary}
              text="Clear"
              onClick={handleClear}
              disabled={!connection}
              size="compact"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default LedPanel;

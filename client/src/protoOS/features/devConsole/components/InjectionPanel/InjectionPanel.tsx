import { useCallback, useState } from "react";

import { PsuErrorCode, PsuMeasurementType } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PSU_COUNT } from "@/protoOS/features/devConsole/constants";
import { useNatsConnection } from "@/protoOS/features/devConsole/hooks/useNatsConnection";
import {
  publishClearInjections,
  publishInjectError,
  publishInjectMeasurement,
} from "@/protoOS/features/devConsole/nats/commands";
import Card from "@/protoOS/features/diagnostic/components/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader";
import Button from "@/shared/components/Button";
import { variants } from "@/shared/components/Button";
import Callout from "@/shared/components/Callout";
import Switch from "@/shared/components/Switch";

const ALL_PSU_IDS = Array.from({ length: PSU_COUNT }, (_, i) => i + 1);

const ERROR_CODE_OPTIONS: { value: PsuErrorCode; label: string }[] = [
  { value: PsuErrorCode.PROBE_FAILURE, label: "Probe Failure" },
  { value: PsuErrorCode.OUTPUT_OVER_VOLTAGE, label: "Output Over Voltage" },
  { value: PsuErrorCode.OUTPUT_OVER_CURRENT, label: "Output Over Current" },
  { value: PsuErrorCode.OVER_TEMPERATURE, label: "Over Temperature" },
  { value: PsuErrorCode.OUTPUT_UNDER_VOLTAGE, label: "Output Under Voltage" },
  { value: PsuErrorCode.FANS, label: "Fans" },
  { value: PsuErrorCode.INPUT, label: "Input" },
  { value: PsuErrorCode.UNKNOWN, label: "Unknown" },
  { value: PsuErrorCode.COMM_LOST, label: "Comm Lost" },
  { value: PsuErrorCode.GPIO_FAILURE, label: "GPIO Failure" },
  { value: PsuErrorCode.OUTPUT_OVER_POWER, label: "Output Over Power" },
  { value: PsuErrorCode.FIRMWARE_MISMATCH, label: "Firmware Mismatch" },
];

const MEASUREMENT_TYPE_OPTIONS: { value: PsuMeasurementType; label: string }[] = [
  { value: PsuMeasurementType.OUTPUT_VOLTAGE, label: "Output Voltage (mV)" },
  { value: PsuMeasurementType.INPUT_VOLTAGE, label: "Input Voltage (mV)" },
  { value: PsuMeasurementType.OUTPUT_CURRENT, label: "Output Current (mA)" },
  { value: PsuMeasurementType.INPUT_CURRENT, label: "Input Current (mA)" },
  { value: PsuMeasurementType.OUTPUT_POWER, label: "Output Power (mW)" },
  { value: PsuMeasurementType.INPUT_POWER, label: "Input Power (mW)" },
  { value: PsuMeasurementType.HOTSPOT_TEMPERATURE, label: "Hotspot Temperature (mC)" },
  { value: PsuMeasurementType.AMBIENT_TEMPERATURE, label: "Ambient Temperature (mC)" },
];

const selectClass =
  "rounded-lg border border-core-primary-20 bg-surface-elevated-base px-3 py-2 text-emphasis-300 text-text-primary";

const inputClass =
  "rounded-lg border border-core-primary-20 bg-surface-elevated-base px-3 py-2 text-emphasis-300 text-text-primary";

const toggleBase = "rounded-lg px-3 py-1.5 text-300 font-medium transition-colors";
const toggleOn = `${toggleBase} bg-core-accent-fill text-white`;
const toggleOff = `${toggleBase} bg-core-primary-10 text-text-primary hover:bg-core-primary-20`;

function PsuMultiSelect({ selected, onChange }: { selected: Set<number>; onChange: (next: Set<number>) => void }) {
  const allSelected = selected.size === PSU_COUNT;

  const toggleAll = () => {
    onChange(new Set(allSelected ? [] : ALL_PSU_IDS));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-300 text-text-primary-70">Target PSUs</span>
      <div className="flex gap-1.5">
        <button type="button" className={allSelected ? toggleOn : toggleOff} onClick={toggleAll}>
          All
        </button>
        {ALL_PSU_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={selected.has(id) ? toggleOn : toggleOff}
            onClick={() => toggleOne(id)}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}

function InjectionPanel() {
  const { connection } = useNatsConnection();
  const [selectedPsus, setSelectedPsus] = useState<Set<number>>(() => new Set(ALL_PSU_IDS));
  const [selectedError, setSelectedError] = useState<PsuErrorCode>(PsuErrorCode.OUTPUT_OVER_VOLTAGE);
  const [errorPersistent, setErrorPersistent] = useState(true);
  const [selectedMeasType, setSelectedMeasType] = useState<PsuMeasurementType>(PsuMeasurementType.OUTPUT_VOLTAGE);
  const [measPersistent, setMeasPersistent] = useState(true);
  const [measurementValue, setMeasurementValue] = useState("0");

  const disabled = !connection;
  const noneSelected = selectedPsus.size === 0;

  const handleInjectError = useCallback(() => {
    if (!connection) return;
    for (const psuId of selectedPsus) {
      publishInjectError(connection, psuId, selectedError, errorPersistent);
    }
  }, [connection, selectedPsus, selectedError, errorPersistent]);

  const handleInjectMeasurement = useCallback(() => {
    if (!connection) return;
    const value = parseInt(measurementValue, 10);
    if (isNaN(value)) return;
    for (const psuId of selectedPsus) {
      publishInjectMeasurement(connection, psuId, selectedMeasType, value, measPersistent);
    }
  }, [connection, selectedPsus, selectedMeasType, measurementValue, measPersistent]);

  const handleClearAll = useCallback(() => {
    if (!connection) return;
    for (const psuId of selectedPsus) {
      publishClearInjections(connection, psuId, true, true);
    }
  }, [connection, selectedPsus]);

  return (
    <div className="flex flex-col gap-6">
      <Callout
        intent="warning"
        prefixIcon={<span className="text-lg">!</span>}
        title="Injection commands modify hardware behavior"
        subtitle="These commands inject synthetic data for testing purposes. Use with caution."
      />

      <Card>
        <CardHeader title="PSU" />
        <div className="flex flex-col gap-5">
          <PsuMultiSelect selected={selectedPsus} onChange={setSelectedPsus} />

          <div className="flex flex-col gap-3 border-t border-core-primary-10 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-300 font-medium text-text-primary">Error</div>
              <Switch label="Persistent" checked={errorPersistent} setChecked={setErrorPersistent} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-300 text-text-primary-70" htmlFor="error-code-select">
                  Error Code
                </label>
                <select
                  id="error-code-select"
                  className={selectClass}
                  value={selectedError}
                  onChange={(e) => setSelectedError(Number(e.target.value) as PsuErrorCode)}
                >
                  {ERROR_CODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={variants.danger}
                text="Inject Error"
                onClick={handleInjectError}
                disabled={disabled || noneSelected}
                size="compact"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-core-primary-10 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-300 font-medium text-text-primary">Measurement</div>
              <Switch label="Persistent" checked={measPersistent} setChecked={setMeasPersistent} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-300 text-text-primary-70" htmlFor="meas-type-select">
                  Type
                </label>
                <select
                  id="meas-type-select"
                  className={selectClass}
                  value={selectedMeasType}
                  onChange={(e) => setSelectedMeasType(Number(e.target.value) as PsuMeasurementType)}
                >
                  {MEASUREMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-300 text-text-primary-70" htmlFor="meas-value-input">
                  Value
                </label>
                <input
                  id="meas-value-input"
                  type="number"
                  className={inputClass}
                  value={measurementValue}
                  onChange={(e) => setMeasurementValue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={variants.accent}
                text="Inject Measurement"
                onClick={handleInjectMeasurement}
                disabled={disabled || noneSelected}
                size="compact"
              />
            </div>
          </div>

          <div className="border-t border-core-primary-10 pt-4">
            <Button
              variant={variants.secondary}
              text="Clear All Injections"
              onClick={handleClearAll}
              disabled={disabled || noneSelected}
              size="compact"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default InjectionPanel;

import { useCallback, useState } from "react";

import type { PsuStatusMsg } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { VOLTAGE_STEP_MV } from "@/protoOS/features/devConsole/constants";
import {
  publishPsuClearError,
  publishPsuEnable,
  publishPsuLockVoltage,
  publishPsuResetRecoveryLimits,
  publishPsuSetVoltage,
} from "@/protoOS/features/devConsole/nats/commands";
import { useNatsConnection } from "@/protoOS/nats";
import Button from "@/shared/components/Button";
import { variants } from "@/shared/components/Button";
import Switch from "@/shared/components/Switch";

interface PsuControlsProps {
  psuId: number;
  status: PsuStatusMsg | null;
}

function PsuControls({ psuId, status }: PsuControlsProps) {
  const { connection } = useNatsConnection();
  const isEnabled = status?.enable ?? false;
  const isLocked = status?.voltageLocked ?? false;
  const currentTargetMv = status?.targetOutputVoltageMv ?? 0;
  const [voltageInput, setVoltageInput] = useState("");

  const disabled = !connection;

  const handleToggleEnable = useCallback(() => {
    if (!connection) return;
    publishPsuEnable(connection, psuId, !isEnabled);
  }, [connection, psuId, isEnabled]);

  const handleToggleEnableSwitch = useCallback(
    (_: boolean | ((prev: boolean) => boolean)) => handleToggleEnable(),
    [handleToggleEnable],
  );

  const handleSetVoltage = useCallback(() => {
    if (!connection) return;
    const value = parseInt(voltageInput, 10);
    if (isNaN(value) || value < 0) return;
    publishPsuSetVoltage(connection, psuId, value);
    setVoltageInput("");
  }, [connection, psuId, voltageInput]);

  const handleVoltageUp = useCallback(() => {
    if (!connection) return;
    publishPsuSetVoltage(connection, psuId, currentTargetMv + VOLTAGE_STEP_MV);
  }, [connection, psuId, currentTargetMv]);

  const handleVoltageDown = useCallback(() => {
    if (!connection) return;
    publishPsuSetVoltage(connection, psuId, Math.max(0, currentTargetMv - VOLTAGE_STEP_MV));
  }, [connection, psuId, currentTargetMv]);

  const handleToggleLock = useCallback(() => {
    if (!connection) return;
    publishPsuLockVoltage(connection, psuId, !isLocked);
  }, [connection, psuId, isLocked]);

  const handleToggleLockSwitch = useCallback(
    (_: boolean | ((prev: boolean) => boolean)) => handleToggleLock(),
    [handleToggleLock],
  );

  const handleClearFaults = useCallback(() => {
    if (!connection) return;
    publishPsuClearError(connection, psuId);
  }, [connection, psuId]);

  const handleResetRecovery = useCallback(() => {
    if (!connection) return;
    publishPsuResetRecoveryLimits(connection, psuId);
  }, [connection, psuId]);

  return (
    <div className="flex flex-col gap-3 border-t border-core-primary-10 pt-3">
      <div className="flex items-center gap-4">
        <Switch
          label={isEnabled ? "Enabled" : "Disabled"}
          checked={isEnabled}
          setChecked={handleToggleEnableSwitch}
          disabled={disabled}
        />
        <Switch label="Lock voltage" checked={isLocked} setChecked={handleToggleLockSwitch} disabled={disabled} />
      </div>

      <div className="flex items-center gap-2">
        <div className="text-300 whitespace-nowrap text-text-primary-50">
          Target: <span className="text-text-primary">{currentTargetMv} mV</span>
        </div>
        <Button
          variant={variants.secondary}
          text={`-${VOLTAGE_STEP_MV}`}
          onClick={handleVoltageDown}
          disabled={disabled || isLocked}
          size="compact"
        />
        <Button
          variant={variants.secondary}
          text={`+${VOLTAGE_STEP_MV}`}
          onClick={handleVoltageUp}
          disabled={disabled || isLocked}
          size="compact"
        />
        <input
          type="number"
          placeholder="mV"
          value={voltageInput}
          onChange={(e) => setVoltageInput(e.target.value)}
          disabled={disabled || isLocked}
          className="w-20 rounded-lg border border-core-primary-10 bg-core-primary-5 px-2 py-1 text-300 text-text-primary outline-none placeholder:text-text-primary-50 focus:border-core-accent-fill disabled:opacity-50"
        />
        <Button
          variant={variants.primary}
          text="Set"
          onClick={handleSetVoltage}
          disabled={disabled || isLocked || voltageInput === ""}
          size="compact"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={variants.secondary}
          text="Clear Faults"
          onClick={handleClearFaults}
          disabled={disabled}
          size="compact"
        />
        <Button
          variant={variants.secondary}
          text="Reset Recovery"
          onClick={handleResetRecovery}
          disabled={disabled}
          size="compact"
        />
      </div>
    </div>
  );
}

export default PsuControls;

import { useCallback, useState } from "react";

import PsuControls from "./PsuControls";
import PsuMeasurementsDisplay from "./PsuMeasurements";
import { formatDecimals, getDivisor } from "./units";
import { PsuControllerState, PsuErrorCode, PsuMeasurementType } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import type { PsuInfoMsg, PsuLimit } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import type { NotificationError, PsuInfo } from "@/protoOS/api/generatedApi";
import type { PsuData } from "@/protoOS/features/devConsole/hooks/usePsuData";
import Card from "@/protoOS/features/diagnostic/components/Card/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader/CardHeader";

const CONTROLLER_STATE_LABELS: Record<number, string> = {
  [PsuControllerState.INIT]: "Init",
  [PsuControllerState.OFF]: "Off",
  [PsuControllerState.ON_READY]: "On (Ready)",
  [PsuControllerState.ON_NOT_READY]: "On (Not Ready)",
  [PsuControllerState.ERROR_RECOVERABLE]: "Error (Recoverable)",
  [PsuControllerState.RECOVERING]: "Recovering",
  [PsuControllerState.FIRMWARE_UPDATING]: "Firmware Updating",
  [PsuControllerState.DISCONNECTED]: "Disconnected",
  [PsuControllerState.ERROR_FATAL]: "Error (Fatal)",
};

const ERROR_STATES = new Set([PsuControllerState.ERROR_RECOVERABLE, PsuControllerState.ERROR_FATAL]);

const ERROR_CODE_LABELS: Record<number, string> = {
  [PsuErrorCode.PROBE_FAILURE]: "Probe Failure",
  [PsuErrorCode.OUTPUT_OVER_VOLTAGE]: "Output Over Voltage",
  [PsuErrorCode.OUTPUT_OVER_CURRENT]: "Output Over Current",
  [PsuErrorCode.OVER_TEMPERATURE]: "Over Temperature",
  [PsuErrorCode.OUTPUT_UNDER_VOLTAGE]: "Output Under Voltage",
  [PsuErrorCode.FANS]: "Fans",
  [PsuErrorCode.INPUT]: "Input",
  [PsuErrorCode.UNKNOWN]: "Unknown",
  [PsuErrorCode.COMM_LOST]: "Comm Lost",
  [PsuErrorCode.GPIO_FAILURE]: "GPIO Failure",
  [PsuErrorCode.OUTPUT_OVER_POWER]: "Output Over Power",
  [PsuErrorCode.FIRMWARE_MISMATCH]: "Firmware Mismatch",
};

interface LimitPair {
  label: string;
  displayUnit: string;
  output?: PsuLimit;
  input?: PsuLimit;
}

interface TempLimit {
  label: string;
  unit: string;
  limit: PsuLimit;
}

function groupLimits(limits: PsuLimit[]): { pairs: LimitPair[]; temps: TempLimit[] } {
  const byType = new Map<number, PsuLimit>();
  for (const l of limits) byType.set(l.limitType, l);

  const pairs: LimitPair[] = [
    {
      label: "Voltage",
      displayUnit: "V",
      output: byType.get(PsuMeasurementType.OUTPUT_VOLTAGE),
      input: byType.get(PsuMeasurementType.INPUT_VOLTAGE),
    },
    {
      label: "Current",
      displayUnit: "A",
      output: byType.get(PsuMeasurementType.OUTPUT_CURRENT),
      input: byType.get(PsuMeasurementType.INPUT_CURRENT),
    },
    {
      label: "Power",
      displayUnit: "W",
      output: byType.get(PsuMeasurementType.OUTPUT_POWER),
      input: byType.get(PsuMeasurementType.INPUT_POWER),
    },
  ].filter((p) => p.output || p.input);

  const tempEntries: Array<{ label: string; type: PsuMeasurementType }> = [
    { label: "Hotspot", type: PsuMeasurementType.HOTSPOT_TEMPERATURE },
    { label: "Ambient", type: PsuMeasurementType.AMBIENT_TEMPERATURE },
    { label: "Average", type: PsuMeasurementType.AVERAGE_TEMPERATURE },
  ];
  const temps: TempLimit[] = [];
  for (const entry of tempEntries) {
    const limit = byType.get(entry.type);
    if (limit) temps.push({ label: entry.label, unit: "\u00B0C", limit });
  }

  return { pairs, temps };
}

function ApiErrorRow({ error }: { error: NotificationError }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  const label = error.message ?? error.error_code ?? "Unknown Error";

  return (
    <div className="rounded bg-intent-critical-fill/20 px-2.5 py-1.5">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-200 font-medium text-intent-critical-fill">{label}</span>
        <span
          className={`text-200 text-intent-critical-fill/60 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        >
          &#x203A;
        </span>
      </button>
      {expanded && (
        <div className="text-100 mt-1.5 flex flex-col gap-0.5 text-intent-critical-fill/80">
          {error.error_code && <div>Code: {error.error_code}</div>}
          {error.timestamp && <div>Time: {new Date(error.timestamp * 1000).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}

function getStateStyles(state: PsuControllerState): { dot: string; text: string } {
  if (ERROR_STATES.has(state)) return { dot: "bg-intent-critical-fill", text: "text-intent-critical-fill" };
  if (state === PsuControllerState.ON_READY)
    return { dot: "bg-intent-success-fill", text: "text-intent-success-fill" };
  if (state === PsuControllerState.RECOVERING)
    return { dot: "bg-intent-warning-fill", text: "text-intent-warning-fill" };
  if (state === PsuControllerState.DISCONNECTED) return { dot: "bg-text-primary-50", text: "text-text-primary-50" };
  return { dot: "bg-core-accent-fill", text: "text-core-accent-fill" };
}

function formatLimitValue(limit: PsuLimit): string {
  const divisor = getDivisor(limit.unit);
  const decimals = formatDecimals(divisor);
  return `${(limit.minValue / divisor).toFixed(decimals)} \u2013 ${(limit.maxValue / divisor).toFixed(decimals)}`;
}

function PsuInfoDisplay({ info }: { info: PsuInfoMsg }) {
  return (
    <div>
      <div className="mb-2 text-300 font-medium text-text-primary">Info</div>
      <div className="flex flex-col gap-1 text-300">
        {[
          { label: "Vendor", value: info.vendor },
          { label: "Model", value: info.model },
          { label: "Serial", value: info.serialNumber },
          { label: "HW Rev", value: info.hwRevision },
          ...(info.firmware
            ? [
                { label: "FW App", value: info.firmware.appVersion },
                { label: "FW Boot", value: info.firmware.blVersion },
              ]
            : []),
        ].map((row) => (
          <div key={row.label} className="flex gap-2">
            <span className="w-16 shrink-0 text-text-primary-50">{row.label}</span>
            <span className="truncate text-text-primary">{row.value || "---"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLimit(limit: PsuLimit | undefined, displayUnit: string): string {
  if (!limit) return "---";
  return `${formatLimitValue(limit)} ${displayUnit}`;
}

function PsuLimitsDisplay({ limits }: { limits: PsuLimit[] }) {
  if (limits.length === 0) return null;
  const { pairs, temps } = groupLimits(limits);

  return (
    <div>
      <div className="mb-2 text-300 font-medium text-text-primary">Limits</div>
      <table className="text-300">
        <thead>
          <tr className="text-text-primary-50">
            <th className="w-16 pb-1 text-left font-medium" />
            {pairs.length > 0 && <th className="pr-4 pb-1 text-left font-medium">Output</th>}
            {pairs.length > 0 && <th className="pb-1 text-left font-medium">Input</th>}
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={p.label}>
              <td className="py-0.5 text-text-primary-50">{p.label}</td>
              <td className="py-0.5 pr-4 text-text-primary">{formatLimit(p.output, p.displayUnit)}</td>
              <td className="py-0.5 text-text-primary">{formatLimit(p.input, p.displayUnit)}</td>
            </tr>
          ))}
          {temps.length > 0 && (
            <>
              <tr>
                <td colSpan={3} className="pt-2 pb-1 font-medium text-text-primary-50">
                  Temperature
                </td>
              </tr>
              {temps.map((t) => (
                <tr key={t.label}>
                  <td className="py-0.5 text-text-primary-50">{t.label}</td>
                  <td colSpan={2} className="py-0.5 text-text-primary">
                    {formatLimit(t.limit, t.unit)}
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PsuCardProps {
  psuId: number;
  data: PsuData;
  hwInfo: PsuInfo | null;
  apiErrors: NotificationError[];
}

function PsuCard({ psuId, data, hwInfo, apiErrors }: PsuCardProps) {
  const { measurements, status, info, errors } = data;
  const [showDetails, setShowDetails] = useState(false);
  const state = status?.state ?? PsuControllerState.INIT;
  const stateLabel = CONTROLLER_STATE_LABELS[state] ?? "Unknown";
  const stateStyles = getStateStyles(state);
  const hasApiErrors = apiErrors.length > 0;
  const hasNatsErrors = errors && errors.errors.length > 0;
  const hasErrors = hasApiErrors || hasNatsErrors;
  const errorCount = hasApiErrors ? apiErrors.length : (errors?.errors.length ?? 0);
  const hasDetails = info && (info.vendor || info.model || info.serialNumber || info.limits.length > 0);

  const hwBadges = [
    { label: "Vendor", value: hwInfo?.manufacturer },
    { label: "Model", value: hwInfo?.model },
    { label: "Serial", value: hwInfo?.psu_sn },
    { label: "HW", value: hwInfo?.hw_revision },
    { label: "FW", value: hwInfo?.firmware?.app_version },
  ].filter((b) => b.value);

  return (
    <Card>
      <CardHeader
        title={`PSU ${psuId}`}
        actions={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-core-primary-10 px-2.5 py-1 text-200 font-medium ${stateStyles.text}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${stateStyles.dot}`} />
            {stateLabel}
          </span>
        }
      />

      {hwBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hwBadges.map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-core-primary-10 px-2.5 py-1 text-200"
            >
              <span className="text-text-primary-50">{b.label}</span>
              <span className="font-medium text-text-primary">{b.value}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <PsuMeasurementsDisplay measurements={measurements} />
        <PsuControls psuId={psuId} status={status} />

        {hasDetails && (
          <div className="border-t border-core-primary-10 pt-2">
            <button
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-200 text-core-accent-fill hover:underline"
            >
              {showDetails ? "Hide" : "Show"} Info & Limits
            </button>
            {showDetails && (
              <div className="mt-2 flex divide-x divide-core-primary-20 [&>*]:px-6 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0">
                {info && <PsuInfoDisplay info={info} />}
                {info && info.limits.length > 0 && <PsuLimitsDisplay limits={info.limits} />}
              </div>
            )}
          </div>
        )}

        {hasErrors && (
          <div className="rounded-lg bg-intent-critical-fill/10 p-3">
            <div className="text-300 font-medium text-intent-critical-fill">
              {errorCount} error{errorCount > 1 ? "s" : ""} active
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {hasApiErrors
                ? apiErrors.map((err, i) => <ApiErrorRow key={i} error={err} />)
                : errors?.errors.map((err, i) => {
                    const label = ERROR_CODE_LABELS[err.code] ?? `Error ${err.code}`;
                    return (
                      <div key={i} className="rounded bg-intent-critical-fill/20 px-2.5 py-1.5">
                        <span className="text-200 font-medium text-intent-critical-fill">{label}</span>
                      </div>
                    );
                  })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default PsuCard;

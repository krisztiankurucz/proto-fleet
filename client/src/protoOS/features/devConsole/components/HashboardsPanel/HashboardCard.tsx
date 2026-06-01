import { type ReactNode, useState } from "react";

import type {
  AsicOperatingStats,
  HashboardOperatingStats,
  HashboardStatus,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import {
  HashboardPerformanceMode,
  HashboardPllAlgorithm,
  HashboardServiceState,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import type { HashboardInfo } from "@/protoOS/api/generatedApi";
import { useHashboardData } from "@/protoOS/features/devConsole/hooks/useHashboardData";
import Card from "@/protoOS/features/diagnostic/components/Card/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader/CardHeader";
import LabeledValue from "@/protoOS/features/diagnostic/components/LabeledValue/LabeledValue";

const SERVICE_STATE_LABELS: Record<number, string> = {
  [HashboardServiceState.INIT]: "Init",
  [HashboardServiceState.DISCOVERY]: "Discovery",
  [HashboardServiceState.DISCONNECTED]: "Disconnected",
  [HashboardServiceState.READY]: "Ready",
  [HashboardServiceState.MINING]: "Mining",
  [HashboardServiceState.DISABLED]: "Disabled",
  [HashboardServiceState.UNKNOWN]: "Unknown",
};

const PERFORMANCE_MODE_LABELS: Record<number, string> = {
  [HashboardPerformanceMode.MAXIMUM]: "Maximum",
  [HashboardPerformanceMode.EFFICIENCY]: "Efficiency",
};

const PLL_ALGORITHM_LABELS: Record<number, string> = {
  [HashboardPllAlgorithm.NONE]: "None",
  [HashboardPllAlgorithm.VOLTAGE_IMBALANCE_COMPENSATION]: "Voltage Imbalance",
  [HashboardPllAlgorithm.FUZZING]: "Fuzzing",
};

const PLACEHOLDER = "---";

function getStateStyles(state: HashboardServiceState): { dot: string; text: string } {
  if (state === HashboardServiceState.MINING)
    return { dot: "bg-intent-success-fill", text: "text-intent-success-fill" };
  if (state === HashboardServiceState.READY) return { dot: "bg-core-accent-fill", text: "text-core-accent-fill" };
  if (state === HashboardServiceState.DISCOVERY || state === HashboardServiceState.INIT)
    return { dot: "bg-intent-warning-fill", text: "text-intent-warning-fill" };
  if (state === HashboardServiceState.DISCONNECTED || state === HashboardServiceState.DISABLED)
    return { dot: "bg-intent-critical-fill", text: "text-intent-critical-fill" };
  return { dot: "bg-text-primary-50", text: "text-text-primary-50" };
}

function formatUptime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return PLACEHOLDER;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatSeconds(sec: number): string {
  return formatUptime(sec * 1000);
}

function formatFloat(value: number | undefined, decimals = 2): string {
  if (value === undefined || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(decimals);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-200 font-medium text-text-primary-50">{title}</div>
      <div className="grid grid-cols-2 gap-2 tablet:auto-cols-fr tablet:grid-flow-col">{children}</div>
    </div>
  );
}

function OperatingSection({ stats }: { stats: HashboardOperatingStats | null }) {
  return (
    <Section title="Operating">
      <LabeledValue label="Hashrate (TH/s)" value={formatFloat(stats?.boardHashrate)} />
      <LabeledValue label="Ideal (TH/s)" value={formatFloat(stats?.boardHashrateIdeal)} />
      <LabeledValue label="Efficiency (J/TH)" value={formatFloat(stats?.boardEfficiency)} />
      <LabeledValue label="Power (W)" value={formatFloat(stats?.boardPower)} />
      <LabeledValue label="Voltage (V)" value={formatFloat(stats?.boardVoltage)} />
      <LabeledValue label="Current (A)" value={formatFloat(stats?.boardCurrent)} />
    </Section>
  );
}

function BoardTempSection({ stats }: { stats: HashboardOperatingStats | null }) {
  const temps = stats?.boardTemps;
  return (
    <Section title="Board Temperature">
      <LabeledValue label="Avg (°C)" value={formatFloat(temps?.average, 1)} />
      <LabeledValue label="Min (°C)" value={formatFloat(temps?.min, 1)} />
      <LabeledValue label="Max (°C)" value={formatFloat(temps?.max, 1)} />
      {temps?.inletFront !== undefined ? (
        <LabeledValue label="Inlet (°C)" value={formatFloat(temps.inletFront, 1)} />
      ) : null}
      {temps?.outletRear !== undefined ? (
        <LabeledValue label="Outlet (°C)" value={formatFloat(temps.outletRear, 1)} />
      ) : null}
    </Section>
  );
}

function StatusSection({ status }: { status: HashboardStatus | null }) {
  return (
    <Section title="Status">
      <LabeledValue label="Mining Enabled" value={status ? (status.miningEnabled ? "Yes" : "No") : PLACEHOLDER} />
      <LabeledValue label="Mining Uptime" value={status ? formatSeconds(status.miningUptimeS) : PLACEHOLDER} />
      <LabeledValue label="Work ID" value={status?.workId ?? PLACEHOLDER} />
      <LabeledValue label="Difficulty" value={status ? status.difficulty.toString() : PLACEHOLDER} />
    </Section>
  );
}

function PerformanceSection({ status }: { status: HashboardStatus | null }) {
  const perf = status?.performanceState;
  return (
    <Section title="Performance">
      <LabeledValue label="Mode" value={perf ? (PERFORMANCE_MODE_LABELS[perf.mode] ?? "Unknown") : PLACEHOLDER} />
      <LabeledValue label="Target (W)" value={perf?.powerTargetWatts ?? PLACEHOLDER} />
      <LabeledValue label="Throttle (W)" value={perf?.powerThrottleWatts ?? PLACEHOLDER} />
      <LabeledValue
        label="PLL Algorithm"
        value={perf ? (PLL_ALGORITHM_LABELS[perf.pllAlgorithm] ?? "Unknown") : PLACEHOLDER}
      />
    </Section>
  );
}

interface AsicStatsTableProps {
  asicStats: AsicOperatingStats | null;
}

function AsicStatsTable({ asicStats }: AsicStatsTableProps) {
  if (!asicStats || asicStats.asicStats.length === 0) {
    return <div className="text-300 text-text-primary-50">No ASIC data</div>;
  }

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-200">
        <thead className="sticky top-0 bg-core-primary-5">
          <tr className="text-text-primary-50">
            <th className="px-2 py-1 text-left font-medium">#</th>
            <th className="px-2 py-1 text-right font-medium">Voltage (V)</th>
            <th className="px-2 py-1 text-right font-medium">Temp (°C)</th>
            <th className="px-2 py-1 text-right font-medium">Freq (MHz)</th>
            <th className="px-2 py-1 text-right font-medium">Pass %</th>
            <th className="px-2 py-1 text-right font-medium">Hash (GH/s)</th>
          </tr>
        </thead>
        <tbody className="text-text-primary">
          {asicStats.asicStats.map((a, i) => (
            <tr key={i} className="odd:bg-core-primary-5/30">
              <td className="px-2 py-0.5 text-text-primary-50">{i}</td>
              <td className="px-2 py-0.5 text-right">{formatFloat(a.voltage, 3)}</td>
              <td className="px-2 py-0.5 text-right">{formatFloat(a.temperature, 1)}</td>
              <td className="px-2 py-0.5 text-right">{a.frequency}</td>
              <td className="px-2 py-0.5 text-right">{formatFloat(a.passRate, 1)}</td>
              <td className="px-2 py-0.5 text-right">{formatFloat(a.hashRate, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-core-primary-10 px-2.5 py-1 text-200">
      <span className="text-text-primary-50">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}

interface HashboardCardProps {
  slot: number;
  hwInfo: HashboardInfo;
}

function HashboardCard({ slot, hwInfo }: HashboardCardProps) {
  const { operatingStats, asicStats, status } = useHashboardData(slot);
  const [showAsics, setShowAsics] = useState(false);

  const state = status?.state ?? HashboardServiceState.UNKNOWN;
  const stateLabel = SERVICE_STATE_LABELS[state] ?? "Unknown";
  const stateStyles = getStateStyles(state);

  const asicCount = asicStats?.asicStats.length ?? hwInfo.mining_asic_count ?? 0;

  return (
    <Card>
      <CardHeader
        title={`Hashboard ${slot}`}
        actions={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-core-primary-10 px-2.5 py-1 text-200 font-medium ${stateStyles.text}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${stateStyles.dot}`} />
            {stateLabel}
          </span>
        }
      />

      <div className="flex flex-wrap gap-2">
        <InfoBadge label="Board" value={hwInfo.board} />
        <InfoBadge label="ASIC" value={hwInfo.mining_asic?.toUpperCase()} />
        <InfoBadge label="Serial" value={hwInfo.hb_sn} />
        <InfoBadge label="FW" value={hwInfo.firmware?.version} />
      </div>

      <div className="flex flex-col gap-4">
        <OperatingSection stats={operatingStats} />
        <BoardTempSection stats={operatingStats} />
        <StatusSection status={status} />
        <PerformanceSection status={status} />

        {asicCount > 0 ? (
          <div className="border-t border-core-primary-10 pt-2">
            <button
              onClick={() => setShowAsics((prev) => !prev)}
              className="text-200 text-core-accent-fill hover:underline"
            >
              {showAsics ? "Hide" : "Show"} ASICs ({asicCount})
            </button>
            {showAsics ? (
              <div className="mt-2">
                <AsicStatsTable asicStats={asicStats} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default HashboardCard;

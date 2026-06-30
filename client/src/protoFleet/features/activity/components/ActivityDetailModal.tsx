import { type ReactNode, useEffect } from "react";
import clsx from "clsx";
import type { JsonObject, JsonValue } from "@bufbuild/protobuf";

import type { ActivityEntry } from "@/protoFleet/api/generated/activity/v1/activity_pb";
import type { GetCommandBatchDeviceResultsResponse } from "@/protoFleet/api/generated/minercommand/v1/command_pb";
import { useCommandBatchDeviceResults } from "@/protoFleet/api/useCommandBatchDeviceResults";
import { POLL_INTERVAL_MS } from "@/protoFleet/constants/polling";
import { baseEventType, isCompletedEvent } from "@/protoFleet/features/activity/utils/eventType";
import { formatLabel } from "@/protoFleet/features/activity/utils/formatLabel";
import { formatScope } from "@/protoFleet/features/activity/utils/formatScope";
import { Alert, Info } from "@/shared/assets/icons";
import Modal from "@/shared/components/Modal";
import ProgressCircular from "@/shared/components/ProgressCircular";
import StatusCircle from "@/shared/components/StatusCircle";
import { formatActivityTimestamp } from "@/shared/utils/formatTimestamp";

interface ActivityDetailModalProps {
  entry: ActivityEntry | null;
  onDismiss: () => void;
}

function SummaryRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-text-primary-50">{label}</span>
      <span className={clsx("text-right text-text-primary", className)}>{children}</span>
    </div>
  );
}

type MetadataRow = {
  label: string;
  value: ReactNode;
};

const hiddenMetadataKeys = new Set([
  "cohort_id",
  "device_identifier",
  "device_identifiers",
  "idempotency_key",
  "label",
  "rig_uuid",
  "rig_uuids",
]);

const cohortMetadataLabels: Record<string, string> = {
  update_kind: "Update kind",
  old_expires_at: "Expiry before",
  new_expires_at: "Expiry after",
  old_firmware_file_id: "Firmware before",
  new_firmware_file_id: "Firmware after",
  affected_member_count: "Affected miners",
  desired_config_changed: "Config changed",
  desired_config_cleared: "Config cleared",
};

function metadataRows(entry: ActivityEntry, hasBatch: boolean): MetadataRow[] {
  if (hasBatch || !entry.metadata) return [];
  if (baseEventType(entry.eventType) === "cohort_updated") {
    return cohortUpdateMetadataRows(entry.metadata);
  }
  return genericMetadataRows(entry.metadata);
}

function cohortUpdateMetadataRows(metadata: JsonObject): MetadataRow[] {
  const rows: MetadataRow[] = [];
  addMetadataRow(rows, "Update kind", formatLabel(stringMetadataValue(metadata.update_kind)));
  addMetadataRow(rows, "Expiry before", formatTimestampMetadataValue(metadata.old_expires_at));
  addMetadataRow(rows, "Expiry after", formatTimestampMetadataValue(metadata.new_expires_at));
  addMetadataRow(
    rows,
    "Target",
    [stringMetadataValue(metadata.manufacturer), stringMetadataValue(metadata.model)].filter(Boolean).join(" "),
  );
  addMetadataRow(rows, "Firmware before", formatNullableMetadataValue(metadata.old_firmware_file_id));
  addMetadataRow(rows, "Firmware after", formatNullableMetadataValue(metadata.new_firmware_file_id));
  addMetadataRow(rows, "Affected miners", formatMinerCount(metadata.affected_member_count));
  addMetadataRow(rows, "Config changed", formatBooleanMetadataValue(metadata.desired_config_changed));
  addMetadataRow(rows, "Config cleared", formatBooleanMetadataValue(metadata.desired_config_cleared));
  return rows;
}

function genericMetadataRows(metadata: JsonObject): MetadataRow[] {
  return Object.entries(metadata).flatMap(([key, value]) => {
    if (hiddenMetadataKeys.has(key) || Array.isArray(value) || isJsonObject(value)) return [];
    return [{ label: cohortMetadataLabels[key] ?? formatLabel(key), value: formatGenericMetadataValue(value) }];
  });
}

function addMetadataRow(rows: MetadataRow[], label: string, value: ReactNode) {
  if (value == null || value === "") return;
  rows.push({ label, value });
}

function stringMetadataValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function formatTimestampMetadataValue(value: JsonValue | undefined): string {
  if (typeof value !== "string") return "";
  const seconds = Date.parse(value) / 1000;
  if (!Number.isFinite(seconds)) return value;
  return formatActivityTimestamp(seconds);
}

function formatNullableMetadataValue(value: JsonValue | undefined): string {
  if (value == null) return "None";
  if (typeof value === "string" && value.trim() !== "") return value;
  return "";
}

function formatMinerCount(value: JsonValue | undefined): string {
  if (typeof value !== "number") return "";
  return `${value} ${value === 1 ? "miner" : "miners"}`;
}

function formatBooleanMetadataValue(value: JsonValue | undefined): string {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : "";
}

function formatGenericMetadataValue(value: JsonValue | undefined): ReactNode {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (value == null) return "None";
  return "";
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ActivityDetailModal = ({ entry, onDismiss }: ActivityDetailModalProps) => {
  const batchId = entry?.batchId;
  const { fetch, getResult } = useCommandBatchDeviceResults({
    activeBatchId: batchId,
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (batchId) {
      void fetch(batchId);
    }
  }, [batchId, fetch]);

  if (!entry) return null;

  const displayEventType = baseEventType(entry.eventType);
  const detailMetadataRows = metadataRows(entry, batchId != null);
  const batchState = batchId ? getResult(batchId) : null;
  const batchData = batchState?.data;
  const batchInProgress =
    (batchId != null && batchData == null && !isCompletedEvent(entry.eventType)) ||
    (batchData != null && batchData.status !== "finished" && !batchData.detailsPruned);
  const isFailed =
    batchData != null && !batchInProgress && !batchData.detailsPruned
      ? batchData.failureCount > 0
      : entry.result === "failure";

  return (
    <Modal title="Actions" onDismiss={onDismiss}>
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-surface-10">
          <div className="pb-3">
            <SummaryRow label="Event">{formatLabel(displayEventType)}</SummaryRow>
            <SummaryRow label="Timestamp">{formatActivityTimestamp(Number(entry.createdAt?.seconds))}</SummaryRow>
            <SummaryRow label="Scope">
              {formatScope(entry.scopeType, entry.scopeLabel, entry.scopeCount || undefined)}
            </SummaryRow>
            <SummaryRow label="User">{entry.username ?? "—"}</SummaryRow>
            <SummaryRow label="Result">
              <span className="inline-flex items-center gap-1.5">
                <StatusCircle
                  status={batchInProgress ? "pending" : isFailed ? "error" : "normal"}
                  variant="simple"
                  width="w-1.5"
                  removeMargin
                />
                {batchInProgress ? "In progress" : isFailed ? "Failure" : "Success"}
              </span>
            </SummaryRow>
            {entry.errorMessage ? (
              <SummaryRow label="Error" className="text-intent-critical">
                {entry.errorMessage}
              </SummaryRow>
            ) : null}
          </div>

          {batchData && !batchData.detailsPruned ? (
            <div className="py-3">
              <SummaryRow label="Succeeded">
                {batchData.successCount} {batchData.successCount === 1 ? "miner" : "miners"}
              </SummaryRow>
              <SummaryRow label="Failed">
                {batchData.failureCount} {batchData.failureCount === 1 ? "miner" : "miners"}
              </SummaryRow>
            </div>
          ) : null}

          {detailMetadataRows.length > 0 ? (
            <div className="py-3">
              {detailMetadataRows.map((row) => (
                <SummaryRow key={row.label} label={row.label}>
                  {row.value}
                </SummaryRow>
              ))}
            </div>
          ) : null}
        </div>

        {batchId ? (
          <BatchDeviceResults
            isLoading={batchState?.isLoading ?? false}
            error={batchState?.error ?? null}
            data={batchData ?? null}
          />
        ) : null}
      </div>
    </Modal>
  );
};

function BatchDeviceResults({
  isLoading,
  error,
  data,
}: {
  isLoading: boolean;
  error: string | null;
  data: GetCommandBatchDeviceResultsResponse | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <ProgressCircular indeterminate />
      </div>
    );
  }

  if (!data) {
    return error ? (
      <div className="text-intent-critical flex items-center gap-2 text-200">
        <Alert width="w-3.5" />
        <span>{error}</span>
      </div>
    ) : null;
  }

  if (data.detailsPruned) {
    return (
      <div className="flex items-center gap-2 text-200 text-text-primary-50">
        <Info width="w-3.5" />
        <span>Per-miner details are no longer available.</span>
      </div>
    );
  }

  const isPending = data.status === "pending" || data.status === "processing";
  if (isPending && data.deviceResults.length === 0) {
    return <div className="text-200 text-text-primary-50">Results will appear as devices complete.</div>;
  }

  if (data.deviceResults.length === 0) return null;

  return (
    <>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-surface-10">
        <table className="w-full text-200">
          <thead className="sticky top-0 bg-surface-5 text-left text-text-primary-50">
            <tr>
              <th className="px-3 py-2 font-medium">Miner</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-10">
            {data.deviceResults.map((result) => (
              <tr key={result.deviceIdentifier} className="text-text-primary">
                <td className="px-3 py-2">
                  <div>{result.deviceName ?? result.deviceIdentifier}</div>
                  {result.macAddress || result.ipAddress ? (
                    <div className="text-100 font-mono text-text-primary-50">
                      {[result.macAddress, result.ipAddress].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td
                  className={clsx(
                    "px-3 py-2",
                    result.status === "success" ? "text-intent-success" : "text-intent-critical",
                  )}
                >
                  {result.status === "success" ? "Success" : "Failed"}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-text-primary-50">{result.errorMessage ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-text-primary-50">
                  {result.updatedAt ? formatActivityTimestamp(Number(result.updatedAt.seconds)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.truncated ? (
        <div className="text-200 text-text-primary-50">
          Showing first {data.deviceResults.length} of {data.totalCount} devices.
        </div>
      ) : null}
    </>
  );
}

export default ActivityDetailModal;

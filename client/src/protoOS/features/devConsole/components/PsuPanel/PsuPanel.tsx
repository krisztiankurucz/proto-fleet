import { useCallback, useMemo, useState } from "react";

import PsuCard from "./PsuCard";
import type { NotificationError } from "@/protoOS/api/generatedApi";
import { useErrors } from "@/protoOS/api/hooks/useErrors";
import { useHardware } from "@/protoOS/api/hooks/useHardware";
import { useMinerHosting } from "@/protoOS/contexts/MinerHostingContext";
import { useDevConsoleData } from "@/protoOS/features/devConsole/nats/DevConsoleDataContext";
import Button from "@/shared/components/Button";
import { variants } from "@/shared/components/Button";

const ERROR_POLL_INTERVAL_MS = 5000;

type UpdateState = "idle" | "loading" | "success" | "error";

function PsuPanel() {
  const { psuData } = useDevConsoleData();
  const { psusInfo } = useHardware();
  const { api } = useMinerHosting();
  const { data: allErrors } = useErrors({ poll: true, pollIntervalMs: ERROR_POLL_INTERVAL_MS });
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateMessage, setUpdateMessage] = useState<string>("");

  const handleUpdateFirmware = useCallback(async () => {
    if (!api) return;
    setUpdateState("loading");
    setUpdateMessage("");
    try {
      const res = await api.postUpdatePsu({});
      setUpdateState("success");
      setUpdateMessage(res.data.message ?? "Update scheduled for next reboot");
    } catch (err: unknown) {
      setUpdateState("error");
      const msg =
        err && typeof err === "object" && "error" in err
          ? (err as { error: { message?: string } }).error?.message
          : "Failed to schedule update";
      setUpdateMessage(msg ?? "Failed to schedule update");
    }
  }, [api]);

  const psuErrorsBySlot = useMemo(() => {
    const map = new Map<number, NotificationError[]>();
    if (!allErrors) return map;
    for (const err of allErrors) {
      if (err.source === "psu" && err.slot != null) {
        const existing = map.get(err.slot) ?? [];
        existing.push(err);
        map.set(err.slot, existing);
      }
    }
    return map;
  }, [allErrors]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant={variants.secondary}
          text={updateState === "loading" ? "Scheduling..." : "Update PSU Firmware"}
          onClick={handleUpdateFirmware}
          disabled={!api || updateState === "loading"}
          size="compact"
        />
        {updateMessage && (
          <span
            className={`text-200 ${updateState === "error" ? "text-intent-critical-fill" : "text-intent-success-fill"}`}
          >
            {updateMessage}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 laptop:grid-cols-3">
        {psuData.map((data, i) => (
          <PsuCard
            key={i + 1}
            psuId={i + 1}
            data={data}
            hwInfo={psusInfo?.[i] ?? null}
            apiErrors={psuErrorsBySlot.get(i + 1) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

export default PsuPanel;

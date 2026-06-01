import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTelemetry, useTimeSeries } from "@/protoOS/api";
import { HashboardFieldType, MinerFieldType } from "@/protoOS/api/generatedApi";
import NoPoolsCallout from "@/protoOS/components/NoPoolsCallout";
import { getNoPoolsCalloutState } from "@/protoOS/components/NoPoolsCallout/utility";
import TabMenu from "@/protoOS/features/kpis/components/TabMenu";
import { useNatsAvailability } from "@/protoOS/nats";
import { usePoolsInfo } from "@/protoOS/store";
import { useDuration, useSetDuration } from "@/protoOS/store";
import DurationSelector, { durations } from "@/shared/components/DurationSelector";
import ErrorBoundary from "@/shared/components/ErrorBoundary";

const KpiLayout = () => {
  const poolsInfo = usePoolsInfo();
  const duration = useDuration();
  const setDuration = useSetDuration();
  const { pathname } = useLocation();

  const natsAvailability = useNatsAvailability();
  const streamingActive = natsAvailability === "available";

  // Only expose the live "1m" view when NATS can feed it.
  const availableDurations = useMemo(
    () => (streamingActive ? durations : durations.filter((d) => d !== "1m")),
    [streamingActive],
  );

  // If NATS drops while the user is on "1m", fall back to a duration backed by REST history.
  useEffect(() => {
    if (!streamingActive && duration === "1m") {
      setDuration("1h");
    }
  }, [streamingActive, duration, setDuration]);

  // When NATS is feeding live data, skip the API poll loops — useTimeSeries
  // still fires a one-shot fetch on mount and on duration change for history.
  useTelemetry({ level: ["miner"], poll: !streamingActive });

  // Memoize levels to prevent recreating on every render
  const levels = useMemo(
    () => [
      {
        type: "miner" as const,
        fields: [MinerFieldType.Hashrate, MinerFieldType.Power, MinerFieldType.Efficiency, MinerFieldType.Temperature],
      },
      {
        type: "hashboard" as const,
        fields: [
          HashboardFieldType.Hashrate,
          HashboardFieldType.Power,
          HashboardFieldType.Efficiency,
          HashboardFieldType.Temperature,
        ],
      },
    ],
    [],
  );

  // Fetch all time series data here for hashrate/eff/power/temperature in one request
  // Used by multiple KPI tabs
  useTimeSeries({
    duration,
    levels,
    poll: !streamingActive,
  });

  const { arePoolsConfigured, shouldShowNoPoolsCallout } = useMemo(
    () => getNoPoolsCalloutState(poolsInfo, pathname),
    [poolsInfo, pathname],
  );

  return (
    <ErrorBoundary>
      <div className="p-6 tablet:p-10 laptop:p-14">
        {shouldShowNoPoolsCallout ? <NoPoolsCallout arePoolsConfigured={arePoolsConfigured} /> : null}

        <div className="relative flex h-[calc(100vh-theme(spacing.36))] min-h-[800px] flex-col phone:min-h-[1000px]">
          <div className="flex items-center pb-6">
            <div className="grow text-heading-300">Home</div>
            <DurationSelector
              className="h-fit"
              duration={duration}
              durations={availableDurations}
              onSelect={setDuration}
            />
          </div>

          <div className="pb-6">
            <TabMenu />
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default KpiLayout;

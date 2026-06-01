import { useCallback, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";

import ConnectionStatusIndicator from "./ConnectionStatusIndicator";
import DevConsoleDataProvider from "@/protoOS/features/devConsole/nats/DevConsoleDataProvider";
import { useNatsAvailability } from "@/protoOS/nats";
import ProgressCircular from "@/shared/components/ProgressCircular";
import SegmentedControl from "@/shared/components/SegmentedControl";

const TAB_SEGMENTS = [
  { key: "hashboards", title: "Hashboards" },
  { key: "psu", title: "PSU" },
  { key: "io", title: "IO" },
  { key: "injection", title: "Injection" },
  { key: "messages", title: "Messages" },
];

function DevConsoleLayout() {
  const availability = useNatsAvailability();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = useMemo(() => {
    const path = location.pathname.split("/").pop() ?? "hashboards";
    return TAB_SEGMENTS.some((s) => s.key === path) ? path : "hashboards";
  }, [location.pathname]);

  const segments = useMemo(() => TAB_SEGMENTS, []);

  const handleTabSelect = useCallback(
    (key: string) => {
      navigate(key);
    },
    [navigate],
  );

  if (availability === "probing") {
    return (
      <div className="flex h-full items-center justify-center">
        <ProgressCircular indeterminate />
      </div>
    );
  }

  if (availability === "unavailable") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-body-200 text-text-secondary">
          Dev Console is not available. The NATS WebSocket server is not running.
        </p>
      </div>
    );
  }

  return (
    <DevConsoleDataProvider>
      <div className="flex h-full flex-col">
        <div className={clsx("flex items-center justify-between px-6 py-3")}>
          <div className="flex items-center gap-4">
            <h1 className="text-heading-200 text-text-primary">Dev Console</h1>
            <ConnectionStatusIndicator />
          </div>
          <SegmentedControl segments={segments} initialSegmentKey={currentTab} onSelect={handleTabSelect} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-6">
          <Outlet />
        </div>
      </div>
    </DevConsoleDataProvider>
  );
}

export default DevConsoleLayout;

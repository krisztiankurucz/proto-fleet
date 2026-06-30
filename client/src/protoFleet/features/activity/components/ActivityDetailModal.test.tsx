import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";

import ActivityDetailModal from "./ActivityDetailModal";
import { ActivityEntrySchema } from "@/protoFleet/api/generated/activity/v1/activity_pb";

vi.mock("@/protoFleet/api/useCommandBatchDeviceResults", () => ({
  useCommandBatchDeviceResults: () => ({
    fetch: vi.fn(),
    getResult: vi.fn(() => null),
  }),
}));

describe("ActivityDetailModal", () => {
  it("renders cohort update metadata with friendly labels", () => {
    const entry = create(ActivityEntrySchema, {
      eventId: "event-1",
      eventCategory: "fleet_management",
      eventType: "cohort_updated",
      description: "Updated cohort",
      scopeType: "cohort",
      scopeLabel: "Test cohort",
      actorType: "user",
      username: "admin",
      result: "success",
      createdAt: { seconds: 1_767_225_600n },
      metadata: {
        cohort_id: 42,
        label: "Test cohort",
        update_kind: "firmware_target_updated",
        manufacturer: "Proto",
        model: "Rig",
        old_firmware_file_id: "fw-old",
        new_firmware_file_id: "fw-new",
        affected_member_count: 2,
        idempotency_key: "do-not-render",
        device_identifiers: ["miner-1", "miner-2"],
      },
    });

    render(<ActivityDetailModal entry={entry} onDismiss={vi.fn()} />);

    expect(screen.getByText("Cohort updated")).toBeInTheDocument();
    expect(screen.getByText("Update kind")).toBeInTheDocument();
    expect(screen.getByText("Firmware target updated")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("Proto Rig")).toBeInTheDocument();
    expect(screen.getByText("Firmware before")).toBeInTheDocument();
    expect(screen.getByText("fw-old")).toBeInTheDocument();
    expect(screen.getByText("Firmware after")).toBeInTheDocument();
    expect(screen.getByText("fw-new")).toBeInTheDocument();
    expect(screen.getByText("Affected miners")).toBeInTheDocument();
    expect(screen.getByText("2 miners")).toBeInTheDocument();
    expect(screen.queryByText("do-not-render")).not.toBeInTheDocument();
    expect(screen.queryByText("miner-1")).not.toBeInTheDocument();
  });
});

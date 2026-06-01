import HashboardCard from "./HashboardCard";
import type { HashboardInfo } from "@/protoOS/api/generatedApi";
import { useHardware } from "@/protoOS/api/hooks/useHardware";

type SlottedHashboard = HashboardInfo & { slot: number };

const hasSlot = (hb: HashboardInfo | null): hb is SlottedHashboard => hb !== null && hb.slot !== undefined;

function HashboardsPanel() {
  const { hashboardsInfo, pending, error } = useHardware();

  if (pending) {
    return <div className="text-300 text-text-primary-50">Loading hardware info...</div>;
  }

  if (error) {
    return <div className="text-300 text-intent-critical-fill">Failed to load hardware: {error}</div>;
  }

  const hashboards: SlottedHashboard[] = hashboardsInfo?.filter(hasSlot) ?? [];

  if (hashboards.length === 0) {
    return <div className="text-300 text-text-primary-50">No hashboards detected</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {hashboards.map((hb) => (
        <HashboardCard key={hb.slot} slot={hb.slot} hwInfo={hb} />
      ))}
    </div>
  );
}

export default HashboardsPanel;

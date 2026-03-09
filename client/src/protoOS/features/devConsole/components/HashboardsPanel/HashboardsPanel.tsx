import { useHardware } from "@/protoOS/api/hooks/useHardware";
import Card from "@/protoOS/features/diagnostic/components/Card";
import CardHeader from "@/protoOS/features/diagnostic/components/CardHeader";

function InfoBadge({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-core-primary-10 px-2.5 py-1 text-200">
      <span className="text-text-primary-50">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}

function HashboardsPanel() {
  const { hashboardsInfo, pending, error } = useHardware();

  if (pending) {
    return <div className="text-300 text-text-primary-50">Loading hardware info...</div>;
  }

  if (error) {
    return <div className="text-300 text-intent-critical-fill">Failed to load hardware: {error}</div>;
  }

  const hashboards = hashboardsInfo?.filter((hb) => hb !== null) ?? [];

  if (hashboards.length === 0) {
    return <div className="text-300 text-text-primary-50">No hashboards detected</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 laptop:grid-cols-3">
      {hashboards.map((hb) => (
        <Card key={hb.slot}>
          <CardHeader title={`Hashboard ${hb.slot}`} />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <InfoBadge label="Board" value={hb.board} />
              <InfoBadge label="ASIC" value={hb.mining_asic?.toUpperCase()} />
              <InfoBadge label="Serial" value={hb.hb_sn} />
              <InfoBadge label="FW" value={hb.firmware?.version} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-300">
              <span className="text-text-primary-50">ASIC Count</span>
              <span className="text-text-primary">{hb.mining_asic_count ?? "---"}</span>
              <span className="text-text-primary-50">Temp Sensors</span>
              <span className="text-text-primary">{hb.temp_sensor_count ?? "---"}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default HashboardsPanel;

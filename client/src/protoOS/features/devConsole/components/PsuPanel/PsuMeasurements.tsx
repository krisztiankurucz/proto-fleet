import type { PsuMeasurement, PsuMeasurements } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PsuMeasurementType } from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import LabeledValue from "@/protoOS/features/diagnostic/components/LabeledValue/LabeledValue";

import { formatDecimals, getDivisor } from "./units";

const PLACEHOLDER = "---";

interface MeasurementConfig {
  type: PsuMeasurementType;
  label: string;
  displayUnit: string;
}

const OUTPUT_MEASUREMENTS: MeasurementConfig[] = [
  { type: PsuMeasurementType.OUTPUT_VOLTAGE, label: "Voltage", displayUnit: "V" },
  { type: PsuMeasurementType.OUTPUT_CURRENT, label: "Current", displayUnit: "A" },
  { type: PsuMeasurementType.OUTPUT_POWER, label: "Power", displayUnit: "W" },
];

const INPUT_MEASUREMENTS: MeasurementConfig[] = [
  { type: PsuMeasurementType.INPUT_VOLTAGE, label: "Voltage", displayUnit: "V" },
  { type: PsuMeasurementType.INPUT_CURRENT, label: "Current", displayUnit: "A" },
  { type: PsuMeasurementType.INPUT_POWER, label: "Power", displayUnit: "W" },
];

const TEMPERATURE_MEASUREMENTS: MeasurementConfig[] = [
  { type: PsuMeasurementType.HOTSPOT_TEMPERATURE, label: "Hotspot", displayUnit: "C" },
  { type: PsuMeasurementType.AMBIENT_TEMPERATURE, label: "Ambient", displayUnit: "C" },
  { type: PsuMeasurementType.AVERAGE_TEMPERATURE, label: "Average", displayUnit: "C" },
];

function getMeasurement(measurements: PsuMeasurements | null, type: PsuMeasurementType): PsuMeasurement | null {
  if (!measurements) return null;
  return measurements.measurements.find((m) => m.measurementType === type) ?? null;
}

function formatMeasurement(config: MeasurementConfig, measurements: PsuMeasurements | null): string {
  const m = getMeasurement(measurements, config.type);
  if (!m) return PLACEHOLDER;

  const divisor = getDivisor(m.unit);
  const converted = m.value / divisor;
  const suffix = config.displayUnit === "C" ? `\u00B0${config.displayUnit}` : config.displayUnit;
  const decimals = formatDecimals(divisor);
  return `${converted.toFixed(decimals)} ${suffix}`;
}

interface MeasurementGroupProps {
  title: string;
  configs: MeasurementConfig[];
  measurements: PsuMeasurements | null;
}

function MeasurementGroup({ title, configs, measurements }: MeasurementGroupProps) {
  return (
    <div>
      <div className="mb-2 text-200 font-medium text-text-primary-50">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {configs.map((config) => (
          <LabeledValue key={config.type} value={formatMeasurement(config, measurements)} label={config.label} />
        ))}
      </div>
    </div>
  );
}

interface PsuMeasurementsDisplayProps {
  measurements: PsuMeasurements | null;
}

function PsuMeasurementsDisplay({ measurements }: PsuMeasurementsDisplayProps) {
  return (
    <div className="flex flex-col gap-3">
      <MeasurementGroup title="Output" configs={OUTPUT_MEASUREMENTS} measurements={measurements} />
      <MeasurementGroup title="Input" configs={INPUT_MEASUREMENTS} measurements={measurements} />
      <MeasurementGroup title="Temperature" configs={TEMPERATURE_MEASUREMENTS} measurements={measurements} />
    </div>
  );
}

export default PsuMeasurementsDisplay;

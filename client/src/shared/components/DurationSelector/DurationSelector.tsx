import { useState } from "react";
import clsx from "clsx";

import Button from "@/shared/components/Button";
import { durations as defaultDurations } from "@/shared/components/DurationSelector/constants";

interface DurationSelectorProps<T extends string> {
  className?: string;
  duration?: T;
  durations?: readonly T[];
  onSelect?: (duration: T) => void;
}

function DurationSelector<T extends string>({
  className,
  duration,
  // Type assertion is safe here: when T is not provided explicitly, it defaults to Duration
  // (the type of defaultDurations), so the cast is valid. When T is provided explicitly
  // (e.g., FleetDuration), callers must also provide a matching durations array.
  durations = defaultDurations as unknown as readonly T[],
  onSelect,
}: DurationSelectorProps<T>) {
  // Controlled when `duration` is provided; falls back to local state otherwise.
  const [internalDuration, setInternalDuration] = useState<T>(duration ?? durations[0]);
  const selectedDuration = duration ?? internalDuration;

  const handleSelect = (d: T) => {
    setInternalDuration(d);
    onSelect && onSelect(d);
  };

  return (
    <div className={clsx("flex gap-1", className)}>
      {durations.map((d) => {
        const isSelected = d === selectedDuration;
        return (
          <Button
            key={d}
            variant={isSelected ? "primary" : "secondary"}
            size="compact"
            text={d}
            onClick={() => handleSelect(d)}
            className={clsx({ "hover:opacity-100!": isSelected })}
          />
        );
      })}
    </div>
  );
}

export default DurationSelector;

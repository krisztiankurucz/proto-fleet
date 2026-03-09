import { useMemo } from "react";

import type { LedState } from "@/protoOS/api/generated/nats/miner_ui_api_pb";

interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

interface LedIndicatorProps {
  color?: RGBColor;
  brightness?: number;
  setting?: LedState["setting"];
  label: string;
}

const MAX_BRIGHTNESS = 100;
const MAX_INPUT_CHANNEL = 100;
const MAX_OUTPUT_CHANNEL = 255;
const LED_SIZE = 20;
const OFF_COLOR = "#555";

const BLINK_ANIMATION = "led-blink 1s step-end infinite";
const BREATHE_ANIMATION = "led-breathe 2s ease-in-out infinite";
const HEARTBEAT_ANIMATION = "led-heartbeat 1.5s ease-in-out infinite";

const KEYFRAMES_STYLE = `
@keyframes led-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
@keyframes led-breathe {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
@keyframes led-heartbeat {
  0% { opacity: 0.3; }
  15% { opacity: 1; }
  30% { opacity: 0.3; }
  45% { opacity: 1; }
  60%, 100% { opacity: 0.3; }
}
`;

function getAnimation(setting?: LedState["setting"]): string | undefined {
  if (!setting?.case) return undefined;

  switch (setting.case) {
    case "blink":
      return BLINK_ANIMATION;
    case "breath":
      return BREATHE_ANIMATION;
    case "heartBeat":
      return HEARTBEAT_ANIMATION;
    default:
      return undefined;
  }
}

function getBrightness(setting?: LedState["setting"]): number {
  if (!setting?.case) return MAX_BRIGHTNESS;

  switch (setting.case) {
    case "brightness":
      return setting.value;
    case "blink":
      return setting.value.brightness;
    case "breath":
      return setting.value.startBrightness;
    case "heartBeat":
      return setting.value.brightness;
    default:
      return MAX_BRIGHTNESS;
  }
}

function scaleChannel(value: number): number {
  const scaled = Math.round((value / MAX_INPUT_CHANNEL) * MAX_OUTPUT_CHANNEL);
  return Math.min(MAX_OUTPUT_CHANNEL, Math.max(0, scaled));
}

function LedIndicator({ color, brightness, setting, label }: LedIndicatorProps) {
  const resolvedBrightness = brightness ?? getBrightness(setting);
  const animation = useMemo(() => getAnimation(setting), [setting]);

  const ledColor = useMemo(() => {
    if (!color) return OFF_COLOR;
    const r = scaleChannel(color.red);
    const g = scaleChannel(color.green);
    const b = scaleChannel(color.blue);
    return `rgb(${r}, ${g}, ${b})`;
  }, [color]);

  const glowSize = Math.round(14 * (resolvedBrightness / MAX_BRIGHTNESS));

  return (
    <>
      <style>{KEYFRAMES_STYLE}</style>
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 rounded-full border border-white/20"
          style={{
            width: LED_SIZE,
            height: LED_SIZE,
            backgroundColor: ledColor,
            boxShadow: color
              ? [
                  `inset 0 0 4px rgba(255,255,255,0.3)`,
                  `0 0 ${glowSize}px ${ledColor}`,
                  `0 0 ${glowSize * 2}px ${ledColor}80`,
                ].join(", ")
              : undefined,
            animation,
          }}
        />
        <span className="text-300 text-text-primary">{label}</span>
      </div>
    </>
  );
}

export default LedIndicator;

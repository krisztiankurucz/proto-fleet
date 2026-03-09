import { useMemo } from "react";

interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

interface SevenSegmentDisplayProps {
  value?: string;
  color?: RGBColor;
  brightness?: number;
}

const MAX_BRIGHTNESS = 100;
const MAX_INPUT_CHANNEL = 100;
const MAX_OUTPUT_CHANNEL = 255;

const SEGMENT_POLYGONS: Record<string, string> = {
  a: "10,5 50,5 45,12 15,12",
  b: "52,8 52,45 47,42 47,14",
  c: "52,55 52,92 47,86 47,58",
  d: "10,95 50,95 45,88 15,88",
  e: "8,55 8,92 13,86 13,58",
  f: "8,8 8,45 13,42 13,14",
  g: "10,48 50,48 47,52 13,52",
};

const DECIMAL_POINT = { cx: 56, cy: 94, r: 4 };

const OFF_COLOR = "rgb(30, 30, 30)";

const CHARACTER_SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  A: "abcefg",
  B: "cdefg",
  C: "adef",
  D: "bcdeg",
  E: "adefg",
  F: "aefg",
  " ": "",
  "-": "g",
  _: "d",
};

function scaleChannel(value: number): number {
  return Math.min(MAX_OUTPUT_CHANNEL, Math.round((value / MAX_INPUT_CHANNEL) * MAX_OUTPUT_CHANNEL));
}

function getOnColor(color: RGBColor, brightness: number): string {
  const scale = brightness / MAX_BRIGHTNESS;
  const r = Math.round(scaleChannel(color.red) * scale);
  const g = Math.round(scaleChannel(color.green) * scale);
  const b = Math.round(scaleChannel(color.blue) * scale);
  return `rgb(${r}, ${g}, ${b})`;
}

function SevenSegmentDisplay({
  value = " ",
  color = { red: 100, green: 0, blue: 0 },
  brightness = MAX_BRIGHTNESS,
}: SevenSegmentDisplayProps) {
  const activeSegments = useMemo(() => {
    const char = value.toUpperCase();
    return CHARACTER_SEGMENTS[char] ?? "";
  }, [value]);

  const onColor = useMemo(() => getOnColor(color, brightness), [color, brightness]);

  return (
    <svg viewBox="0 0 60 100" width="60" height="100">
      {Object.entries(SEGMENT_POLYGONS).map(([id, points]) => (
        <polygon key={id} points={points} fill={activeSegments.includes(id) ? onColor : OFF_COLOR} />
      ))}
      <circle
        cx={DECIMAL_POINT.cx}
        cy={DECIMAL_POINT.cy}
        r={DECIMAL_POINT.r}
        fill={value === "." ? onColor : OFF_COLOR}
      />
    </svg>
  );
}

export default SevenSegmentDisplay;

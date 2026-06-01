import { type DescMessage, fromBinary, toJsonString } from "@bufbuild/protobuf";

import { BayStatusSchema, MiningStatusSchema } from "@/protoOS/api/generated/nats/miner_data_api_pb";
import { ErrorListSchema } from "@/protoOS/api/generated/nats/miner_error_code_pb";
import {
  AsicOperatingStatsSchema,
  HashboardControlSchema,
  HashboardOperatingStatsSchema,
  HashboardSimControlSchema,
  HashboardStatusSchema,
  ShareSchema,
} from "@/protoOS/api/generated/nats/miner_hb_api_pb";
import {
  PsuErrorsSchema,
  PsuInfoMsgSchema,
  PsuMeasurementsSchema,
  PsuStatusMsgSchema,
} from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import { PsuTestInjectSchema } from "@/protoOS/api/generated/nats/miner_psu_test_api_pb";
import {
  ButtonEventSchema,
  LedClearSchema,
  LedPlaySchema,
  LedStatusSchema,
} from "@/protoOS/api/generated/nats/miner_ui_api_pb";

interface SubjectPattern {
  match: (subject: string) => boolean;
  schema: DescMessage;
  label: string;
}

const EXACT_SUBJECTS: Record<string, { schema: DescMessage; label: string }> = {
  "mining.status": { schema: MiningStatusSchema, label: "MiningStatus" },
  "ui.led.status": { schema: LedStatusSchema, label: "LedStatus" },
  "ui.led.play": { schema: LedPlaySchema, label: "LedPlay" },
  "ui.led.clear": { schema: LedClearSchema, label: "LedClear" },
  "ui.button.event": { schema: ButtonEventSchema, label: "ButtonEvent" },
};

const PATTERN_SUBJECTS: SubjectPattern[] = [
  { match: (s) => /^psu\.\d+\.data$/.test(s), schema: PsuMeasurementsSchema, label: "PsuMeasurements" },
  { match: (s) => /^psu\.\d+\.status$/.test(s), schema: PsuStatusMsgSchema, label: "PsuStatusMsg" },
  { match: (s) => /^psu\.\d+\.info$/.test(s), schema: PsuInfoMsgSchema, label: "PsuInfoMsg" },
  { match: (s) => /^psu\.\d+\.error$/.test(s), schema: PsuErrorsSchema, label: "PsuErrors" },
  { match: (s) => /^psu\.\d+\.control$/.test(s), schema: PsuStatusMsgSchema, label: "PsuControl" },
  { match: (s) => /^psu\.\d+\.test$/.test(s), schema: PsuTestInjectSchema, label: "PsuTestInject" },
  { match: (s) => /^bay\.\d+\.status$/.test(s), schema: BayStatusSchema, label: "BayStatus" },
  { match: (s) => /^hashboard\.\d+\.status$/.test(s), schema: HashboardStatusSchema, label: "HashboardStatus" },
  { match: (s) => /^hashboard\.\d+\.share$/.test(s), schema: ShareSchema, label: "Share" },
  {
    match: (s) => /^hashboard\.\d+\.data\.board$/.test(s),
    schema: HashboardOperatingStatsSchema,
    label: "HashboardOperatingStats",
  },
  {
    match: (s) => /^hashboard\.\d+\.data\.asic$/.test(s),
    schema: AsicOperatingStatsSchema,
    label: "AsicOperatingStats",
  },
  {
    match: (s) => /^hashboard\.\d+\.control$/.test(s),
    schema: HashboardControlSchema,
    label: "HashboardControl",
  },
  {
    match: (s) => /^hashboard\.\d+\.test$/.test(s),
    schema: HashboardSimControlSchema,
    label: "HashboardSimControl",
  },
  { match: (s) => /\.error$/.test(s), schema: ErrorListSchema, label: "ErrorList" },
];

export interface DecodedMessage {
  label: string;
  json: string;
}

export function tryDecodeMessage(subject: string, data: Uint8Array): DecodedMessage | null {
  if (data.length === 0) return null;

  const exact = EXACT_SUBJECTS[subject];
  if (exact) {
    return decodeWithSchema(exact.schema, exact.label, data);
  }

  for (const pattern of PATTERN_SUBJECTS) {
    if (pattern.match(subject)) {
      return decodeWithSchema(pattern.schema, pattern.label, data);
    }
  }

  return null;
}

function decodeWithSchema(schema: DescMessage, label: string, data: Uint8Array): DecodedMessage | null {
  try {
    const msg = fromBinary(schema, data);
    const json = toJsonString(schema, msg, { prettySpaces: 2, enumAsInteger: false });
    return { label, json };
  } catch {
    return null;
  }
}

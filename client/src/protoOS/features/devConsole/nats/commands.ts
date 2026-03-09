import { create, toBinary } from "@bufbuild/protobuf";
import type { NatsConnection } from "@nats-io/nats-core";

import { MetricUnit } from "@/protoOS/api/generated/nats/miner_common_api_pb";
import {
  PsuControl_ClearErrorSchema,
  PsuControl_LockVoltageSchema,
  PsuControl_OutputEnableSchema,
  PsuControl_ResetRecoveryLimitsSchema,
  PsuControl_SetOutputVoltageSchema,
  PsuControlSchema,
  type PsuErrorCode,
  PsuMeasurementSchema,
  type PsuMeasurementType,
} from "@/protoOS/api/generated/nats/miner_psu_api_pb";
import {
  ClearInjectionsSchema,
  InjectErrorSchema,
  InjectMeasurementSchema,
  PsuTestInjectSchema,
} from "@/protoOS/api/generated/nats/miner_psu_test_api_pb";
import {
  ButtonEventSchema,
  type ButtonEventType,
  LedClearSchema,
  LedPlaySchema,
  type LedSeqName,
} from "@/protoOS/api/generated/nats/miner_ui_api_pb";

// The measurement's unit is context-dependent; MILLI is used as default for voltage (millivolts)
const DEFAULT_MEASUREMENT_UNIT = MetricUnit.MILLI;

export function publishPsuEnable(nc: NatsConnection, psuId: number, enable: boolean): void {
  const msg = create(PsuControlSchema, {
    cmd: {
      case: "enable",
      value: create(PsuControl_OutputEnableSchema, { enable }),
    },
  });
  nc.publish(`psu.${psuId}.control`, toBinary(PsuControlSchema, msg));
}

export function publishPsuSetVoltage(nc: NatsConnection, psuId: number, voltageMv: number): void {
  const msg = create(PsuControlSchema, {
    cmd: {
      case: "setOutputVoltage",
      value: create(PsuControl_SetOutputVoltageSchema, { outputVoltageMv: voltageMv }),
    },
  });
  nc.publish(`psu.${psuId}.control`, toBinary(PsuControlSchema, msg));
}

export function publishPsuClearError(nc: NatsConnection, psuId: number): void {
  const msg = create(PsuControlSchema, {
    cmd: {
      case: "clearError",
      value: create(PsuControl_ClearErrorSchema, {}),
    },
  });
  nc.publish(`psu.${psuId}.control`, toBinary(PsuControlSchema, msg));
}

export function publishPsuLockVoltage(nc: NatsConnection, psuId: number, lock: boolean): void {
  const msg = create(PsuControlSchema, {
    cmd: {
      case: "lockVoltage",
      value: create(PsuControl_LockVoltageSchema, { lock }),
    },
  });
  nc.publish(`psu.${psuId}.control`, toBinary(PsuControlSchema, msg));
}

export function publishPsuResetRecoveryLimits(nc: NatsConnection, psuId: number): void {
  const msg = create(PsuControlSchema, {
    cmd: {
      case: "resetRecoveryLimits",
      value: create(PsuControl_ResetRecoveryLimitsSchema, {}),
    },
  });
  nc.publish(`psu.${psuId}.control`, toBinary(PsuControlSchema, msg));
}

export function publishLedPlay(nc: NatsConnection, ledSeqName: LedSeqName, persist: boolean): void {
  const msg = create(LedPlaySchema, { ledSeqName, persist });
  nc.publish("ui.led.play", toBinary(LedPlaySchema, msg));
}

export function publishLedClear(nc: NatsConnection): void {
  const msg = create(LedClearSchema, {});
  nc.publish("ui.led.clear", toBinary(LedClearSchema, msg));
}

export function publishButtonEvent(nc: NatsConnection, eventType: ButtonEventType): void {
  const msg = create(ButtonEventSchema, { eventType });
  nc.publish("ui.button.event", toBinary(ButtonEventSchema, msg));
}

export function publishInjectError(
  nc: NatsConnection,
  psuId: number,
  errorCode: PsuErrorCode,
  persistent: boolean,
): void {
  const msg = create(PsuTestInjectSchema, {
    cmd: {
      case: "injectError",
      value: create(InjectErrorSchema, { errorCode, persistent }),
    },
  });
  nc.publish(`psu.${psuId}.test`, toBinary(PsuTestInjectSchema, msg));
}

export function publishInjectMeasurement(
  nc: NatsConnection,
  psuId: number,
  measurementType: PsuMeasurementType,
  value: number,
  persistent: boolean,
): void {
  const msg = create(PsuTestInjectSchema, {
    cmd: {
      case: "injectMeasurement",
      value: create(InjectMeasurementSchema, {
        measurement: create(PsuMeasurementSchema, {
          measurementType,
          value,
          unit: DEFAULT_MEASUREMENT_UNIT,
        }),
        persistent,
      }),
    },
  });
  nc.publish(`psu.${psuId}.test`, toBinary(PsuTestInjectSchema, msg));
}

export function publishClearInjections(
  nc: NatsConnection,
  psuId: number,
  clearErrors: boolean,
  clearMeasurements: boolean,
): void {
  const msg = create(PsuTestInjectSchema, {
    cmd: {
      case: "clearInjections",
      value: create(ClearInjectionsSchema, {
        errors: clearErrors,
        measurements: clearMeasurements,
      }),
    },
  });
  nc.publish(`psu.${psuId}.test`, toBinary(PsuTestInjectSchema, msg));
}

export interface DiagnosticsStreamHashboard {
  hashrate?: number;
  power?: number;
  efficiency?: number;
  boardTempAvg?: number;
  boardTempMin?: number;
  boardTempMax?: number;
  boardTempInlet?: number;
  boardTempOutlet?: number;
  asics?: { index: number; temperature: number; hashRate: number; voltage: number; frequency: number }[];
}

export interface DiagnosticsStreamPsu {
  inputVoltage?: number;
  outputVoltage?: number;
  inputCurrent?: number;
  outputCurrent?: number;
  inputPower?: number;
  outputPower?: number;
  temperatureAverage?: number;
  temperatureHotspot?: number;
  temperatureAmbient?: number;
}

export interface DiagnosticsStreamFan {
  rpm: number;
  connected: boolean;
}

export interface DiagnosticsStreamPayload {
  datetime: number;
  hashboards: Map<string, DiagnosticsStreamHashboard>;
  psus: Map<number, DiagnosticsStreamPsu>;
  fans: Map<number, DiagnosticsStreamFan>;
}

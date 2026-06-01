import type { HashboardOperatingStats } from "@/protoOS/api/generated/nats/miner_hb_api_pb";

export interface StreamingMetrics {
  hashrateThs: number;
  powerW: number;
  efficiencyJTh: number;
  temperatureC: number;
}

export interface StreamingPoint {
  datetime: number;
  miner: StreamingMetrics;
  hashboards: Map<number, StreamingMetrics>;
}

export interface StreamingSourceState {
  hashboardStats: Map<number, HashboardOperatingStats>;
  psuInputPowerW: Map<number, number>;
}

function hashboardMetricsFromStats(stats: HashboardOperatingStats): StreamingMetrics {
  return {
    hashrateThs: stats.boardHashrate,
    powerW: stats.boardPower,
    efficiencyJTh: stats.boardEfficiency,
    temperatureC: stats.boardTemps?.max ?? stats.boardTemps?.average ?? 0,
  };
}

/**
 * Aggregate the latest per-hashboard + per-PSU snapshot into a single chart point.
 * Returns null when no hashboard data has arrived yet.
 *
 * Miner-level metrics:
 *   hashrate    = Σ boardHashrate (across hashboards)
 *   power       = Σ PSU INPUT_POWER (wall power); falls back to Σ boardPower when no PSU data
 *   temperature = max(boardTemps.max) across hashboards
 *   efficiency  = power / hashrate (J/TH)
 */
export function aggregateStreamingPoint(state: StreamingSourceState, now: number): StreamingPoint | null {
  if (state.hashboardStats.size === 0) return null;

  const hashboards = new Map<number, StreamingMetrics>();
  let totalHashrate = 0;
  let totalBoardPower = 0;
  let maxTemp = -Infinity;

  state.hashboardStats.forEach((stats, slot) => {
    const m = hashboardMetricsFromStats(stats);
    hashboards.set(slot, m);
    totalHashrate += m.hashrateThs;
    totalBoardPower += m.powerW;
    if (m.temperatureC > maxTemp) maxTemp = m.temperatureC;
  });

  let totalPsuPower = 0;
  state.psuInputPowerW.forEach((w) => {
    totalPsuPower += w;
  });

  const powerW = totalPsuPower > 0 ? totalPsuPower : totalBoardPower;
  const efficiencyJTh = totalHashrate > 0 ? powerW / totalHashrate : 0;
  const temperatureC = maxTemp === -Infinity ? 0 : maxTemp;

  return {
    datetime: now,
    miner: {
      hashrateThs: totalHashrate,
      powerW,
      efficiencyJTh,
      temperatureC,
    },
    hashboards,
  };
}

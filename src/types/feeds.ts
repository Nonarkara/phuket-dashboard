export interface CoralWatchData {
  date: string;
  sstMax: number;
  dhw: number;
  baa: number;
  baaLabel: string;
  baaColor: "green" | "yellow" | "orange" | "red" | "maroon";
  isGovernorEvent: boolean;
  governorMessage: string;
  source: "NOAA Coral Reef Watch";
}

export type BeachFlag = "green" | "yellow" | "red";

export interface MarineConditions {
  waveHeightM: number;
  swellHeightM: number;
  currentVelocityMs: number;
  waveDirectionDeg: number;
  wavePeriodSec: number;
  beachFlag: BeachFlag;
  beachFlagReason: string;
  forecastHourly: Array<{
    time: string;
    waveHeight: number;
    swellHeight: number;
    currentVelocity: number;
  }>;
  observedAt: string;
  source: "Open-Meteo Marine";
}

export type RiskBand = "low" | "elevated" | "high";

export interface AccidentRiskPoint {
  ts: string;
  hour: number;
  risk: number; // 0-100 index
  riskLow?: number; // p10 / lower uncertainty bound
  riskHigh?: number; // p90 / upper uncertainty bound
  rainMm: number;
  band: RiskBand;
}

/** Per-corridor forecast — rain sensitivity scaled by the corridor's real SRTM slope. */
export interface CorridorForecast {
  slopeDeg: number;
  rainSensitivity: number; // the rain-coupling k actually used
  peak: AccidentRiskPoint;
  points: AccidentRiskPoint[];
}

export interface AccidentForecast {
  generatedAt: string;
  horizonHours: number;
  model: string; // e.g. "TimesFM 2.0 (...) · TimesFM quantile band"
  source: string;
  peakWindow: {
    ts: string;
    hour: number;
    risk: number;
    riskLow?: number;
    riskHigh?: number;
    rainMm: number;
  };
  points: AccidentRiskPoint[];
  /** Keyed by corridor label: "Patong" | "Old Town" | "Airport north". */
  corridors?: Record<string, CorridorForecast>;
}

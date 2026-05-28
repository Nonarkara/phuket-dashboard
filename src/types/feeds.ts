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
  rainMm: number;
  band: RiskBand;
}

export interface AccidentForecast {
  generatedAt: string;
  horizonHours: number;
  model: string; // e.g. "TimesFM 2.0 (...)"
  source: string;
  peakWindow: { ts: string; hour: number; risk: number; rainMm: number };
  points: AccidentRiskPoint[];
}

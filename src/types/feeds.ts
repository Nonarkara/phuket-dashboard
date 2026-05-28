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

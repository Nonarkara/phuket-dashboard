// ─── Nakhon Si Thammarat (NST) Watershed Dashboard Types ────────
// Water-first war room: the whole system that delivers water to the
// city — Khao Luang catchment, Khlong Tha Di, the Tha Ngiu split, the
// city channels, and the tidal outlets to the Gulf of Thailand.

export type { CctvFeedResponse, CctvSlot, CctvSlotStatus } from "./cctv";

export type NstScenarioId = "red-monsoon-day" | "stable-recovery-day" | "tourism-surge-weekend";

export type WaterStatus = "normal" | "watch" | "warning" | "critical";
export type NodeKind = "catchment" | "gauge" | "split" | "gate" | "city" | "outlet";
export type Branch = "main" | "city" | "north" | "south";

export interface NstNodeState {
  id: string;
  name: string;
  nameTh: string;
  kind: NodeKind;
  branch: Branch;
  order: number; // upstream -> downstream sequence
  lon: number;
  lat: number;
  onNetwork: boolean; // false = live station not on the traced network
  district: string;
  waterLevelMsl: number | null;
  bankLevelMsl: number | null;
  capacityPct: number | null;
  rainfall24h: number | null;
  discharge: number | null; // m3/s
  status: WaterStatus;
  trend: "rising" | "falling" | "stable";
  agency: string;
  observedAt: string;
  note: string;
}

export interface NstReachState {
  id: string;
  name: string;
  branch: Branch;
  order: number;
  fromNode: string;
  toNode: string;
  path: [number, number][];
  lengthKm: number;
  discharge: number; // m3/s carried
  velocity: number; // m/s
  travelHours: number;
  status: WaterStatus;
  designCapacity: number | null; // m3/s channel capacity where known
}

export interface NstOutletState {
  id: string;
  name: string;
  lon: number;
  lat: number;
  seaLevelM: number; // MSL, tide + surge
  tideState: "rising" | "falling" | "high" | "low";
  constrained: boolean; // outlet cannot pass full discharge
  note: string;
}

export interface NstZoneState {
  id: string;
  name: string;
  nameTh: string;
  fillOrder: number;
  elevationM: number;
  outlet: string;
  polygon: [number, number][];
  status: "dry" | "watch" | "ponding" | "flooded";
  etaHours: number | null;
  note: string;
}

export interface NstStage {
  step: number;
  id: string;
  title: string;
  detail: string;
  metric: string;
  state: "clear" | "watch" | "active" | "alert";
  etaHours: number | null;
}

export interface NstRouting {
  catchmentRain24h: number;
  thaDiDischarge: number;
  thaDiCapacityPct: number;
  cityChannelCapacity: number; // m3/s the city channel can pass
  diversionOpen: boolean;
  split: { north: number; city: number; south: number }; // fractions of Tha Di flow
  cityEtaHours: number | null;
  cityArrivalAt: string | null;
  posture: "normal" | "elevated" | "severe";
  headline: string;
  stages: NstStage[];
}

export interface NstWatershedResponse {
  generatedAt: string;
  source: "live" | "scenario" | "modeled";
  attribution: string;
  nodes: NstNodeState[];
  reaches: NstReachState[];
  outlets: NstOutletState[];
  zones: NstZoneState[];
  routing: NstRouting;
  stationsReporting: number;
  stationsWarning: number;
}

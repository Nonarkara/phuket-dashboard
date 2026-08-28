// ─── Lopburi Dashboard Types ────────────────────────────────────
// Self-contained type surface for the Lopburi province war room.
// Mirrors the Phuket dashboard format: left social-listening bar,
// center operational map, right FloodDash panel, CCTV slot strip.

export type LopburiScenarioId =
  | "red-monsoon-day"
  | "stable-recovery-day"
  | "tourism-surge-weekend";

export type FloodStationStatus = "normal" | "watch" | "warning" | "critical";

export interface LopburiFloodStation {
  id: string;
  name: string;
  river: string | null;
  district: string;
  lat: number;
  lon: number;
  waterLevelMsl: number; // meters above MSL
  bankLevelMsl: number; // min bank elevation (critical threshold)
  capacityPct: number; // % of bank capacity used
  status: FloodStationStatus;
  trend: "rising" | "falling" | "stable";
  rainfall24h: number; // mm
  discharge: number | null; // m3/s
  agency: string;
  advice: string;
  observedAt: string;
}

export interface LopburiDamStatus {
  id: string;
  name: string;
  storageMcm: number; // million m3 currently stored
  capacityMcm: number; // normal storage capacity
  storagePct: number;
  inflowMcm: number; // MCM/day
  releaseMcm: number; // MCM/day (outflow to Pa Sak downstream)
  spillwayOpen: boolean;
  downstreamNote: string;
  observedAt: string;
}

export interface LopburiFloodSummary {
  stationsReporting: number;
  stationsWarning: number; // warning + critical
  maxRainfall24h: number;
  basinPosture: "normal" | "elevated" | "severe";
  headline: string;
}

export interface LopburiFloodResponse {
  generatedAt: string;
  source: "live" | "scenario" | "modeled";
  attribution: string;
  summary: LopburiFloodSummary;
  dam: LopburiDamStatus;
  stations: LopburiFloodStation[];
}

// ─── Social listening ───────────────────────────────────────────

export type SocialSentiment = "positive" | "neutral" | "negative";
export type SocialChannel = "news-th" | "news-en" | "gdelt";
export type SocialSeverity = "info" | "watch" | "alert";

export interface SocialMention {
  id: string;
  title: string;
  url: string | null;
  source: string;
  channel: SocialChannel;
  lang: "th" | "en";
  category: string;
  categoryColor: string;
  sentiment: SocialSentiment;
  severity: SocialSeverity;
  publishedAt: string | null;
}

export interface SocialListeningResponse {
  generatedAt: string;
  source: "live" | "scenario" | "modeled";
  attribution: string;
  mentions: SocialMention[];
  counts: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    alerts: number;
    byChannel: Record<SocialChannel, number>;
  };
  topTopics: { label: string; color: string; count: number }[];
}

// ─── CCTV slots ─────────────────────────────────────────────────

export type CctvSlotStatus = "live" | "standby";

export interface CctvSlot {
  id: string;
  label: string;
  district: string;
  corridorId: string;
  lat: number;
  lon: number;
  status: CctvSlotStatus;
  /** Populated once the physical feed is wired in. */
  snapshotUrl: string | null;
  streamUrl: string | null;
  wiring: {
    protocol: "rtsp" | "hls" | "mjpeg" | "snapshot";
    owner: string; // agency that owns the camera
    note: string; // what needs to happen to bring this slot live
  };
}

export interface CctvFeedResponse {
  generatedAt: string;
  slots: CctvSlot[];
  liveCount: number;
  standbyCount: number;
}

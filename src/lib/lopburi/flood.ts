// ─── FloodDash: Lopburi Basin Flood Telemetry ───────────────────
// Real-time sources:
//   - ThaiWater / HII API v3 (province_code=16): telemetric water levels
//     and 24h rainfall — https://api-v3.thaiwater.net
//   - ThaiWater dam telemetry for Pa Sak Jolasid reservoir storage
// Degrades to deterministic scenario data (same scenario ids as the
// Phuket dashboard) and to modeled reference data when offline.

import { cached } from "../cache";
import type {
  LopburiDamStatus,
  LopburiFloodResponse,
  LopburiFloodStation,
  LopburiFloodSummary,
  FloodStationStatus,
} from "../../types/lopburi";
import { normalizeLopburiScenario } from "./config";

const PROVINCE_CODE = 16;
const WL_URL = `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=${PROVINCE_CODE}`;
const RAIN_URL = `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=${PROVINCE_CODE}`;
const DAM_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/dam_daily";

const ATTRIBUTION = "ThaiWater / HII + Royal Irrigation Department telemetry";

function adviceFor(status: FloodStationStatus): string {
  switch (status) {
    case "critical":
      return "Bank exceeded or imminent. Activate district flood plan; move people and vehicles off low ground.";
    case "warning":
      return "Approaching bank capacity. Stage sandbags and pumps; alert village heads downstream.";
    case "watch":
      return "Level elevated. Clear drains, verify pump readiness, re-check in 3 hours.";
    case "normal":
      return "Within bank capacity. Routine monitoring.";
  }
}

interface ThaiWaterWL {
  id: number;
  waterlevel_datetime?: string;
  waterlevel_msl?: string | number | null;
  discharge?: string | number | null;
  situation_level?: number;
  river_name?: string;
  agency?: { agency_shortname?: { th?: string; en?: string } };
  station?: {
    id: number;
    tele_station_name?: { th?: string; en?: string };
    tele_station_lat?: number;
    tele_station_long?: number;
    min_bank?: number;
    ground_level?: number;
  };
  geocode?: { amphoe_name?: { en?: string; th?: string } };
}

interface ThaiWaterRain {
  rain_24h?: number | string | null;
  station?: {
    id: number;
    tele_station_name?: { th?: string; en?: string };
    tele_station_lat?: number;
    tele_station_long?: number;
  };
  geocode?: { amphoe_name?: { en?: string; th?: string } };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

async function fetchLiveStations(): Promise<LopburiFloodStation[]> {
  const headers = { "User-Agent": "LopburiDashboard/1.0" };
  const [wlRes, rainRes] = await Promise.all([
    fetch(WL_URL, { headers, signal: AbortSignal.timeout(9000) }),
    fetch(RAIN_URL, { headers, signal: AbortSignal.timeout(9000) }),
  ]);

  const wlJson = wlRes.ok ? await wlRes.json() : null;
  const rainJson = rainRes.ok ? await rainRes.json() : null;
  const wlList: ThaiWaterWL[] = wlJson?.waterlevel_data?.data ?? [];
  const rainList: ThaiWaterRain[] = rainJson?.data ?? [];

  const rainByName = new Map<string, number>();
  for (const r of rainList) {
    const name = r.station?.tele_station_name?.th || "";
    if (name) rainByName.set(name, num(r.rain_24h));
  }

  const stations: LopburiFloodStation[] = [];

  for (const item of wlList) {
    const st = item.station;
    if (!st?.tele_station_lat || !st?.tele_station_long) continue;

    const name = st.tele_station_name?.th || st.tele_station_name?.en || `Station ${st.id}`;
    const wl = num(item.waterlevel_msl);
    const bank = st.min_bank || (st.ground_level ? st.ground_level + 3 : 0);
    const capacityPct = bank > 0 ? Math.min(100, Math.max(0, Math.round((wl / bank) * 100))) : 0;
    const sit = item.situation_level ?? 1;

    let status: FloodStationStatus = "normal";
    if (sit >= 4 || (bank > 0 && wl >= bank)) status = "critical";
    else if (sit === 3 || (bank > 0 && wl >= bank * 0.85)) status = "warning";
    else if (sit === 2 || (bank > 0 && wl >= bank * 0.7)) status = "watch";

    const rain24h = rainByName.get(st.tele_station_name?.th || "") ?? 0;

    stations.push({
      id: `tw-wl-${st.id}`,
      name,
      river: item.river_name ?? null,
      district: item.geocode?.amphoe_name?.en || "Lopburi",
      lat: st.tele_station_lat,
      lon: st.tele_station_long,
      waterLevelMsl: Math.round(wl * 100) / 100,
      bankLevelMsl: Math.round(bank * 100) / 100,
      capacityPct,
      status,
      trend: rain24h > 25 ? "rising" : "stable",
      rainfall24h: Math.round(rain24h * 10) / 10,
      discharge: num(item.discharge) || null,
      agency: item.agency?.agency_shortname?.en || "RID",
      advice: adviceFor(status),
      observedAt: item.waterlevel_datetime || new Date().toISOString(),
    });
  }

  // Rain gauges without a water-level twin become rainfall monitoring points.
  for (const r of rainList) {
    const st = r.station;
    if (!st?.tele_station_lat || !st?.tele_station_long) continue;
    if (
      stations.some(
        (s) =>
          Math.abs(s.lat - st.tele_station_lat!) < 0.002 &&
          Math.abs(s.lon - st.tele_station_long!) < 0.002,
      )
    ) {
      continue;
    }
    const rain24h = num(r.rain_24h);
    let status: FloodStationStatus = "normal";
    if (rain24h >= 90) status = "critical";
    else if (rain24h >= 60) status = "warning";
    else if (rain24h >= 35) status = "watch";

    stations.push({
      id: `tw-rain-${st.id}`,
      name: `${st.tele_station_name?.th || `Rain ${st.id}`} (rain gauge)`,
      river: null,
      district: r.geocode?.amphoe_name?.en || "Lopburi",
      lat: st.tele_station_lat,
      lon: st.tele_station_long,
      waterLevelMsl: 0,
      bankLevelMsl: 0,
      capacityPct: Math.min(100, Math.round((rain24h / 90) * 100)),
      status,
      trend: rain24h > 25 ? "rising" : "stable",
      rainfall24h: Math.round(rain24h * 10) / 10,
      discharge: null,
      agency: "ThaiWater",
      advice: adviceFor(status),
      observedAt: new Date().toISOString(),
    });
  }

  return stations;
}

interface ThaiWaterDam {
  dam_date?: string;
  dam_storage?: string | number | null;
  dam_storage_percent?: string | number | null;
  dam_inflow?: string | number | null;
  dam_released?: string | number | null;
  dam?: {
    id?: number;
    dam_name?: { th?: string; en?: string };
    normal_storage?: number;
  };
}

async function fetchLiveDam(): Promise<LopburiDamStatus | null> {
  const res = await fetch(DAM_URL, {
    headers: { "User-Agent": "LopburiDashboard/1.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const list: ThaiWaterDam[] = json?.dam_daily?.data ?? json?.data ?? [];
  const pasak = list.find((d) => {
    const th = d.dam?.dam_name?.th ?? "";
    const en = (d.dam?.dam_name?.en ?? "").toLowerCase();
    return th.includes("ป่าสัก") || en.includes("pasak") || en.includes("pa sak");
  });
  if (!pasak) return null;

  const capacity = pasak.dam?.normal_storage || 960;
  const storage = num(pasak.dam_storage);
  const pct = num(pasak.dam_storage_percent) || (capacity > 0 ? (storage / capacity) * 100 : 0);
  const release = num(pasak.dam_released);

  return {
    id: "pasak-jolasid",
    name: "Pa Sak Jolasid Dam",
    storageMcm: Math.round(storage),
    capacityMcm: Math.round(capacity),
    storagePct: Math.round(pct),
    inflowMcm: Math.round(num(pasak.dam_inflow) * 100) / 100,
    releaseMcm: Math.round(release * 100) / 100,
    spillwayOpen: release > 30,
    downstreamNote:
      release > 30
        ? "Elevated release — downstream Pa Sak districts (Phatthana Nikhom, Tha Luang) on notice."
        : "Release within normal irrigation band; no downstream advisory.",
    observedAt: pasak.dam_date || new Date().toISOString(),
  };
}

// ─── Scenario / modeled data ────────────────────────────────────
// Deterministic modeled stations at real RID telemetry positions along
// the Lopburi River and Pa Sak basin. Values are scenario-modeled, not
// invented live readings — the payload is flagged source: "scenario".

type ScenarioTuning = {
  bump: number; // added meters of water level
  rainScale: number;
  damPct: number;
  damRelease: number;
  posture: LopburiFloodSummary["basinPosture"];
  headline: string;
};

const SCENARIO_TUNING: Record<string, ScenarioTuning> = {
  "red-monsoon-day": {
    bump: 1.6,
    rainScale: 3.2,
    damPct: 87,
    damRelease: 48,
    posture: "severe",
    headline:
      "Monsoon band over the basin — Lopburi River above warning at Tha Wung, Pa Sak release elevated.",
  },
  "stable-recovery-day": {
    bump: -0.4,
    rainScale: 0.3,
    damPct: 58,
    damRelease: 8,
    posture: "normal",
    headline: "Dry spell holding — all stations within bank, reservoir banking storage for dry season.",
  },
  "tourism-surge-weekend": {
    bump: 0.2,
    rainScale: 0.9,
    damPct: 66,
    damRelease: 12,
    posture: "normal",
    headline:
      "Sunflower-season weekend — basin quiet, monitoring focused on visitor corridors.",
  },
};

interface ModelStation {
  id: string;
  name: string;
  river: string | null;
  district: string;
  lat: number;
  lon: number;
  baseWl: number;
  bank: number;
  baseRain: number;
}

const MODEL_STATIONS: ModelStation[] = [
  { id: "m-thawung", name: "Lopburi River @ Tha Wung", river: "Lopburi River", district: "Tha Wung", lat: 14.83, lon: 100.49, baseWl: 5.9, bank: 7.4, baseRain: 18 },
  { id: "m-mueang", name: "Lopburi River @ Mueang (Pratu Nam)", river: "Lopburi River", district: "Mueang Lopburi", lat: 14.802, lon: 100.607, baseWl: 5.1, bank: 7.0, baseRain: 14 },
  { id: "m-banmi", name: "Bang Kham Canal @ Ban Mi", river: "Bang Kham", district: "Ban Mi", lat: 15.041, lon: 100.541, baseWl: 6.6, bank: 8.2, baseRain: 20 },
  { id: "m-pasak-down", name: "Pa Sak River below dam", river: "Pa Sak", district: "Phatthana Nikhom", lat: 14.845, lon: 101.05, baseWl: 33.8, bank: 38.0, baseRain: 16 },
  { id: "m-chaibadan", name: "Pa Sak River @ Chai Badan", river: "Pa Sak", district: "Chai Badan", lat: 15.19, lon: 101.13, baseWl: 52.2, bank: 56.5, baseRain: 22 },
  { id: "m-khoksamrong", name: "Khok Samrong rain gauge", river: null, district: "Khok Samrong", lat: 15.048, lon: 100.725, baseWl: 0, bank: 0, baseRain: 12 },
  { id: "m-lamsonthi", name: "Lam Sonthi upland gauge", river: "Lam Sonthi", district: "Lam Sonthi", lat: 15.1, lon: 101.3, baseWl: 61.0, bank: 64.5, baseRain: 26 },
  { id: "m-nongmuang", name: "Nong Muang rain gauge", river: null, district: "Nong Muang", lat: 15.27, lon: 100.86, baseWl: 0, bank: 0, baseRain: 10 },
];

function buildModelStations(tuning: ScenarioTuning): LopburiFloodStation[] {
  return MODEL_STATIONS.map((m) => {
    const isRainGauge = m.bank === 0;
    const wl = isRainGauge ? 0 : Math.round((m.baseWl + tuning.bump) * 100) / 100;
    const rain = Math.round(m.baseRain * tuning.rainScale * 10) / 10;
    const capacityPct = isRainGauge
      ? Math.min(100, Math.round((rain / 90) * 100))
      : Math.min(100, Math.max(0, Math.round((wl / m.bank) * 100)));

    let status: FloodStationStatus = "normal";
    if (isRainGauge) {
      if (rain >= 90) status = "critical";
      else if (rain >= 60) status = "warning";
      else if (rain >= 35) status = "watch";
    } else {
      if (wl >= m.bank) status = "critical";
      else if (wl >= m.bank * 0.85) status = "warning";
      else if (wl >= m.bank * 0.7) status = "watch";
    }

    return {
      id: m.id,
      name: m.name,
      river: m.river,
      district: m.district,
      lat: m.lat,
      lon: m.lon,
      waterLevelMsl: wl,
      bankLevelMsl: m.bank,
      capacityPct,
      status,
      trend: tuning.rainScale > 1.5 ? "rising" : tuning.rainScale < 0.5 ? "falling" : "stable",
      rainfall24h: rain,
      discharge: isRainGauge ? null : Math.round(tuning.damRelease * 0.6 * 100) / 100,
      agency: "RID (modeled)",
      advice: adviceFor(status),
      observedAt: new Date().toISOString(),
    };
  });
}

function buildModelDam(tuning: ScenarioTuning): LopburiDamStatus {
  const capacity = 960; // Pa Sak Jolasid normal storage ~960 MCM
  return {
    id: "pasak-jolasid",
    name: "Pa Sak Jolasid Dam",
    storageMcm: Math.round((capacity * tuning.damPct) / 100),
    capacityMcm: capacity,
    storagePct: tuning.damPct,
    inflowMcm: Math.round(tuning.damRelease * 1.3 * 100) / 100,
    releaseMcm: tuning.damRelease,
    spillwayOpen: tuning.damRelease > 30,
    downstreamNote:
      tuning.damRelease > 30
        ? "Elevated release — downstream Pa Sak districts (Phatthana Nikhom, Tha Luang) on notice."
        : "Release within normal irrigation band; no downstream advisory.",
    observedAt: new Date().toISOString(),
  };
}

function summarize(
  stations: LopburiFloodStation[],
  dam: LopburiDamStatus,
  headline?: string,
): LopburiFloodSummary {
  const warning = stations.filter((s) => s.status === "warning" || s.status === "critical").length;
  const critical = stations.filter((s) => s.status === "critical").length;
  const maxRain = stations.reduce((m, s) => Math.max(m, s.rainfall24h), 0);
  const posture: LopburiFloodSummary["basinPosture"] =
    critical > 0 || dam.storagePct >= 90 ? "severe" : warning > 0 || dam.storagePct >= 80 ? "elevated" : "normal";

  return {
    stationsReporting: stations.length,
    stationsWarning: warning,
    maxRainfall24h: Math.round(maxRain * 10) / 10,
    basinPosture: posture,
    headline:
      headline ??
      (posture === "severe"
        ? `${critical} station(s) critical — basin flood posture SEVERE.`
        : posture === "elevated"
          ? `${warning} station(s) at warning — basin posture elevated, monitor 3-hourly.`
          : "All telemetry within bank capacity — routine basin monitoring."),
  };
}

export async function loadLopburiFlood(
  scenarioParam: string | null,
): Promise<LopburiFloodResponse> {
  const scenario = normalizeLopburiScenario(scenarioParam);

  if (scenario) {
    const tuning = SCENARIO_TUNING[scenario];
    const stations = buildModelStations(tuning);
    const dam = buildModelDam(tuning);
    return {
      generatedAt: new Date().toISOString(),
      source: "scenario",
      attribution: `${ATTRIBUTION} (scenario-modeled: ${scenario})`,
      summary: { ...summarize(stations, dam, tuning.headline), basinPosture: tuning.posture },
      dam,
      stations,
    };
  }

  return cached("lopburi-flood-live", 240, async () => {
    let stations: LopburiFloodStation[] = [];
    let dam: LopburiDamStatus | null = null;
    try {
      [stations, dam] = await Promise.all([
        fetchLiveStations().catch(() => [] as LopburiFloodStation[]),
        fetchLiveDam().catch(() => null),
      ]);
    } catch {
      // fall through to modeled
    }

    if (stations.length === 0) {
      const tuning = SCENARIO_TUNING["tourism-surge-weekend"];
      const modelStations = buildModelStations(tuning);
      const modelDam = dam ?? buildModelDam(tuning);
      return {
        generatedAt: new Date().toISOString(),
        source: "modeled" as const,
        attribution: `${ATTRIBUTION} (reference model — live feed unreachable)`,
        summary: summarize(modelStations, modelDam),
        dam: modelDam,
        stations: modelStations,
      };
    }

    const finalDam = dam ?? buildModelDam(SCENARIO_TUNING["tourism-surge-weekend"]);
    stations.sort((a, b) => b.capacityPct - a.capacityPct);
    return {
      generatedAt: new Date().toISOString(),
      source: "live" as const,
      attribution: ATTRIBUTION,
      summary: summarize(stations, finalDam),
      dam: finalDam,
      stations,
    };
  });
}

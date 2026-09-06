// ─── NST Watershed Hydrology ────────────────────────────────────
// One loader for the whole mountain-to-sea system. Live sources:
//   - ThaiWater / HII API v3 (province_code=80): telemetric water level,
//     discharge, 24h rain — matched onto the traced network nodes
//   - Open-Meteo Marine: sea level (tide + surge) at Pak Nakhon, the
//     outlet constraint that keeps water in the city
// The routing model then answers the operator's questions in order:
// how much is coming, when it reaches the city, where it splits, which
// zones pond, and whether the outlets can pass it. Degrades to
// scenario / reference-model data, clearly flagged.

import { cached } from "../cache";
import { NST_NODES, NST_REACHES, reachLengthKm } from "../../data/nst-waterways";
import { NST_FLOOD_ZONES } from "../../data/nst-flood-zones";
import { NST_PROVINCE, normalizeNstScenario } from "./config";
import type {
  NstNodeState,
  NstOutletState,
  NstReachState,
  NstRouting,
  NstStage,
  NstWatershedResponse,
  NstZoneState,
  WaterStatus,
} from "../../types/nst";

const ATTRIBUTION = "ThaiWater / HII + RID telemetry · Open-Meteo Marine tide · RID city flood-mitigation design values";
const CITY_CHANNEL_CAPACITY = 268; // m3/s — RID project brief
const WL_URL = `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=${NST_PROVINCE.code}`;
const RAIN_URL = `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=${NST_PROVINCE.code}`;
const MARINE_URL = `https://marine-api.open-meteo.com/v1/marine?latitude=${NST_PROVINCE.outletPoint.latitude}&longitude=${NST_PROVINCE.outletPoint.longitude}&hourly=sea_level_height_msl&timezone=Asia%2FBangkok&forecast_days=1`;

const STATUS_RANK: Record<WaterStatus, number> = { normal: 0, watch: 1, warning: 2, critical: 3 };
const VELOCITY: Record<WaterStatus, number> = { normal: 0.6, watch: 0.9, warning: 1.2, critical: 1.5 };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }
function worst(a: WaterStatus, b: WaterStatus): WaterStatus { return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b; }

function levelStatus(capacityPct: number | null): WaterStatus {
  if (capacityPct === null) return "normal";
  if (capacityPct >= 100) return "critical";
  if (capacityPct >= 85) return "warning";
  if (capacityPct >= 70) return "watch";
  return "normal";
}
function rainStatus(mm: number | null): WaterStatus {
  if (mm === null) return "normal";
  if (mm >= 150) return "critical";
  if (mm >= 90) return "warning";
  if (mm >= 40) return "watch";
  return "normal";
}
function ratioStatus(ratio: number): WaterStatus {
  if (ratio >= 1) return "critical";
  if (ratio >= 0.85) return "warning";
  if (ratio >= 0.7) return "watch";
  return "normal";
}

// ─── Inputs -> assembled system state ───────────────────────────

interface NodeReading {
  waterLevelMsl?: number | null;
  discharge?: number | null;
  rainfall24h?: number | null;
  trend?: "rising" | "falling" | "stable";
  agency?: string;
  observedAt?: string;
}
interface TideReading { seaLevelM: number; tideState: NstOutletState["tideState"]; }

interface AssembleInput {
  readings: Record<string, NodeReading>;
  extraNodes: NstNodeState[];
  tide: TideReading;
  source: NstWatershedResponse["source"];
  attribution: string;
  headline?: string;
}

function assemble(input: AssembleInput): NstWatershedResponse {
  const now = new Date().toISOString();

  // 1. Nodes
  const nodes: NstNodeState[] = NST_NODES.map((def) => {
    const r = input.readings[def.id] ?? {};
    const wl = r.waterLevelMsl ?? null;
    const capacityPct = wl !== null && def.bankLevelMsl ? Math.min(140, Math.max(0, Math.round((wl / def.bankLevelMsl) * 100))) : null;
    const rain = r.rainfall24h ?? null;
    let status: WaterStatus = "normal";
    if (def.kind === "catchment") status = rainStatus(rain);
    else if (def.kind === "outlet") status = "normal"; // set from tide below
    else status = worst(levelStatus(capacityPct), rainStatus(rain));
    return {
      id: def.id, name: def.name, nameTh: def.nameTh, kind: def.kind, branch: def.branch, order: def.order,
      lon: def.lon, lat: def.lat, onNetwork: true, district: def.district,
      waterLevelMsl: wl !== null ? r2(wl) : null,
      bankLevelMsl: def.bankLevelMsl,
      capacityPct,
      rainfall24h: rain !== null ? r1(rain) : null,
      discharge: r.discharge != null ? r1(r.discharge) : null,
      status,
      trend: r.trend ?? "stable",
      agency: r.agency ?? "RID",
      observedAt: r.observedAt ?? now,
      note: def.note,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = (id: string) => byId.get(id)!;

  // 2. Routing quantities
  const thaDi = node("tha-di");
  const Q = thaDi.discharge ?? Math.round(((thaDi.capacityPct ?? 30) / 100) * 320);
  const catchmentRain = Math.max(node("khao-luang").rainfall24h ?? 0, node("khiriwong").rainfall24h ?? 0, node("phrom-khiri").rainfall24h ?? 0);
  const diversionOpen = Q > 150;
  const split = diversionOpen ? { north: 0.25, city: 0.4, south: 0.35 } : { north: 0.3, city: 0.65, south: 0.05 };
  const cityInflow = Math.round(Q * split.city);
  const northQ = Math.round(Q * split.north);
  const southQ = Math.round(Q * split.south);
  const phromKhiriQ = Math.round((node("phrom-khiri").rainfall24h ?? 0) * 0.6);

  // Split / gate nodes inherit the Tha Di reading; city nodes get derived load when no reading.
  node("tha-ngiu").status = worst(node("tha-ngiu").status, thaDi.status);
  node("tha-ngiu").discharge = node("tha-ngiu").discharge ?? Q;
  node("diversion-gate-1").status = diversionOpen ? (southQ > 600 ? "warning" : "watch") : "normal";
  node("diversion-gate-1").discharge = southQ;
  node("diversion-gate-1").note = diversionOpen ? `Gates OPEN — passing ~${southQ} m3/s south of the city.` : "Gates closed — city channel carrying the flow.";
  for (const id of ["kamphaeng-sao", "tha-wang"]) {
    const n = node(id);
    n.discharge = n.discharge ?? cityInflow;
    n.status = worst(n.status, ratioStatus(cityInflow / CITY_CHANNEL_CAPACITY));
  }
  node("tha-sak").discharge = node("tha-sak").discharge ?? northQ + phromKhiriQ;
  node("tha-sak").status = worst(node("tha-sak").status, ratioStatus((northQ + phromKhiriQ) / 120));

  // 3. Outlets — one tide reference, three outfalls
  const constrained = input.tide.seaLevelM > 0.5 || (input.tide.seaLevelM > 0.3 && input.tide.tideState === "rising");
  const outletDefs = [
    { id: "pak-nakhon", load: cityInflow, cap: CITY_CHANNEL_CAPACITY },
    { id: "pak-phun", load: northQ + phromKhiriQ, cap: 120 },
    { id: "bang-chak", load: southQ, cap: 750 },
  ];
  const outlets: NstOutletState[] = outletDefs.map((o) => {
    const n = node(o.id);
    const loadRatio = o.load / o.cap;
    n.status = constrained ? (loadRatio >= 0.85 ? "critical" : loadRatio >= 0.5 ? "warning" : "watch") : ratioStatus(loadRatio);
    n.discharge = o.load;
    n.waterLevelMsl = r2(input.tide.seaLevelM);
    return {
      id: o.id, name: n.name, lon: n.lon, lat: n.lat,
      seaLevelM: r2(input.tide.seaLevelM), tideState: input.tide.tideState, constrained,
      note: constrained
        ? `Tide ${input.tide.tideState} at +${r2(input.tide.seaLevelM)} m — outfall passing well below ${o.cap} m3/s.`
        : `Tide ${input.tide.tideState} at ${r2(input.tide.seaLevelM)} m — outfall free to drain.`,
    };
  });

  // 4. Reaches — discharge carried, velocity, travel time, status
  const reachQ: Record<string, number> = {
    "r-headwaters": Math.round(Q * 0.55), "r-gorge": Math.round(Q * 0.85), "r-tha-di": Q,
    "r-city-inflow": cityInflow, "r-pak-nakhon": cityInflow,
    "r-tha-sak": northQ + phromKhiriQ, "r-pak-phun": northQ + phromKhiriQ, "r-phrom-khiri": phromKhiriQ,
    "r-diversion": southQ,
  };
  const reaches: NstReachState[] = NST_REACHES.map((def) => {
    const from = node(def.fromNode);
    const discharge = reachQ[def.id] ?? 0;
    const capStatus = def.designCapacity ? ratioStatus(discharge / def.designCapacity) : "normal";
    const status = def.id === "r-diversion" && !diversionOpen ? "normal" : worst(from.status, capStatus);
    const lengthKm = reachLengthKm(def.path);
    const velocity = VELOCITY[status];
    return {
      id: def.id, name: def.name, branch: def.branch, order: def.order, fromNode: def.fromNode, toNode: def.toNode,
      path: def.path, lengthKm, discharge, velocity, travelHours: r1((lengthKm * 1000) / velocity / 3600),
      status, designCapacity: def.designCapacity,
    };
  });
  const reach = (id: string) => reaches.find((r) => r.id === id)!;

  // 5. City ETA — only meaningful when something upstream is rising
  const upstreamRising = (node("khiriwong").trend === "rising" && STATUS_RANK[node("khiriwong").status] >= 1)
    || (thaDi.trend === "rising" && STATUS_RANK[thaDi.status] >= 1);
  let cityEtaHours: number | null = null;
  if (upstreamRising) {
    cityEtaHours = node("khiriwong").trend === "rising"
      ? r1(reach("r-gorge").travelHours + reach("r-tha-di").travelHours + reach("r-city-inflow").travelHours)
      : r1(reach("r-tha-di").travelHours + reach("r-city-inflow").travelHours);
  }
  const cityArrivalAt = cityEtaHours !== null ? new Date(Date.now() + cityEtaHours * 3600 * 1000).toISOString() : null;

  // 6. Zones — where the water goes, in order
  const zoneStatus = (id: string): NstZoneState["status"] => {
    switch (id) {
      case "z-west-fringe": return cityInflow > 268 ? "flooded" : cityInflow > 200 ? "ponding" : cityInflow > 140 ? "watch" : "dry";
      case "z-city-core": return cityInflow > 320 ? "flooded" : cityInflow > 268 ? "ponding" : cityInflow > 200 ? "watch" : "dry";
      case "z-north-lowland": { const q = northQ + phromKhiriQ; return q > 120 && constrained ? "flooded" : q > 100 ? "ponding" : q > 70 ? "watch" : "dry"; }
      case "z-east-plain": return cityInflow > 268 && constrained ? "flooded" : cityInflow > 200 && constrained ? "ponding" : cityInflow > 140 ? "watch" : "dry";
      case "z-south-corridor": return southQ > 750 ? "flooded" : southQ > 600 ? "ponding" : southQ > 450 ? "watch" : "dry";
      default: return "dry";
    }
  };
  const zones: NstZoneState[] = NST_FLOOD_ZONES.map((z) => {
    const status = zoneStatus(z.id);
    return {
      id: z.id, name: z.name, nameTh: z.nameTh, fillOrder: z.fillOrder, elevationM: z.elevationM, outlet: z.outlet,
      polygon: z.polygon, status,
      etaHours: status !== "dry" && cityEtaHours !== null ? r1(cityEtaHours + (z.fillOrder - 1) * 2) : null,
      note: z.note,
    };
  });

  // 7. Posture + stages
  const critical = ["tha-di", "kamphaeng-sao", "tha-wang"].some((id) => node(id).status === "critical");
  const warning = nodes.some((n) => n.status === "warning" || n.status === "critical");
  const posture: NstRouting["posture"] = critical || cityInflow > CITY_CHANNEL_CAPACITY ? "severe" : warning || Q > 150 || (constrained && cityInflow > 140) ? "elevated" : "normal";
  const pondingCount = zones.filter((z) => z.status === "ponding" || z.status === "flooded").length;
  const st = (s: WaterStatus): NstStage["state"] => (s === "critical" ? "alert" : s === "warning" ? "active" : s === "watch" ? "watch" : "clear");
  const stages: NstStage[] = [
    { step: 1, id: "catchment", title: "Rain on Khao Luang", detail: "Northeast-monsoon rain on the range becomes Khlong Tha Di discharge within hours.", metric: `${r1(catchmentRain)} mm / 24h`, state: st(rainStatus(catchmentRain)), etaHours: null },
    { step: 2, id: "tha-di", title: "Khlong Tha Di rises", detail: "Reference gauge at Ban Tha Di. Bank capacity here is the trigger for the city.", metric: `${Q} m3/s · ${thaDi.capacityPct ?? "—"}% bank`, state: st(thaDi.status), etaHours: null },
    { step: 3, id: "split", title: "Tha Ngiu split", detail: diversionOpen ? "Diversion gates open — a third of the flow goes south around the city." : "Diversion closed — the city channel carries most of the flow.", metric: `N ${Math.round(split.north * 100)} · City ${Math.round(split.city * 100)} · S ${Math.round(split.south * 100)} %`, state: diversionOpen ? "active" : Q > 100 ? "watch" : "clear", etaHours: null },
    { step: 4, id: "city-channel", title: "City channel", detail: `Khlong Tha Di / Pak Nakhon through Kamphaeng Sao and Tha Wang can pass ~${CITY_CHANNEL_CAPACITY} m3/s.`, metric: `${cityInflow} / ${CITY_CHANNEL_CAPACITY} m3/s`, state: st(ratioStatus(cityInflow / CITY_CHANNEL_CAPACITY)), etaHours: cityEtaHours },
    { step: 5, id: "ponding", title: "Where it ponds", detail: "Western fringe first, city core two hours later, then the low northern and eastern plains.", metric: `${pondingCount} of ${zones.length} zones ponding`, state: pondingCount >= 3 ? "alert" : pondingCount >= 1 ? "active" : zones.some((z) => z.status === "watch") ? "watch" : "clear", etaHours: cityEtaHours !== null ? r1(cityEtaHours + 2) : null },
    { step: 6, id: "outlets", title: "Outlets and tide", detail: "Pak Nakhon, Pak Phun, and the diversion outfall only drain on the ebb. High tide holds water in the city.", metric: `${input.tide.seaLevelM >= 0 ? "+" : ""}${r2(input.tide.seaLevelM)} m · ${input.tide.tideState}`, state: constrained ? (cityInflow > 200 ? "alert" : "active") : "clear", etaHours: null },
  ];

  const headline = input.headline ?? (
    posture === "severe"
      ? `City inflow ${cityInflow} m3/s exceeds the ${CITY_CHANNEL_CAPACITY} m3/s channel${cityEtaHours !== null ? ` — arrival in ~${cityEtaHours} h` : ""}. ${constrained ? "Tide is holding the outlets." : "Outlets draining."}`
      : posture === "elevated"
        ? `Tha Di at ${Q} m3/s${diversionOpen ? ", diversion open" : ""}. ${constrained ? "High tide constrains outlets — watch the eastern plain." : "Outlets free; monitor 3-hourly."}`
        : "Whole system within capacity. Routine monitoring from Khao Luang to Pak Nakhon."
  );

  const allNodes = [...nodes, ...input.extraNodes];
  return {
    generatedAt: now,
    source: input.source,
    attribution: input.attribution,
    nodes: allNodes,
    reaches,
    outlets,
    zones,
    routing: { catchmentRain24h: r1(catchmentRain), thaDiDischarge: Q, thaDiCapacityPct: thaDi.capacityPct ?? 0, cityChannelCapacity: CITY_CHANNEL_CAPACITY, diversionOpen, split, cityEtaHours, cityArrivalAt, posture, headline, stages },
    stationsReporting: allNodes.filter((n) => n.kind !== "split" && n.kind !== "gate").length,
    stationsWarning: allNodes.filter((n) => n.status === "warning" || n.status === "critical").length,
  };
}

// ─── Scenario / reference model ─────────────────────────────────

interface Tuning { rain: number; thaDiQ: number; levelFrac: number; trend: "rising" | "falling" | "stable"; tide: number; tideState: NstOutletState["tideState"]; headline: string; }
const TUNING: Record<string, Tuning> = {
  "red-monsoon-day": { rain: 262, thaDiQ: 820, levelFrac: 1.04, trend: "rising", tide: 0.82, tideState: "high", headline: "Northeast-monsoon band on Khao Luang — Tha Di over bank, city channel exceeded even with the diversion open, high tide holding Pak Nakhon." },
  "stable-recovery-day": { rain: 4, thaDiQ: 38, levelFrac: 0.32, trend: "falling", tide: 0.05, tideState: "falling", headline: "Dry spell — system draining, all channels within bank, outlets free on the ebb." },
  "tourism-surge-weekend": { rain: 18, thaDiQ: 75, levelFrac: 0.48, trend: "stable", tide: 0.3, tideState: "rising", headline: "Quiet system — light catchment rain, Tha Di at half bank, routine tide cycle at the outlets." },
};

function modelReadings(t: Tuning): Record<string, NodeReading> {
  const lvl = (bank: number | null, f = 1) => (bank ? bank * t.levelFrac * f : null);
  const trend = t.trend;
  const rainAt = (f: number) => r1(t.rain * f);
  return {
    "khao-luang": { rainfall24h: rainAt(1), trend },
    khiriwong: { waterLevelMsl: lvl(62), discharge: Math.round(t.thaDiQ * 0.85), rainfall24h: rainAt(0.8), trend },
    "tha-di": { waterLevelMsl: lvl(18.5), discharge: t.thaDiQ, rainfall24h: rainAt(0.45), trend },
    "tha-ngiu": { waterLevelMsl: lvl(11), trend },
    "kamphaeng-sao": { waterLevelMsl: lvl(7.2, 0.96), rainfall24h: rainAt(0.3), trend },
    "tha-wang": { waterLevelMsl: lvl(4.1, 0.94), rainfall24h: rainAt(0.28), trend },
    "tha-sak": { waterLevelMsl: lvl(3.4, 0.9), rainfall24h: rainAt(0.35), trend },
    "phrom-khiri": { rainfall24h: rainAt(0.7), trend },
  };
}

// ─── Live sources ───────────────────────────────────────────────

interface ThaiWaterWL {
  waterlevel_datetime?: string; waterlevel_msl?: string | number | null; discharge?: string | number | null; situation_level?: number; river_name?: string;
  agency?: { agency_shortname?: { en?: string } };
  station?: { id: number; tele_station_name?: { th?: string; en?: string }; tele_station_lat?: number; tele_station_long?: number; min_bank?: number };
  geocode?: { amphoe_name?: { en?: string } };
}
interface ThaiWaterRain { rain_24h?: number | string | null; station?: { id: number; tele_station_name?: { th?: string }; tele_station_lat?: number; tele_station_long?: number }; geocode?: { amphoe_name?: { en?: string } }; }

async function fetchThaiWater(): Promise<{ readings: Record<string, NodeReading>; extra: NstNodeState[] } | null> {
  const headers = { "User-Agent": "NstDashboard/1.0" };
  const [wlRes, rainRes] = await Promise.all([
    fetch(WL_URL, { headers, signal: AbortSignal.timeout(9000) }),
    fetch(RAIN_URL, { headers, signal: AbortSignal.timeout(9000) }),
  ]);
  const wlList: ThaiWaterWL[] = wlRes.ok ? ((await wlRes.json())?.waterlevel_data?.data ?? []) : [];
  const rainList: ThaiWaterRain[] = rainRes.ok ? ((await rainRes.json())?.data ?? []) : [];
  if (wlList.length === 0 && rainList.length === 0) return null;

  const readings: Record<string, NodeReading> = {};
  const extra: NstNodeState[] = [];
  const nearestNode = (lat: number, lon: number) => {
    let best: { id: string; d: number } | null = null;
    for (const n of NST_NODES) {
      const d = Math.hypot(n.lat - lat, n.lon - lon);
      if (!best || d < best.d) best = { id: n.id, d };
    }
    return best && best.d < 0.05 ? best.id : null;
  };

  const rainByPos = rainList.filter((r) => r.station?.tele_station_lat && r.station?.tele_station_long);
  for (const item of wlList) {
    const st = item.station;
    if (!st?.tele_station_lat || !st?.tele_station_long) continue;
    const wl = num(item.waterlevel_msl);
    const rainNear = rainByPos.find((r) => Math.hypot(r.station!.tele_station_lat! - st.tele_station_lat!, r.station!.tele_station_long! - st.tele_station_long!) < 0.02);
    const rain = rainNear ? num(rainNear.rain_24h) : null;
    const reading: NodeReading = { waterLevelMsl: wl, discharge: num(item.discharge) || null, rainfall24h: rain, trend: rain !== null && rain > 25 ? "rising" : "stable", agency: item.agency?.agency_shortname?.en || "RID", observedAt: item.waterlevel_datetime };
    const target = nearestNode(st.tele_station_lat, st.tele_station_long);
    if (target && !readings[target]) { readings[target] = reading; continue; }
    const bank = st.min_bank || 0;
    const capacityPct = bank > 0 ? Math.min(140, Math.round((wl / bank) * 100)) : null;
    extra.push({
      id: `tw-${st.id}`, name: st.tele_station_name?.th || st.tele_station_name?.en || `Station ${st.id}`, nameTh: st.tele_station_name?.th || "", kind: "gauge", branch: "main", order: 99,
      lon: st.tele_station_long, lat: st.tele_station_lat, onNetwork: false, district: item.geocode?.amphoe_name?.en || "NST",
      waterLevelMsl: r2(wl), bankLevelMsl: bank || null, capacityPct, rainfall24h: rain, discharge: num(item.discharge) || null,
      status: levelStatus(capacityPct), trend: reading.trend!, agency: reading.agency!, observedAt: item.waterlevel_datetime || new Date().toISOString(),
      note: item.river_name ? `${item.river_name} — off the traced network` : "Off the traced network",
    });
  }
  for (const r of rainByPos) {
    const target = nearestNode(r.station!.tele_station_lat!, r.station!.tele_station_long!);
    if (target && readings[target]?.rainfall24h == null) readings[target] = { ...(readings[target] ?? {}), rainfall24h: num(r.rain_24h), trend: num(r.rain_24h) > 25 ? "rising" : "stable" };
  }
  return { readings, extra: extra.slice(0, 12) };
}

async function fetchTide(): Promise<TideReading | null> {
  const res = await fetch(MARINE_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const times: string[] = json?.hourly?.time ?? [];
  const levels: (number | null)[] = json?.hourly?.sea_level_height_msl ?? [];
  if (times.length === 0) return null;
  const nowLocal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 13);
  let i = times.findIndex((t) => t.startsWith(nowLocal));
  if (i < 0) i = 0;
  const cur = num(levels[i]);
  const next = num(levels[Math.min(i + 1, levels.length - 1)]);
  const prev = num(levels[Math.max(i - 1, 0)]);
  const tideState: NstOutletState["tideState"] = next > cur + 0.03 ? "rising" : next < cur - 0.03 ? "falling" : cur >= prev ? "high" : "low";
  return { seaLevelM: cur, tideState };
}

// ─── Public loader ──────────────────────────────────────────────

export async function loadNstWatershed(scenarioParam: string | null): Promise<NstWatershedResponse> {
  const scenario = normalizeNstScenario(scenarioParam);
  if (scenario) {
    const t = TUNING[scenario];
    return assemble({ readings: modelReadings(t), extraNodes: [], tide: { seaLevelM: t.tide, tideState: t.tideState }, source: "scenario", attribution: `${ATTRIBUTION} (scenario-modeled: ${scenario})`, headline: t.headline });
  }

  return cached("nst-watershed-live", 240, async () => {
    const [tw, tide] = await Promise.all([fetchThaiWater().catch(() => null), fetchTide().catch(() => null)]);
    const t = TUNING["tourism-surge-weekend"];
    if (!tw) {
      return assemble({ readings: modelReadings(t), extraNodes: [], tide: tide ?? { seaLevelM: t.tide, tideState: t.tideState }, source: "modeled", attribution: `${ATTRIBUTION} (reference model — telemetry unreachable${tide ? ", tide live" : ""})` });
    }
    // Live telemetry rarely covers every traced node; fill the gaps from the
    // reference model so the routing chain never has holes, and say so.
    const readings = { ...modelReadings(t), ...tw.readings };
    return assemble({ readings, extraNodes: tw.extra, tide: tide ?? { seaLevelM: t.tide, tideState: t.tideState }, source: "live", attribution: `${ATTRIBUTION}${Object.keys(tw.readings).length < NST_NODES.length ? " · unmatched nodes reference-modeled" : ""}` });
  });
}

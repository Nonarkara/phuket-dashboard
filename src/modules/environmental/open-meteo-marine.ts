// ─── Open-Meteo Marine API ──────────────────────────────────────
// Free, no API key. Wave height, period, direction, sea surface
// temperature, ocean currents.
//
// Critical for Phuket: fishermen's livelihoods depend on sea conditions.
// Coastal flooding risk from storm surge + spring tides + heavy rain.

import type { ModuleDefinition } from "../../types/modules";

export interface MarineReading {
  id: string;
  station: string;        // e.g. "Patong", "Rawai", "Sirinat"
  lat: number;
  lon: number;
  waveHeight: number;     // meters
  wavePeriod: number;     // seconds
  waveDirection: number;  // degrees
  swellHeight: number;
  sst: number;            // sea surface temperature °C
  currentVelocity: number; // m/s
  currentDirection: number;
  riskLevel: "calm" | "moderate" | "rough" | "very_rough" | "phenomenal";
  fishingAdvice: string;
  floodRisk: string;
  timestamp: string;
}

// Key coastal monitoring points around Phuket
const PHUKET_MARINE_STATIONS = [
  { id: "patong",    name: "Patong Bay",         lat: 7.8950, lon: 98.2900 },
  { id: "rawai",     name: "Rawai (Fishing)",    lat: 7.7770, lon: 98.3270 },
  { id: "sirinat",   name: "Sirinat National Park", lat: 8.1100, lon: 98.2900 },
  { id: "kata",      name: "Kata Beach",         lat: 7.8200, lon: 98.2960 },
  { id: "chalong",   name: "Chalong Bay (Pier)", lat: 7.8200, lon: 98.3550 },
  { id: "panwa",     name: "Cape Panwa",         lat: 7.8050, lon: 98.4030 },
];

function classifyWaves(h: number): MarineReading["riskLevel"] {
  if (h < 0.5) return "calm";
  if (h < 1.25) return "moderate";
  if (h < 2.5) return "rough";
  if (h < 4) return "very_rough";
  return "phenomenal";
}

function fishingAdvice(h: number, period: number): string {
  if (h < 0.75) return "Excellent — small boats can go out safely.";
  if (h < 1.5)  return "Good for small boats. Watch period > 8s = swell.";
  if (h < 2.5)  return "Caution — only experienced crews. Many small boats stay in.";
  if (h < 4)    return "Dangerous for small boats. Commercial only.";
  return "All boats stay in port. Pier closures likely.";
}

function floodRisk(h: number): string {
  if (h < 1.5) return "Low — normal coastal conditions.";
  if (h < 2.5) return "Moderate — watch low-lying areas at high tide.";
  if (h < 4)   return "High — storm surge possible. Inland evacuation drill zones.";
  return "Severe — coastal flooding very likely at high tide.";
}

async function fetchStation(lat: number, lon: number) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_period,wave_direction,swell_wave_height,` +
    `sea_surface_temperature,ocean_current_velocity,ocean_current_direction` +
    `&length_unit=metric&timezone=Asia%2FBangkok`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Marine API ${res.status}`);
  return res.json();
}

export const openMeteoMarineModule: ModuleDefinition<MarineReading[]> = {
  id: "open-meteo-marine",
  label: "Coastal Marine Conditions",
  category: "environmental",
  description: "Wave height, sea temperature, currents around Phuket coast. Open-Meteo Marine API (free, no key).",
  pollInterval: 1800, // 30 minutes
  uiType: "table",
  tableColumns: [
    { key: "station", label: "Coast" },
    { key: "waveHeight", label: "Wave (m)" },
    { key: "sst", label: "SST °C" },
    { key: "riskLevel", label: "Sea State" },
  ],

  async fetchData() {
    // Per-station, parallel via Promise.allSettled — partial failures don't kill the response
    const settled = await Promise.allSettled(
      PHUKET_MARINE_STATIONS.map((s) => fetchStation(s.lat, s.lon)),
    );
    const out: MarineReading[] = [];
    settled.forEach((result, i) => {
      if (result.status !== "fulfilled") return;
      const s = PHUKET_MARINE_STATIONS[i];
      const c = result.value?.current ?? {};
      const waveH = Number(c.wave_height ?? 0);
      out.push({
        id: s.id,
        station: s.name,
        lat: s.lat,
        lon: s.lon,
        waveHeight: waveH,
        wavePeriod: Number(c.wave_period ?? 0),
        waveDirection: Number(c.wave_direction ?? 0),
        swellHeight: Number(c.swell_wave_height ?? 0),
        sst: Number(c.sea_surface_temperature ?? 0),
        currentVelocity: Number(c.ocean_current_velocity ?? 0),
        currentDirection: Number(c.ocean_current_direction ?? 0),
        riskLevel: classifyWaves(waveH),
        fishingAdvice: fishingAdvice(waveH, Number(c.wave_period ?? 0)),
        floodRisk: floodRisk(waveH),
        timestamp: c.time ?? new Date().toISOString(),
      });
    });
    return out;
  },

  mockData: PHUKET_MARINE_STATIONS.map(s => ({
    id: s.id,
    station: s.name,
    lat: s.lat,
    lon: s.lon,
    waveHeight: 0.6 + Math.random() * 0.8,
    wavePeriod: 6 + Math.random() * 4,
    waveDirection: 180 + Math.random() * 90,
    swellHeight: 0.4 + Math.random() * 0.5,
    sst: 29 + Math.random() * 1.5,
    currentVelocity: 0.1 + Math.random() * 0.3,
    currentDirection: 90 + Math.random() * 180,
    riskLevel: "moderate" as const,
    fishingAdvice: "Good for small boats. Watch period > 8s = swell.",
    floodRisk: "Low — normal coastal conditions.",
    timestamp: new Date().toISOString(),
  })),
};

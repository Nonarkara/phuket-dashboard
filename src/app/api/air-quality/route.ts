import { NextResponse } from "next/server";
import {
  loadLatestStoredAirQualitySnapshots,
  persistAirQualitySnapshots,
} from "../../../lib/history-store";
import type { AirQualityPoint } from "../../../types/dashboard";

// ─── GISTDA PM2.5 Thai Government Source ──────────────────────
// Open, hourly, per-district for Phuket's three amphoe (districts).
// No auth required. Source: pm25.gistda.or.th
const GISTDA_PM25_PROVINCE_URL =
  "https://pm25.gistda.or.th/rest/getPm25byProvince";
const GISTDA_PM25_LOCATION_URL =
  "https://pm25.gistda.or.th/rest/getPm25byLocation?lat=7.88&lng=98.38";

// Standard US EPA PM2.5 ↔ AQI breakpoints
const AQI_BREAKPOINTS: Array<{
  pm_lo: number; pm_hi: number;
  aqi_lo: number; aqi_hi: number;
}> = [
  { pm_lo: 0,     pm_hi: 12.0,  aqi_lo: 0,   aqi_hi: 50  },
  { pm_lo: 12.1,  pm_hi: 35.4,  aqi_lo: 51,  aqi_hi: 100 },
  { pm_lo: 35.5,  pm_hi: 55.4,  aqi_lo: 101, aqi_hi: 150 },
  { pm_lo: 55.5,  pm_hi: 150.4, aqi_lo: 151, aqi_hi: 200 },
  { pm_lo: 150.5, pm_hi: 250.4, aqi_lo: 201, aqi_hi: 300 },
  { pm_lo: 250.5, pm_hi: 500.4, aqi_lo: 301, aqi_hi: 500 },
];

function pm25ToAqi(pm25: number): number {
  const bp = AQI_BREAKPOINTS.find(
    (b) => pm25 >= b.pm_lo && pm25 <= b.pm_hi,
  );
  if (!bp) return 500;
  return Math.round(
    ((bp.aqi_hi - bp.aqi_lo) / (bp.pm_hi - bp.pm_lo)) * (pm25 - bp.pm_lo) +
      bp.aqi_lo,
  );
}

function getCategory(aqi: number): string {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// ─── District coordinate map ──────────────────────────────────
const AMPHOE_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  "Mueang Phuket": { lat: 7.8804, lng: 98.3923, label: "Phuket Town" },
  "Krathu":        { lat: 7.8964, lng: 98.2965, label: "Kathu / Patong" },
  "Tha Lang":      { lat: 8.1132, lng: 98.3069, label: "Thalang / Airport" },
};

async function fetchGistdaPhuket(): Promise<AirQualityPoint[]> {
  const res = await fetch(GISTDA_PM25_LOCATION_URL, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const data = Array.isArray(json)
    ? json[0]
    : (json as Record<string, unknown>)?.data;
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const amphoeList = d.pm25_amphoe;
  if (!Array.isArray(amphoeList)) return [];
  const observedAt = typeof d.datetimeEng === "object"
    ? new Date().toISOString()
    : new Date().toISOString();

  const mapped: AirQualityPoint[] = [];
  for (const a of amphoeList) {
    const amphoeName = String((a as Record<string, unknown>).ap_en ?? "");
    const rawPm25 = (a as Record<string, unknown>).pm25;
    const pm25 = typeof rawPm25 === "number" ? rawPm25 : 0;
    const coords = AMPHOE_COORDS[amphoeName];
    if (!coords) continue;
    const aqi = pm25ToAqi(pm25);
    mapped.push({
      label: coords.label,
      lat: coords.lat,
      lng: coords.lng,
      aqi,
      pm25: Math.round(pm25 * 10) / 10,
      category: getCategory(aqi),
      observedAt,
      source: "GISTDA PM2.5",
    });
  }
  return mapped;
}

// ─── Regional stations via Open-Meteo (non-Phuket coverage) ──

const REGIONAL_LOCATIONS = [
  { label: "Kamala",       lat: 7.9479, lng: 98.2803 },
  { label: "Khao Lak",    lat: 8.6367, lng: 98.2487 },
  { label: "Phang Nga",   lat: 8.4501, lng: 98.5311 },
  { label: "Krabi Town",  lat: 8.0863, lng: 98.9126 },
  { label: "Surat Thani", lat: 9.1397, lng: 99.3331 },
  { label: "Bangkok",     lat: 13.7563, lng: 100.5018 },
] as const;

async function fetchRegionalPoint(
  label: string,
  lat: number,
  lng: number,
): Promise<AirQualityPoint | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      current?: { time?: string; us_aqi?: number; pm2_5?: number };
    };
    const aqi = payload.current?.us_aqi;
    const pm25 = payload.current?.pm2_5;
    if (typeof aqi !== "number" || typeof pm25 !== "number") return null;
    return {
      label, lat, lng, aqi,
      pm25: Math.round(pm25 * 10) / 10,
      category: getCategory(aqi),
      observedAt: payload.current?.time
        ? new Date(payload.current.time).toISOString()
        : new Date().toISOString(),
      source: "Open-Meteo",
    };
  } catch {
    return null;
  }
}

const FALLBACK: AirQualityPoint[] = [
  { label: "Phuket Town",       lat: 7.8804, lng: 98.3923, aqi: 44, pm25: 9,  category: "Good",     source: "Fallback" },
  { label: "Kathu / Patong",    lat: 7.8964, lng: 98.2965, aqi: 41, pm25: 8,  category: "Good",     source: "Fallback" },
  { label: "Thalang / Airport", lat: 8.1132, lng: 98.3069, aqi: 37, pm25: 7,  category: "Good",     source: "Fallback" },
  { label: "Kamala",            lat: 7.9479, lng: 98.2803, aqi: 39, pm25: 8,  category: "Good",     source: "Fallback" },
  { label: "Khao Lak",          lat: 8.6367, lng: 98.2487, aqi: 35, pm25: 7,  category: "Good",     source: "Fallback" },
  { label: "Bangkok",           lat: 13.7563, lng: 100.5018, aqi: 92, pm25: 27, category: "Moderate", source: "Fallback" },
];

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Phuket districts from GISTDA (authoritative Thai gov data)
    const phuketPoints = await fetchGistdaPhuket().catch(() => [] as AirQualityPoint[]);

    // Regional from Open-Meteo
    const regionalResults = await Promise.all(
      REGIONAL_LOCATIONS.map((p) => fetchRegionalPoint(p.label, p.lat, p.lng)),
    );
    const regionalPoints = regionalResults.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );

    const combined = [...phuketPoints, ...regionalPoints];
    if (combined.length > 0) {
      try {
        await persistAirQualitySnapshots(combined);
      } catch { /* history is additive */ }
      return NextResponse.json(combined);
    }

    const stored = await loadLatestStoredAirQualitySnapshots();
    if (stored?.length) return NextResponse.json(stored);
    return NextResponse.json(FALLBACK);
  } catch {
    const stored = await loadLatestStoredAirQualitySnapshots();
    if (stored?.length) return NextResponse.json(stored);
    return NextResponse.json(FALLBACK);
  }
}

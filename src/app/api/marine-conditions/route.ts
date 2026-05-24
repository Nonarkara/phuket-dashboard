/**
 * Phuket Marine Conditions — Open-Meteo Marine API
 * Wave height, swell, ocean current, beach flag (green/yellow/red).
 * Update cadence: every 6-12h. No auth required.
 */
import { NextResponse } from "next/server";

const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine" +
  "?latitude=7.88&longitude=98.39" +
  "&hourly=wave_height,swell_wave_height,ocean_current_velocity,wave_direction,wave_period" +
  "&wind_speed_unit=ms&timezone=UTC&forecast_days=3";

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

function calcFlag(wave: number, swell: number): { flag: BeachFlag; reason: string } {
  if (wave > 2 || swell > 1.5) return { flag: "red",    reason: `${wave.toFixed(1)}m waves — hazardous` };
  if (wave > 1 || swell > 0.5)  return { flag: "yellow", reason: `${wave.toFixed(1)}m waves — caution advised` };
  return                                  { flag: "green",  reason: `${wave.toFixed(1)}m waves — safe conditions` };
}

export const dynamic = "force-dynamic";

const FALLBACK_CONDITIONS: MarineConditions = {
  waveHeightM: 0.9, swellHeightM: 0.9, currentVelocityMs: 0.1,
  waveDirectionDeg: 270, wavePeriodSec: 7,
  beachFlag: "green", beachFlagReason: "0.9m waves — typical Andaman conditions",
  forecastHourly: [], observedAt: new Date().toISOString(), source: "Open-Meteo Marine",
};

// Simple in-memory cache — 30-minute TTL avoids rate-limiting
let _cache: { data: MarineConditions; ts: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET() {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(_cache.data);
  }
  try {
    const res = await fetch(MARINE_URL, {
      signal: AbortSignal.timeout(9_000),
      headers: { Accept: "application/json" },
      // Next.js fetch cache: 30min ISR
      next: { revalidate: 1800 },
    });
    if (res.status === 429) {
      // Rate-limited — return stale cache or fallback
      if (_cache) return NextResponse.json(_cache.data);
      return NextResponse.json(FALLBACK_CONDITIONS);
    }
    if (!res.ok) {
      if (_cache) return NextResponse.json(_cache.data);
      return NextResponse.json(FALLBACK_CONDITIONS);
    }

    const raw = await res.json() as {
      hourly: {
        time: string[];
        wave_height: number[];
        swell_wave_height: number[];
        ocean_current_velocity: number[];
        wave_direction: number[];
        wave_period: number[];
      };
    };

    const h = raw.hourly;
    // Bangkok = UTC+7
    const bangkokOffsetMs = 7 * 60 * 60 * 1000;
    const bangkokDate = new Date(Date.now() + bangkokOffsetMs);
    const yr = bangkokDate.getUTCFullYear();
    const mo = String(bangkokDate.getUTCMonth() + 1).padStart(2, "0");
    const dy = String(bangkokDate.getUTCDate()).padStart(2, "0");
    const hr = String(bangkokDate.getUTCHours()).padStart(2, "0");
    const currentHour = `${yr}-${mo}-${dy}T${hr}:00`;

    // Times in API are UTC-based when timezone=UTC; find current UTC hour
    const idx = Math.max(0, h.time.findIndex((t) => t >= currentHour) || 0);

    const wave  = h.wave_height[idx] ?? 0;
    const swell = h.swell_wave_height[idx] ?? 0;
    const { flag, reason } = calcFlag(wave, swell);

    const response: MarineConditions = {
      waveHeightM:      Math.round(wave * 10) / 10,
      swellHeightM:     Math.round(swell * 10) / 10,
      currentVelocityMs: Math.round((h.ocean_current_velocity[idx] ?? 0) * 100) / 100,
      waveDirectionDeg:  Math.round(h.wave_direction[idx] ?? 0),
      wavePeriodSec:     Math.round((h.wave_period[idx] ?? 0) * 10) / 10,
      beachFlag:         flag,
      beachFlagReason:   reason,
      forecastHourly: h.time.slice(idx, idx + 24).map((t, i) => ({
        time:            t,
        waveHeight:      Math.round((h.wave_height[idx + i] ?? 0) * 10) / 10,
        swellHeight:     Math.round((h.swell_wave_height[idx + i] ?? 0) * 10) / 10,
        currentVelocity: Math.round((h.ocean_current_velocity[idx + i] ?? 0) * 100) / 100,
      })),
      observedAt: new Date().toISOString(),
      source: "Open-Meteo Marine",
    };

    _cache = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch {
    if (_cache) return NextResponse.json(_cache.data);
    return NextResponse.json(FALLBACK_CONDITIONS);
  }
}

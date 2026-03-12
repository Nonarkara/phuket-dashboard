import { NextResponse } from "next/server";
import {
  loadLatestStoredAirQualitySnapshots,
  persistAirQualitySnapshots,
} from "../../../lib/history-store";
import type { AirQualityPoint } from "../../../types/dashboard";

const AIR_QUALITY_LOCATIONS = [
  { label: "Phuket Town", lat: 7.8804, lng: 98.3923 },
  { label: "Patong", lat: 7.8964, lng: 98.2965 },
  { label: "Phuket Airport", lat: 8.1132, lng: 98.3069 },
  { label: "Kamala", lat: 7.9479, lng: 98.2803 },
  { label: "Khao Lak", lat: 8.6367, lng: 98.2487 },
  { label: "Phang Nga", lat: 8.4501, lng: 98.5311 },
  { label: "Krabi Town", lat: 8.0863, lng: 98.9126 },
  { label: "Surat Thani", lat: 9.1397, lng: 99.3331 },
  { label: "Ranong", lat: 9.9626, lng: 98.6388 },
  { label: "Trang", lat: 7.5594, lng: 99.6114 },
  { label: "Bangkok", lat: 13.7563, lng: 100.5018 },
  { label: "Singapore", lat: 1.3521, lng: 103.8198 },
] as const;

const fallbackAirQuality: AirQualityPoint[] = [
  { label: "Phuket Town", lat: 7.8804, lng: 98.3923, aqi: 44, pm25: 9, category: "Good" },
  { label: "Patong", lat: 7.8964, lng: 98.2965, aqi: 41, pm25: 8, category: "Good" },
  { label: "Phuket Airport", lat: 8.1132, lng: 98.3069, aqi: 37, pm25: 7, category: "Good" },
  { label: "Kamala", lat: 7.9479, lng: 98.2803, aqi: 39, pm25: 8, category: "Good" },
  { label: "Khao Lak", lat: 8.6367, lng: 98.2487, aqi: 35, pm25: 7, category: "Good" },
  { label: "Phang Nga", lat: 8.4501, lng: 98.5311, aqi: 38, pm25: 8, category: "Good" },
  { label: "Krabi Town", lat: 8.0863, lng: 98.9126, aqi: 40, pm25: 8, category: "Good" },
  { label: "Surat Thani", lat: 9.1397, lng: 99.3331, aqi: 48, pm25: 10, category: "Good" },
  { label: "Ranong", lat: 9.9626, lng: 98.6388, aqi: 33, pm25: 6, category: "Good" },
  { label: "Trang", lat: 7.5594, lng: 99.6114, aqi: 42, pm25: 9, category: "Good" },
  { label: "Bangkok", lat: 13.7563, lng: 100.5018, aqi: 92, pm25: 27, category: "Moderate" },
  { label: "Singapore", lat: 1.3521, lng: 103.8198, aqi: 58, pm25: 13, category: "Moderate" },
];

function getCategory(aqi: number) {
  if (aqi <= 50) {
    return "Good";
  }

  if (aqi <= 100) {
    return "Moderate";
  }

  if (aqi <= 150) {
    return "Unhealthy for Sensitive Groups";
  }

  if (aqi <= 200) {
    return "Unhealthy";
  }

  if (aqi <= 300) {
    return "Very Unhealthy";
  }

  return "Hazardous";
}

async function fetchPoint(
  label: string,
  lat: number,
  lng: number,
): Promise<AirQualityPoint | null> {
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      current?: { time?: string; us_aqi?: number; pm2_5?: number };
    };
    const aqi = payload.current?.us_aqi;
    const pm25 = payload.current?.pm2_5;
    const observedAt = payload.current?.time;

    if (typeof aqi !== "number" || typeof pm25 !== "number") {
      return null;
    }

    return {
      label,
      lat,
      lng,
      aqi,
      pm25,
      category: getCategory(aqi),
      observedAt:
        typeof observedAt === "string"
          ? new Date(observedAt).toISOString()
          : new Date().toISOString(),
      source: "Open-Meteo Air Quality",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const results = await Promise.all(
      AIR_QUALITY_LOCATIONS.map((point) =>
        fetchPoint(point.label, point.lat, point.lng),
      ),
    );
    const livePoints = results.filter(
      (result): result is AirQualityPoint => result !== null,
    );

    if (livePoints.length > 0) {
      const merged = results.map(
        (result, index) => result ?? fallbackAirQuality[index],
      );

      try {
        await persistAirQualitySnapshots(livePoints);
      } catch {
        // Database history is additive; live response should still succeed.
      }

      return NextResponse.json(merged);
    }

    const storedPoints = await loadLatestStoredAirQualitySnapshots();
    if (storedPoints && storedPoints.length > 0) {
      return NextResponse.json(storedPoints);
    }

    return NextResponse.json(fallbackAirQuality);
  } catch {
    const storedPoints = await loadLatestStoredAirQualitySnapshots();
    if (storedPoints && storedPoints.length > 0) {
      return NextResponse.json(storedPoints);
    }

    return NextResponse.json(fallbackAirQuality);
  }
}

import { NextResponse } from "next/server";

/**
 * Open-Meteo Flood Forecast Proxy
 *
 * Fetches river discharge predictions for key waterways near Phuket.
 * Uses the GloFAS-based Open-Meteo Flood API.
 * No API key required for non-commercial use.
 */

// Key river monitoring points near Phuket and southern Thailand
const MONITORING_POINTS = [
  { label: "Phuket Island (Klong Bang Yai)", lat: 7.89, lng: 98.39 },
  { label: "Phang Nga (Khlong Phang Nga)", lat: 8.45, lng: 98.52 },
  { label: "Krabi (Khlong Krabi Yai)", lat: 8.07, lng: 98.91 },
  { label: "Surat Thani (Tapi River)", lat: 9.14, lng: 99.33 },
  { label: "Ranong (Kraburi River)", lat: 9.97, lng: 98.64 },
];

interface DischargeResult {
  label: string;
  lat: number;
  lng: number;
  status: string;
  currentDischarge: number | null;
  maxForecast: number | null;
  forecastDays: number;
  unit: string;
}

export async function GET() {
  const results: DischargeResult[] = [];

  for (const point of MONITORING_POINTS) {
    try {
      const params = new URLSearchParams({
        latitude: String(point.lat),
        longitude: String(point.lng),
        daily: "river_discharge",
        forecast_days: "7",
        past_days: "2",
      });

      const res = await fetch(
        `https://flood-api.open-meteo.com/v1/flood?${params}`,
        { next: { revalidate: 3600 } },
      );

      if (res.ok) {
        const data = await res.json();
        const values: number[] = data?.daily?.river_discharge ?? [];
        const current = values.length > 2 ? values[2] : values[0] ?? null;
        const forecast = values.length > 0 ? Math.max(...values) : null;

        results.push({
          label: point.label,
          lat: point.lat,
          lng: point.lng,
          status: "ok",
          currentDischarge: current,
          maxForecast: forecast,
          forecastDays: 7,
          unit: "m³/s",
        });
      } else {
        results.push({
          label: point.label,
          lat: point.lat,
          lng: point.lng,
          status: "upstream_error",
          currentDischarge: null,
          maxForecast: null,
          forecastDays: 7,
          unit: "m³/s",
        });
      }
    } catch {
      results.push({
        label: point.label,
        lat: point.lat,
        lng: point.lng,
        status: "error",
        currentDischarge: null,
        maxForecast: null,
        forecastDays: 7,
        unit: "m³/s",
      });
    }
  }

  const maxDischarge = Math.max(
    ...results.filter((r) => r.maxForecast !== null).map((r) => r.maxForecast!),
    0,
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "Open-Meteo Flood API (GloFAS)",
    status: "ok",
    peakForecastDischarge: maxDischarge,
    monitoringPoints: results,
    sources: ["https://flood-api.open-meteo.com/v1/flood"],
  });
}

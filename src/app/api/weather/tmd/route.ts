import { NextResponse } from "next/server";

/**
 * TMD Weather Data Proxy
 *
 * Proxies Thai Meteorological Department data.
 * Requires TMD_UID and TMD_UKEY environment variables.
 */

export async function GET() {
  const uid = process.env.TMD_UID;
  const ukey = process.env.TMD_UKEY;

  if (!uid || !ukey) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "Thai Meteorological Department",
      status: "no_credentials",
      note: "Set TMD_UID and TMD_UKEY env vars to enable TMD data",
      warnings: [],
      forecast: null,
      sources: ["http://data.tmd.go.th/api/"],
    });
  }

  const warnings: Array<{ title: string; description: string; date: string }> = [];
  let forecast: unknown = null;

  // Weather warnings
  try {
    const res = await fetch(
      `http://data.tmd.go.th/api/WeatherWarningNews/V2/?uid=${uid}&ukey=${ukey}&format=json`,
      { next: { revalidate: 900 } },
    );

    if (res.ok) {
      const data = await res.json();
      const items = data?.Warnings?.Warning ?? [];
      for (const w of Array.isArray(items) ? items : []) {
        warnings.push({
          title: w?.Title ?? "Warning",
          description: w?.Description ?? "",
          date: w?.DateTimeOfIssue ?? "",
        });
      }
    }
  } catch {
    // TMD may be intermittent
  }

  // 7-day forecast for Phuket region
  try {
    const res = await fetch(
      `http://data.tmd.go.th/api/WeatherForecast7Days/V2/?uid=${uid}&ukey=${ukey}&format=json`,
      { next: { revalidate: 3600 } },
    );

    if (res.ok) {
      forecast = await res.json();
    }
  } catch {
    // TMD may be intermittent
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "Thai Meteorological Department",
    status: "ok",
    warnings,
    forecast,
    sources: [
      "http://data.tmd.go.th/api/WeatherWarningNews/V2/",
      "http://data.tmd.go.th/api/WeatherForecast7Days/V2/",
    ],
  });
}

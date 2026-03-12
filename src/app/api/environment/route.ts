import { NextResponse } from "next/server";

const MONITOR_LOCATIONS: {
  location: string;
  code: string;
  lat: number;
  lon: number;
}[] = [
  { location: "Phuket", code: "HKT", lat: 7.8804, lon: 98.3923 },
  { location: "Phang Nga", code: "PNA", lat: 8.4501, lon: 98.5311 },
  { location: "Krabi", code: "KBI", lat: 8.0863, lon: 98.9126 },
  { location: "Ranong", code: "RNG", lat: 9.9626, lon: 98.6388 },
  { location: "Surat Thani", code: "SNI", lat: 9.1397, lon: 99.3331 },
  { location: "Trang", code: "TRG", lat: 7.5594, lon: 99.6114 },
  { location: "Bangkok", code: "BKK", lat: 13.7563, lon: 100.5018 },
  { location: "Singapore", code: "SGP", lat: 1.3521, lon: 103.8198 },
];

interface EnvironmentData {
  code: string;
  location: string;
  temperature: number | null;
  aqi: number | null;
}

const fallbackData: EnvironmentData[] = [
  { code: "HKT", location: "Phuket", temperature: 30, aqi: 44 },
  { code: "PNA", location: "Phang Nga", temperature: 29, aqi: 39 },
  { code: "KBI", location: "Krabi", temperature: 30, aqi: 41 },
  { code: "RNG", location: "Ranong", temperature: 28, aqi: 36 },
  { code: "SNI", location: "Surat Thani", temperature: 31, aqi: 48 },
  { code: "TRG", location: "Trang", temperature: 30, aqi: 43 },
  { code: "BKK", location: "Bangkok", temperature: 33, aqi: 92 },
  { code: "SGP", location: "Singapore", temperature: 31, aqi: 58 },
];

async function fetchWeather(
  lat: number,
  lon: number,
): Promise<{ temperature: number | null }> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { temperature: null };
    const data = (await res.json()) as {
      current_weather?: { temperature?: number };
    };
    return { temperature: data.current_weather?.temperature ?? null };
  } catch {
    return { temperature: null };
  }
}

async function fetchAQI(
  lat: number,
  lon: number,
): Promise<{ aqi: number | null }> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { aqi: null };
    const data = (await res.json()) as {
      current?: { us_aqi?: number };
    };
    return { aqi: data.current?.us_aqi ?? null };
  } catch {
    return { aqi: null };
  }
}

export async function GET() {
  try {
    const results = await Promise.all(
      MONITOR_LOCATIONS.map(async (city) => {
        const [weather, airQuality] = await Promise.all([
          fetchWeather(city.lat, city.lon),
          fetchAQI(city.lat, city.lon),
        ]);

        return {
          code: city.code,
          location: city.location,
          temperature: weather.temperature,
          aqi: airQuality.aqi,
        };
      }),
    );

    // Use fallback values where API returned null
    const merged = results.map((result, i) => ({
      ...result,
      temperature: result.temperature ?? fallbackData[i]?.temperature ?? null,
      aqi: result.aqi ?? fallbackData[i]?.aqi ?? null,
    }));

    return NextResponse.json(merged);
  } catch (error: unknown) {
    console.error(
      "Environment data error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(fallbackData);
  }
}

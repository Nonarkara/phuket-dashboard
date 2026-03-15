import { NextResponse } from "next/server";

/**
 * NASA EONET Natural Events Proxy
 *
 * Fetches curated global natural events (wildfires, storms, volcanoes, floods).
 * Useful for regional situational awareness beyond Thailand-specific feeds.
 * No API key required.
 */

export async function GET() {
  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v2.1/events?status=open&days=7&limit=100",
      { next: { revalidate: 600 } },
    );

    if (!res.ok) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        provider: "NASA EONET",
        status: "upstream_error",
        events: [],
        sources: ["https://eonet.gsfc.nasa.gov/api/v2.1/events"],
      });
    }

    const data = await res.json();
    const allEvents = data?.events ?? [];

    // Filter to SE Asia / Indian Ocean region (rough bounding box)
    const regionalEvents = allEvents.filter((event: {
      geometries: Array<{ coordinates: number[] }>;
    }) => {
      const geo = event.geometries?.[0];
      if (!geo?.coordinates) return false;
      const [lng, lat] = geo.coordinates;
      // SE Asia + Indian Ocean: lat -10 to 25, lng 85 to 120
      return lat >= -10 && lat <= 25 && lng >= 85 && lng <= 120;
    });

    const events = allEvents.map((event: {
      id: string;
      title: string;
      categories: Array<{ title: string }>;
      geometries: Array<{ date: string; coordinates: number[] }>;
      sources: Array<{ url: string }>;
    }) => ({
      id: event.id,
      title: event.title,
      category: event.categories?.[0]?.title ?? "Unknown",
      date: event.geometries?.[0]?.date ?? null,
      lng: event.geometries?.[0]?.coordinates?.[0] ?? null,
      lat: event.geometries?.[0]?.coordinates?.[1] ?? null,
      sourceUrl: event.sources?.[0]?.url ?? null,
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "NASA EONET",
      status: "ok",
      totalGlobal: allEvents.length,
      regionalCount: regionalEvents.length,
      events,
      sources: ["https://eonet.gsfc.nasa.gov/api/v2.1/events"],
    });
  } catch (err) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "NASA EONET",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      events: [],
      sources: ["https://eonet.gsfc.nasa.gov/api/v2.1/events"],
    });
  }
}

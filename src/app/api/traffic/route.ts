import { NextResponse } from "next/server";

/**
 * Longdo Traffic Feed Proxy
 *
 * Fetches real-time traffic incidents from Longdo/ITIC.
 * No API key required for the public JSON feed.
 */

interface LongdoEvent {
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  start?: string;
  stop?: string;
}

export async function GET() {
  try {
    const res = await fetch("https://event.longdo.com/feed/json", {
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        provider: "Longdo/ITIC",
        status: "upstream_error",
        events: [],
        sources: ["https://event.longdo.com/feed/json"],
      });
    }

    const raw = await res.json();
    const events: LongdoEvent[] = Array.isArray(raw) ? raw : raw?.events ?? [];

    // Filter to Phuket region (roughly lat 7.5-8.7, lng 97.8-99.0)
    const phuketEvents = events.filter((e) => {
      if (!e.latitude || !e.longitude) return false;
      return (
        e.latitude >= 7.5 &&
        e.latitude <= 8.7 &&
        e.longitude >= 97.8 &&
        e.longitude <= 99.0
      );
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "Longdo/ITIC",
      status: "ok",
      totalEvents: events.length,
      phuketEvents: phuketEvents.length,
      events: phuketEvents.slice(0, 50).map((e) => ({
        title: e.title ?? "Traffic event",
        description: e.description ?? "",
        lat: e.latitude,
        lng: e.longitude,
        type: e.type ?? "unknown",
        start: e.start ?? null,
        stop: e.stop ?? null,
      })),
      sources: ["https://event.longdo.com/feed/json"],
    });
  } catch (err) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "Longdo/ITIC",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      events: [],
      sources: ["https://event.longdo.com/feed/json"],
    });
  }
}

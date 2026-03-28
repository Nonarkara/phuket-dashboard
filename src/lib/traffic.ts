import type { TrafficEvent, TrafficResponse } from "../types/dashboard";

interface LongdoEvent {
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  start?: string;
  stop?: string;
}

export async function loadTrafficFeed(): Promise<TrafficResponse> {
  try {
    const response = await fetch("https://event.longdo.com/feed/json", {
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return {
        generatedAt: new Date().toISOString(),
        provider: "Longdo/ITIC",
        status: "upstream_error",
        events: [],
      };
    }

    const raw = await response.json();
    const events: LongdoEvent[] = Array.isArray(raw) ? raw : raw?.events ?? [];

    const phuketEvents: TrafficEvent[] = events
      .filter((event) => {
        if (!event.latitude || !event.longitude) {
          return false;
        }

        return (
          event.latitude >= 7.5 &&
          event.latitude <= 8.7 &&
          event.longitude >= 97.8 &&
          event.longitude <= 99.0
        );
      })
      .slice(0, 50)
      .map((event) => ({
        title: event.title ?? "Traffic event",
        description: event.description ?? "",
        lat: event.latitude ?? 0,
        lng: event.longitude ?? 0,
        type: event.type ?? "unknown",
        start: event.start ?? null,
        stop: event.stop ?? null,
      }));

    return {
      generatedAt: new Date().toISOString(),
      provider: "Longdo/ITIC",
      status: "ok",
      events: phuketEvents,
    };
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      provider: "Longdo/ITIC",
      status: "error",
      events: [],
    };
  }
}

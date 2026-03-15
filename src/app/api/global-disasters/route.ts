import { NextResponse } from "next/server";

/**
 * GDACS Global Disaster Events Proxy
 *
 * Fetches active global disaster alerts from GDACS.
 * Covers earthquakes, floods, cyclones, volcanoes, droughts.
 * No API key required.
 */

export async function GET() {
  try {
    const res = await fetch(
      "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,FL,TC,VO,DR&alertlevel=Green;Orange;Red&limit=50",
      { next: { revalidate: 600 } },
    );

    if (!res.ok) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        provider: "GDACS",
        status: "upstream_error",
        events: [],
        sources: ["https://www.gdacs.org/gdacsapi/"],
      });
    }

    const data = await res.json();
    const features = data?.features ?? [];

    const events = features.map((f: {
      properties: {
        eventid: string;
        eventtype: string;
        name: string;
        alertlevel: string;
        alertscore: number;
        country: string;
        fromdate: string;
        todate: string;
        description: string;
        url: { report: string };
      };
      geometry: { coordinates: number[] };
    }) => ({
      id: `${f.properties.eventtype}-${f.properties.eventid}`,
      type: f.properties.eventtype,
      name: f.properties.name,
      alertLevel: f.properties.alertlevel,
      alertScore: f.properties.alertscore,
      country: f.properties.country,
      from: f.properties.fromdate,
      to: f.properties.todate,
      description: f.properties.description,
      reportUrl: f.properties.url?.report ?? null,
      lng: f.geometry?.coordinates?.[0] ?? null,
      lat: f.geometry?.coordinates?.[1] ?? null,
    }));

    // Flag events in SE Asia region
    const seAsiaEvents = events.filter(
      (e: { lat: number | null; lng: number | null }) =>
        e.lat !== null &&
        e.lng !== null &&
        e.lat >= -10 &&
        e.lat <= 25 &&
        e.lng >= 85 &&
        e.lng <= 120,
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "GDACS (Global Disaster Alert and Coordination System)",
      status: "ok",
      totalGlobal: events.length,
      seAsiaCount: seAsiaEvents.length,
      events,
      sources: ["https://www.gdacs.org/gdacsapi/"],
    });
  } catch (err) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "GDACS",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      events: [],
      sources: ["https://www.gdacs.org/gdacsapi/"],
    });
  }
}

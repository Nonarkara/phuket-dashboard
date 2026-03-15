import { NextResponse } from "next/server";

/**
 * USGS Earthquake Catalog Proxy
 *
 * Fetches recent earthquakes near the Andaman Sea / Phuket region.
 * Critical for tsunami early warning and seismic awareness.
 * No API key required.
 */

export async function GET() {
  try {
    // Andaman Sea / Indian Ocean region around Phuket
    // Wide bounding box to catch relevant seismic activity
    const params = new URLSearchParams({
      format: "geojson",
      minlatitude: "0",
      maxlatitude: "15",
      minlongitude: "90",
      maxlongitude: "105",
      minmagnitude: "2.5",
      orderby: "time",
      limit: "50",
    });

    const res = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`,
      { next: { revalidate: 300 } },
    );

    if (!res.ok) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        provider: "USGS",
        status: "upstream_error",
        earthquakes: [],
        sources: ["https://earthquake.usgs.gov/fdsnws/event/1/"],
      });
    }

    const geojson = await res.json();
    const features = geojson?.features ?? [];

    const earthquakes = features.map((f: {
      id: string;
      properties: {
        mag: number;
        place: string;
        time: number;
        url: string;
        tsunami: number;
        alert: string | null;
        type: string;
      };
      geometry: { coordinates: number[] };
    }) => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      url: f.properties.url,
      tsunamiFlag: f.properties.tsunami === 1,
      alert: f.properties.alert,
      type: f.properties.type,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      depth: f.geometry.coordinates[2],
    }));

    const tsunamiRelevant = earthquakes.filter(
      (eq: { tsunamiFlag: boolean; magnitude: number }) =>
        eq.tsunamiFlag || eq.magnitude >= 5.0,
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "USGS Earthquake Hazards Program",
      status: "ok",
      region: "Andaman Sea / Indian Ocean (0-15N, 90-105E)",
      totalEvents: earthquakes.length,
      tsunamiRelevant: tsunamiRelevant.length,
      earthquakes,
      sources: ["https://earthquake.usgs.gov/fdsnws/event/1/"],
    });
  } catch (err) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "USGS",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      earthquakes: [],
      sources: ["https://earthquake.usgs.gov/fdsnws/event/1/"],
    });
  }
}

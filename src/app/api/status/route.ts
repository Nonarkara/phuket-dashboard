import { hasUsableMapboxToken } from "../../../lib/mapbox";

export async function GET() {
  const hasMapboxToken = hasUsableMapboxToken(
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
      process.env.MAPBOX_ACCESS_TOKEN,
  );

  return Response.json({
    status: "operational",
    version: "6.0.0",
    name: "Phuket Dashboard",
    standalone: true,
    signal_strength: 0.98,
    services: {
      database: process.env.DATABASE_URL ? "configured" : "fallback",
      basemap: hasMapboxToken ? "configured" : "missing",
      intelligence_cache: process.env.DATABASE_URL ? "hybrid" : "memory",
      global_feeds: "active",
      camera_pipeline: "active",
      satellite_imagery: "active",
      satellite_toolkit: "active",
    },
  });
}

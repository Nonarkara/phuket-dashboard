import { hasUsableMapboxToken } from "../../../lib/mapbox";

export async function GET() {
  const hasMapboxToken = hasUsableMapboxToken(
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
      process.env.MAPBOX_ACCESS_TOKEN,
  );

  return Response.json({
    status: "operational",
    version: "4.3.0",
    signal_strength: 0.98,
    services: {
      database: process.env.DATABASE_URL ? "configured" : "fallback",
      basemap: hasMapboxToken ? "configured" : "missing",
      reference_dashboard: process.env.REFERENCE_DASHBOARD_URL
        ? "configured"
        : "default",
      intelligence_cache: process.env.DATABASE_URL ? "hybrid" : "memory",
      ai_summary: process.env.OPENAI_API_KEY ? "configured" : "fallback",
    },
  });
}

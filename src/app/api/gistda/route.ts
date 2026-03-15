import { NextResponse } from "next/server";

/**
 * GISTDA Flood & Disaster Proxy
 *
 * Fetches flood area data from GISTDA's open API.
 * Disaster hotspot requires GISTDA Sphere API key (optional).
 */

export async function GET() {
  const layers: Array<{
    id: string;
    label: string;
    status: string;
    featureCount: number | null;
    source: string;
  }> = [];

  // 1. GISTDA Flood API (public, no key)
  for (const period of ["1day", "3day", "7day"] as const) {
    try {
      const res = await fetch(
        `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${period}`,
        { next: { revalidate: 1800 } },
      );

      if (res.ok) {
        const data = await res.json();
        const features = data?.features ?? [];
        layers.push({
          id: `flood-${period}`,
          label: `Flood ${period}`,
          status: "ok",
          featureCount: Array.isArray(features) ? features.length : 0,
          source: `GISTDA Flood API (${period})`,
        });
      } else {
        layers.push({
          id: `flood-${period}`,
          label: `Flood ${period}`,
          status: "upstream_error",
          featureCount: null,
          source: `GISTDA Flood API (${period})`,
        });
      }
    } catch {
      layers.push({
        id: `flood-${period}`,
        label: `Flood ${period}`,
        status: "error",
        featureCount: null,
        source: `GISTDA Flood API (${period})`,
      });
    }
  }

  // 2. GISTDA Sphere Disaster Hotspot (requires key)
  const sphereKey = process.env.GISTDA_SPHERE_KEY;
  if (sphereKey) {
    try {
      const res = await fetch(
        `https://api.sphere.gistda.or.th/services/info/disaster-hotspot?lat=7.886&lon=98.334&radius=100&key=${sphereKey}`,
        { next: { revalidate: 1800 } },
      );

      if (res.ok) {
        const data = await res.json();
        layers.push({
          id: "disaster-hotspot",
          label: "Disaster Hotspot (Sphere)",
          status: "ok",
          featureCount: Array.isArray(data?.data) ? data.data.length : 0,
          source: "GISTDA Sphere API",
        });
      } else {
        layers.push({
          id: "disaster-hotspot",
          label: "Disaster Hotspot (Sphere)",
          status: "upstream_error",
          featureCount: null,
          source: "GISTDA Sphere API",
        });
      }
    } catch {
      layers.push({
        id: "disaster-hotspot",
        label: "Disaster Hotspot (Sphere)",
        status: "error",
        featureCount: null,
        source: "GISTDA Sphere API",
      });
    }
  } else {
    layers.push({
      id: "disaster-hotspot",
      label: "Disaster Hotspot (Sphere)",
      status: "no_key",
      featureCount: null,
      source: "GISTDA Sphere API (GISTDA_SPHERE_KEY not set)",
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "GISTDA",
    layers,
    sources: [
      "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/",
      "https://api.sphere.gistda.or.th/services/info/disaster-hotspot",
    ],
  });
}

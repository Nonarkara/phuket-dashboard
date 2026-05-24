/**
 * GISTDA Disaster Platform — current disaster signals for Phuket region.
 *
 * Sources:
 *   - Flood extent (1-day): gi-service v1.1 — returns active flood polygons or {"result":"not found"}
 *   - Burnt area (latest): gi-service v1.2 — returns fire/burn scar polygon or 502 when backend down
 *
 * Auth: api_key query param — stored as GISTDA_API_KEY env var.
 * Update cadence: flood is near-real-time (1-day window); burnt area is ~1 satellite pass.
 */
import { NextResponse } from "next/server";
import { cached } from "../../../../lib/cache";

const KEY = process.env.GISTDA_API_KEY ?? "";
const GI_BASE = "https://api-gateway.gistda.or.th/api/2.0/resources/gi-service";

// Phuket bounding box
const PHUKET_LAT = 7.88;
const PHUKET_LON = 98.38;

interface GistdaDisasterResponse {
  floodActive: boolean;
  floodData: unknown | null;
  floodFetchedAt: string;
  burntAreaData: unknown | null;
  burntAreaFetchedAt: string;
  source: "GISTDA gi-service";
}

async function fetchGistda(path: string): Promise<unknown | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(
      `${GI_BASE}/${path}?lat=${PHUKET_LAT}&lon=${PHUKET_LON}&api_key=${KEY}`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 0 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    // {"result":"not found"} = no active incident — still a valid "all clear" response
    return json;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date().toISOString();

  const [floodRaw, burntRaw] = await Promise.all([
    fetchGistda("v1.1/disasters/flood-extent-1day"),
    fetchGistda("v1.2/disasters/burnt-area-latest"),
  ]);

  const floodActive =
    floodRaw !== null &&
    typeof floodRaw === "object" &&
    !(floodRaw as Record<string, unknown>).result;

  const response: GistdaDisasterResponse = {
    floodActive,
    floodData: floodActive ? floodRaw : null,
    floodFetchedAt: now,
    burntAreaData: burntRaw,
    burntAreaFetchedAt: now,
    source: "GISTDA gi-service",
  };

  return NextResponse.json(response);
}

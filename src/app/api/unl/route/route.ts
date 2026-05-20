/**
 * UNL Global Routing Proxy — turn-by-turn navigation via GrabMaps.
 *
 * UNL provides routing optimized for Southeast Asia (GrabMaps backbone) which
 * outperforms HERE/TomTom in Thai roads. Confirmed working 2026-05-20:
 * Phuket Airport → Rawai Pier = 31.8km, 51min, 7 turn-by-turn steps.
 *
 * Auth: server-side only. Never expose keys to client.
 *   - x-unl-api-key       (Workers secret UNL_API_KEY)
 *   - x-unl-vpm-id        (Workers secret UNL_VPM_ID)
 *
 * Request body: { waypoints: [{ lat, lng }, ...] }
 * Response: UNL native shape { start, end, segments[], overview, name }
 *
 * Pricing: free tier on premium account (gifted via business manager).
 */
import { NextRequest, NextResponse } from "next/server";

const UNL_BASE = "https://api.unl.global/v1";

// Inline geohash encoder — public domain, ~30 lines.
// Avoids adding ngeohash dependency for a single function.
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohashEncode(lat: number, lon: number, precision = 9): string {
  let minLat = -90,  maxLat = 90;
  let minLon = -180, maxLon = 180;
  let hash = "";
  let bits = 0, bit = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) { bits = (bits << 1) | 1; minLon = mid; }
      else            { bits = (bits << 1);     maxLon = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; minLat = mid; }
      else            { bits = (bits << 1);     maxLat = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32[bits]; bits = 0; bit = 0; }
  }
  return hash;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Waypoint { lat: number; lng: number }
interface RouteRequest { waypoints: Waypoint[] }

export async function POST(req: NextRequest) {
  const apiKey = process.env.UNL_API_KEY;
  const vpmId  = process.env.UNL_VPM_ID;

  if (!apiKey || !vpmId) {
    return NextResponse.json(
      { error: "UNL credentials not configured", code: "no_credentials" },
      { status: 503 },
    );
  }

  let body: RouteRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.waypoints) || body.waypoints.length < 2) {
    return NextResponse.json(
      { error: "At least 2 waypoints required" },
      { status: 400 },
    );
  }

  // UNL requires geohash-format waypoints (confirmed in WaypointType enum).
  // Precision 9 (~4.8m) is a good balance for road routing.
  const waypoints = body.waypoints.map((w) => ({
    type: "geohash" as const,
    geohash: geohashEncode(w.lat, w.lng, 9),
  }));

  try {
    const upstream = await fetch(`${UNL_BASE}/routing`, {
      method: "POST",
      headers: {
        "x-unl-api-key": apiKey,
        "x-unl-vpm-id": vpmId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ waypoints }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { error: "UNL routing failed", status: upstream.status, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await upstream.json();

    // Convenience: sum totals if segments present
    const segments = data?.segments ?? [];
    const totalLengthM = segments.reduce(
      (s: number, seg: { length?: number }) => s + (seg.length || 0),
      0,
    );
    const totalDurationS = segments.reduce(
      (s: number, seg: { duration?: number }) => s + (seg.duration || 0),
      0,
    );

    return NextResponse.json({
      ...data,
      totals: {
        distanceM:  totalLengthM,
        durationS:  totalDurationS,
        distanceKm: +(totalLengthM / 1000).toFixed(2),
        durationMin: +(totalDurationS / 60).toFixed(1),
      },
      provider: "UNL Global (GrabMaps SE Asia)",
      _ts: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "UNL fetch failed", detail: String(err) },
      { status: 502 },
    );
  }
}

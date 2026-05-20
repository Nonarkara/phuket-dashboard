/**
 * UNL Global Isochrone Proxy — reachability polygons.
 *
 * Returns a polygon showing all locations reachable within X minutes from
 * an origin point. The governor's "what can a bus/ambulance/citizen reach
 * in 15/30/60 minutes?" question, answered with real GrabMaps road data.
 *
 * Request body: { lat, lng, minutes: number[], mode?: 'car'|'pedestrian' }
 * Response:     { isochrones: [{ minutes, geometry: GeoJSON }, ...] }
 */
import { NextRequest, NextResponse } from "next/server";

const UNL_BASE = "https://api.unl.global/v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Inline geohash encoder (same as route.ts — single-purpose, no dep)
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

interface IsochroneRequest {
  lat: number;
  lng: number;
  minutes?: number[];      // default [15, 30, 60]
  mode?: "car" | "pedestrian";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.UNL_API_KEY;
  const vpmId  = process.env.UNL_VPM_ID;

  if (!apiKey || !vpmId) {
    return NextResponse.json(
      { error: "UNL credentials not configured" },
      { status: 503 },
    );
  }

  let body: IsochroneRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const minutes = body.minutes ?? [15, 30, 60];
  const mode = body.mode === "pedestrian" ? "pedestrian" : "car";
  const origin = {
    type: "geohash" as const,
    geohash: geohashEncode(body.lat, body.lng, 9),
  };

  // Fetch all bands in parallel.
  // UNL schema (confirmed 2026-05-20): /v1/routing/isoline
  //   { origin: {type,geohash}, range: {type:'time', value:<seconds>}, transportMode }
  // Returns { isoline: { type:'Feature', geometry: {type:'Polygon', coordinates: [...]}}}
  const results = await Promise.all(
    minutes.map(async (m) => {
      try {
        const r = await fetch(`${UNL_BASE}/routing/isoline`, {
          method: "POST",
          headers: {
            "x-unl-api-key": apiKey,
            "x-unl-vpm-id":  vpmId,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            origin,
            range: { type: "time", value: m * 60 },
            transportMode: mode,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) {
          const text = await r.text();
          return { minutes: m, error: text.slice(0, 200), status: r.status };
        }
        const data = await r.json();
        // Normalise: return { minutes, geometry } so the client can render directly
        return {
          minutes: m,
          geometry: data?.isoline?.geometry ?? null,
          raw: data,
        };
      } catch (err) {
        return { minutes: m, error: String(err) };
      }
    }),
  );

  return NextResponse.json({
    origin: { lat: body.lat, lng: body.lng, geohash: origin.geohash },
    mode,
    minutes,
    isochrones: results,
    provider: "UNL Global (GrabMaps SE Asia)",
    _ts: Date.now(),
  });
}

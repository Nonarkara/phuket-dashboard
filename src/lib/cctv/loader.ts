// ─── CCTV slot loader (shared) ──────────────────────────────────
// Serves a province's fixed slot registry and attempts to auto-wire
// highway slots from the DOH ITS public camera list (its.doh.go.th).
// A DOH camera inside the province bbox that sits near a defined slot
// fills that slot's snapshotUrl; remaining in-province DOH cameras are
// appended as extra live slots. Fails silently back to standby slots.

import { cached } from "../cache";
import type { CctvFeedResponse, CctvSlot } from "../../types/cctv";

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface DohCamera {
  id?: string | number;
  name?: string;
  route?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  status?: string;
}

async function fetchDohCameras(): Promise<DohCamera[]> {
  const res = await fetch("https://its.doh.go.th/api/cctv/list", {
    headers: { "User-Agent": "ProvinceDashboard/1.0" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return Array.isArray(json) ? (json as DohCamera[]) : [];
}

export async function loadCctvFeed(opts: {
  cacheKey: string;
  registry: CctvSlot[];
  bbox: Bbox;
  fallbackCorridorId: string;
}): Promise<CctvFeedResponse> {
  return cached(opts.cacheKey, 300, async () => {
    // Deep-copy so auto-wiring never mutates module state.
    const slots: CctvSlot[] = opts.registry.map((s) => ({ ...s, wiring: { ...s.wiring } }));
    const b = opts.bbox;
    const inBbox = (lat: number, lon: number) =>
      lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

    try {
      const doh = (await fetchDohCameras()).filter(
        (c) =>
          typeof c.lat === "number" && typeof c.lng === "number" && inBbox(c.lat, c.lng) && !!c.image_url,
      );
      const extras: CctvSlot[] = [];
      for (const cam of doh) {
        const nearest = slots
          .filter((s) => s.wiring.owner === "DOH ITS" && !s.snapshotUrl)
          .map((s) => ({ s, d: Math.hypot(s.lat - cam.lat!, s.lon - cam.lng!) }))
          .sort((x, y) => x.d - y.d)[0];
        if (nearest && nearest.d < 0.03) {
          nearest.s.snapshotUrl = cam.image_url ?? null;
          nearest.s.status = "live";
        } else if (extras.length < 6) {
          extras.push({
            id: `cctv-doh-${cam.id ?? extras.length}`,
            label: cam.name || `DOH camera ${cam.id ?? ""}`,
            district: cam.route ? `Route ${cam.route}` : "Highway",
            corridorId: opts.fallbackCorridorId,
            lat: cam.lat!,
            lon: cam.lng!,
            status: "live",
            snapshotUrl: cam.image_url ?? null,
            streamUrl: null,
            wiring: { protocol: "snapshot", owner: "DOH ITS", note: "Auto-wired from its.doh.go.th public camera list." },
          });
        }
      }
      slots.push(...extras);
    } catch {
      // DOH unreachable — registry ships as standby slots.
    }

    const liveCount = slots.filter((s) => s.status === "live").length;
    return { generatedAt: new Date().toISOString(), slots, liveCount, standbyCount: slots.length - liveCount };
  });
}

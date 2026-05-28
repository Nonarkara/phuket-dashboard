/**
 * Phuket motorcycle-accident blackspots — corridor-segment anchors.
 *
 * Phuket runs 3.6× Bangkok's per-capita road-death rate; 92% of casualties are
 * motorcyclists (see phuket-road-safety.ts / THAIRSC). The deadliest geometry is
 * steep terrain in the wet season: Route 4029 over Patong Hill (the "death
 * descent") drops ~300 m on tight hairpins, and Phuket has rain ~8 months a year.
 * Rendered on the 3D terrain, these points sit ON the slope so the gradient that
 * explains the crashes is visible.
 *
 * Coordinates are segment anchors on documented high-fatality corridors (OSM road
 * geometry), aligned to the THAIRSC district totals in phuket-road-safety.ts.
 * THAIRSC publishes district aggregates, not per-spot crash coordinates — these
 * mark the corridors, not individual official crash records.
 *
 * Source: Thai Road Safety Center (THAIRSC) district breakdown +
 * documented Phuket blackspot reporting. Last reviewed: 2026-05-28.
 */

export type BlackspotSeverity = "high" | "medium";
export type BlackspotKind =
  | "steep-descent"
  | "curve"
  | "junction"
  | "roundabout"
  | "straight";

export interface Blackspot {
  id: string;
  name: string;
  lng: number;
  lat: number;
  corridor: string; // matches PHUKET_DISTRICTS corridor labels
  district: string;
  severity: BlackspotSeverity;
  kind: BlackspotKind;
  note: string;
}

export const PHUKET_BLACKSPOTS: Blackspot[] = [
  // ── Route 4029 · Patong Hill — the steep "death descent" (Kathu → Patong) ──
  {
    id: "patong-hill-summit",
    name: "Patong Hill summit hairpin",
    lng: 98.3253,
    lat: 7.9087,
    corridor: "Patong",
    district: "Kathu",
    severity: "high",
    kind: "steep-descent",
    note: "Route 4029 viewpoint hairpin. Steep grade into tight bends; wet-season runoff and brake fade on the descent. Frequent motorcycle and truck runaways.",
  },
  {
    id: "patong-hill-west",
    name: "Patong Hill west descent",
    lng: 98.318,
    lat: 7.905,
    corridor: "Patong",
    district: "Kathu",
    severity: "high",
    kind: "steep-descent",
    note: "Steepest section dropping toward Patong. ~12% grade; loss-of-control crashes spike in rain.",
  },
  {
    id: "kathu-hill-base",
    name: "Kathu hill base",
    lng: 98.332,
    lat: 7.911,
    corridor: "Patong",
    district: "Kathu",
    severity: "medium",
    kind: "curve",
    note: "Eastern foot of Route 4029 where the descent meets Kathu traffic. Speed carried off the hill into a populated junction.",
  },
  {
    id: "kalim-curve",
    name: "Kalim coastal curve",
    lng: 98.296,
    lat: 7.904,
    corridor: "Patong",
    district: "Kathu",
    severity: "medium",
    kind: "curve",
    note: "North Patong beach-road bend before the hill approach. Wet surface and pedestrian traffic.",
  },

  // ── Mueang Phuket / Old Town — highest district death toll (106) ──
  {
    id: "samkong-intersection",
    name: "Samkong intersection",
    lng: 98.378,
    lat: 7.9,
    corridor: "Old Town",
    district: "Mueang Phuket",
    severity: "high",
    kind: "junction",
    note: "Major Old Town junction mixing motorcycles with heavy vehicles on Thepkasattri Rd. High-volume conflict point.",
  },
  {
    id: "thepkasattri-bypass",
    name: "Thepkasattri / bypass junction",
    lng: 98.388,
    lat: 7.8881,
    corridor: "Old Town",
    district: "Mueang Phuket",
    severity: "medium",
    kind: "junction",
    note: "Arterial junction into Old Town. Speed-camera and signage audit candidate (ROAD_SAFETY_ACTIONS).",
  },
  {
    id: "chaofa-junction",
    name: "Chao Fa junction",
    lng: 98.365,
    lat: 7.87,
    corridor: "Old Town",
    district: "Mueang Phuket",
    severity: "medium",
    kind: "junction",
    note: "Chao Fa East/West split south of Old Town. Mixed-use lanes, motorcycle-heavy.",
  },
  {
    id: "chalong-circle",
    name: "Chalong Circle",
    lng: 98.339,
    lat: 7.847,
    corridor: "Old Town",
    district: "Mueang Phuket",
    severity: "high",
    kind: "roundabout",
    note: "Phuket's busiest roundabout — five arterials feed it. Motorcycle entry/exit conflicts; chronic crash cluster.",
  },

  // ── Thalang / Airport north — Route 402 (47 deaths) ──
  {
    id: "heroines-monument",
    name: "Heroines' Monument roundabout",
    lng: 98.364,
    lat: 7.993,
    corridor: "Airport north",
    district: "Thalang",
    severity: "high",
    kind: "roundabout",
    note: "Anusawari roundabout on Route 402 — high-speed approaches converge. Major north-corridor crash point.",
  },
  {
    id: "thalang-402-straight",
    name: "Thalang Route 402 straight",
    lng: 98.338,
    lat: 8.025,
    corridor: "Airport north",
    district: "Thalang",
    severity: "medium",
    kind: "straight",
    note: "Open straight where speeds climb; overtaking crashes and roadside access conflicts.",
  },
  {
    id: "airport-junction",
    name: "Airport junction",
    lng: 98.316,
    lat: 8.1,
    corridor: "Airport north",
    district: "Thalang",
    severity: "medium",
    kind: "junction",
    note: "Route 4031/402 airport approach. Tourist riders unfamiliar with the road; peak-hour congestion.",
  },
];

/** GeoJSON FeatureCollection for direct MapLibre `addSource`. */
export function blackspotsGeoJSON() {
  return {
    type: "FeatureCollection" as const,
    features: PHUKET_BLACKSPOTS.map((b) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [b.lng, b.lat] },
      properties: {
        id: b.id,
        name: b.name,
        corridor: b.corridor,
        district: b.district,
        severity: b.severity,
        kind: b.kind,
        note: b.note,
      },
    })),
  };
}

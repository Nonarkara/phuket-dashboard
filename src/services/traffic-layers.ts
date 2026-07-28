/**
 * Live road congestion — Longdo Traffic vector tiles (the layer behind
 * live.iticfoundation.org).
 *
 * Reverse-engineered 2026-07-28: https://msv.longdo.com/maps/traffic/{z}/{x}/{y}.pbf
 * is CORS-open (`access-control-allow-origin: *`), keyless, zoom 5-12, single
 * line layer named "traffic", refreshed ~3 min (cache-control: max-age=180).
 * ~2,150 live segments over Phuket at the time of wiring. No Worker proxy needed —
 * deck.gl reads the tiles directly and the browser cache honours the 3-min TTL.
 *
 * Each feature carries TWO colours: `fillcolor` (forward direction) and
 * `fillcolor_r` (reverse), each "54C00C" green / "FEDE04" slow / "FF2020" red /
 * "" no data. The official Longdo style renders only `fillcolor` — which silently
 * drops every reverse-only segment (68 of 298 features in one Phuket-town tile).
 * We render both as two layers: forward wide, reverse narrow underneath.
 *
 * Attribution requirement from the tilejson: "Longdo Traffic" — surfaced in the
 * overlay chip row in BorderMap. Speeds are NOT in the tiles, only the 3-bucket
 * colour; do not present this as km/h.
 */
import { MVTLayer } from "@deck.gl/geo-layers";
import type { Layer } from "@deck.gl/core";

const TILE_URL = "https://msv.longdo.com/maps/traffic/{z}/{x}/{y}.pbf";

type TrafficFeature = { properties: { fillcolor?: string; fillcolor_r?: string; r_char?: string } };

const TRANSPARENT: [number, number, number, number] = [0, 0, 0, 0];

function bucketColor(hex: string | undefined, alpha: number): [number, number, number, number] {
  switch (hex) {
    case "54C00C": return [46, 160, 67, alpha];   // free flow
    case "FEDE04": return [245, 158, 11, alpha];  // slow
    case "FF2020": return [239, 68, 68, alpha];   // congested
    default: return TRANSPARENT;                  // "" = no probe data on this side
  }
}

export function createTrafficLayers(visible: boolean): Layer[] {
  if (!visible) return [];
  const common = {
    data: TILE_URL,
    minZoom: 5,
    // The server's real ceiling. Above z12 deck overzooms z12 geometry — do NOT
    // raise this: past-max requests return empty/garbage, not sharper roads.
    maxZoom: 12,
    lineWidthUnits: "pixels" as const,
    pickable: false,
    parameters: { depthTest: false },
    // Congestion state changes every ~3 min; without this the tile cache would
    // pin the first-loaded state for the whole session.
    refinementStrategy: "no-overlap" as const,
  };
  return [
    // Reverse direction first (under), narrower — visible where the forward side
    // has no data, and as a darker seam where both are congested.
    new MVTLayer({
      ...common,
      id: "traffic-reverse",
      getLineColor: (f: TrafficFeature) => bucketColor(f.properties.fillcolor_r, 150),
      getLineWidth: 1.2,
      lineWidthMinPixels: 1.2,
    }),
    new MVTLayer({
      ...common,
      id: "traffic-forward",
      getLineColor: (f: TrafficFeature) => bucketColor(f.properties.fillcolor, 210),
      getLineWidth: 2.4,
      lineWidthMinPixels: 2.4,
    }),
  ];
}

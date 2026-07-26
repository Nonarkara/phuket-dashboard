/**
 * Administrative boundary layers.
 *
 * Kept out of map-engine.ts on purpose: that file is ~1,800 lines of layer factories
 * and BorderMap wires each one through four separate edits. These three are additive
 * and self-contained, so adding a boundary does not mean touching the existing
 * overlay plumbing.
 *
 * House style: hairlines only, no fills except the scope dim-out, zero radius.
 */
import { GeoJsonLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};
type Collection = { type: "FeatureCollection"; features: Feature[] };

/** Hairline district outlines — the heavier of the two administrative tiers. */
export function createDistrictLayer(data: Collection | null, visible: boolean): Layer | null {
  if (!data || !visible) return null;
  return new GeoJsonLayer({
    id: "admin-districts",
    data: data as never,
    stroked: true,
    filled: false,
    lineWidthUnits: "pixels",
    getLineWidth: 1.6,
    lineWidthMinPixels: 1.6,
    getLineColor: [88, 166, 255, 190],
    pickable: false,
    parameters: { depthTest: false },
  });
}

/** Lighter outlines for the 18 local governments. */
export function createLocalGovLayer(
  data: Collection | null,
  visible: boolean,
  onClick?: (id: string) => void,
): Layer | null {
  if (!data || !visible) return null;
  return new GeoJsonLayer({
    id: "admin-localgov",
    data: data as never,
    stroked: true,
    filled: true,
    lineWidthUnits: "pixels",
    getLineWidth: 0.7,
    lineWidthMinPixels: 0.7,
    getLineColor: [230, 237, 243, 90],
    // Near-invisible fill so the polygon is clickable without tinting the map.
    getFillColor: [255, 255, 255, 6],
    pickable: Boolean(onClick),
    onClick: onClick
      ? (info) => {
          const id = (info.object as Feature | undefined)?.properties?.id;
          if (typeof id === "string") onClick(id);
          return true;
        }
      : undefined,
    parameters: { depthTest: false },
  });
}

/**
 * Highlight the active scope: amber outline on the selection.
 *
 * Amber is the one accent (workspace CLAUDE.md §14 rule 1) — it marks the single
 * thing the operator has chosen, which is exactly what that rule reserves it for.
 */
export function createScopeHighlightLayer(
  geometry: { type: string; coordinates: unknown } | null,
): Layer | null {
  if (!geometry) return null;
  return new GeoJsonLayer({
    id: "admin-scope-active",
    data: { type: "Feature", properties: {}, geometry } as never,
    stroked: true,
    filled: false,
    lineWidthUnits: "pixels",
    getLineWidth: 2.4,
    lineWidthMinPixels: 2.4,
    getLineColor: [245, 158, 11, 235],
    pickable: false,
    parameters: { depthTest: false },
  });
}

/** Zoom that fits a bbox in the viewport, clamped to the map's own limits. */
export function zoomForBounds(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  minZoom: number,
  maxZoom: number,
): number {
  const [minX, minY, maxX, maxY] = bbox;
  const lonSpan = Math.max(maxX - minX, 1e-6);
  const latSpan = Math.max(maxY - minY, 1e-6);
  // Web Mercator world is 512px at zoom 0; leave ~15% padding.
  const zoomX = Math.log2((width * 0.85) / (512 * (lonSpan / 360)));
  const midLat = ((minY + maxY) / 2) * (Math.PI / 180);
  const latFraction = (latSpan * (Math.PI / 180)) / (2 * Math.PI) / Math.cos(midLat);
  const zoomY = Math.log2((height * 0.85) / (512 * latFraction));
  return Math.min(maxZoom, Math.max(minZoom, Math.min(zoomX, zoomY)));
}

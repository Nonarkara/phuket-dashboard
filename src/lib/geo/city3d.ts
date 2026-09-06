// ─── 3D City Layer (shared) ─────────────────────────────────────
// Every OSM building extruded on real terrain — the same data pipeline
// Arnis (arnismc.com) uses to rebuild real places (OpenStreetMap
// footprints + heights, AWS Terrain Tiles DEM), rendered live as
// MapLibre fill-extrusions. Ported from the Phuket BorderMap stack:
//   OpenFreeMap planet vector tiles (source-layer "building")
//   + Terrarium DEM terrain + hillshade + sky/fog/warm lighting.

import type maplibregl from "maplibre-gl";

export interface City3DOptions {
  /** Layer/source id prefix so two maps on one page never collide. */
  prefix: string;
  /** Terrain vertical exaggeration. */
  exaggeration?: number;
  /** [height m, color] stops for the extrusion ramp. */
  ramp?: [number, string][];
  /** Skip building extrusions (terrain + atmosphere only). */
  buildings?: boolean;
}

// Height priority: render_height -> height -> levels * 3.2m -> 6m default.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heightExpr: any = [
  "to-number",
  [
    "coalesce",
    ["get", "render_height"],
    ["get", "height"],
    ["*", ["to-number", ["coalesce", ["get", "building:levels"], ["get", "levels"], 0]], 3.2],
    6,
  ],
];

const DEFAULT_RAMP: [number, string][] = [
  [0, "#1c2b3a"], [6, "#253545"], [10, "#2a4a5c"], [16, "#1e7896"],
  [25, "#d47a1e"], [40, "#f5a623"], [60, "#ff6b35"], [90, "#ff4444"],
];

type TerrainMap = maplibregl.Map & {
  setTerrain?: (opt: unknown) => void;
  setFog?: (opt: unknown) => void;
  setLight?: (opt: unknown) => void;
};

export function applyCity3D(
  mlMap: maplibregl.Map,
  show: boolean,
  basemapId: string,
  opts: City3DOptions,
) {
  if (!mlMap?.isStyleLoaded?.()) return;
  const map = mlMap as TerrainMap;
  const BLDG_SRC = `${opts.prefix}-bldg-src`;
  const BLDG_LAYER = `${opts.prefix}-bldg-3d`;
  const DEM_SRC = `${opts.prefix}-terrain-dem`;
  const SKY_LAYER = `${opts.prefix}-sky`;
  const HILLSHADE_LAYER = `${opts.prefix}-hillshade`;

  if (!show) {
    map.setTerrain?.(null);
    for (const layer of [BLDG_LAYER, SKY_LAYER, HILLSHADE_LAYER]) {
      if (mlMap.getLayer(layer)) mlMap.setLayoutProperty(layer, "visibility", "none");
    }
    return;
  }

  if (!mlMap.getSource(DEM_SRC)) {
    mlMap.addSource(DEM_SRC, {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution: "Terrain Tiles · Mapzen / AWS",
    });
  }
  map.setTerrain?.({ source: DEM_SRC, exaggeration: opts.exaggeration ?? 1.5 });

  if (basemapId !== "topography") {
    if (!mlMap.getLayer(HILLSHADE_LAYER)) {
      const firstSymbol = (mlMap.getStyle()?.layers ?? []).find(
        (l: { type: string }) => l.type === "symbol",
      )?.id;
      mlMap.addLayer(
        {
          id: HILLSHADE_LAYER,
          type: "hillshade",
          source: DEM_SRC,
          paint: {
            "hillshade-shadow-color": "#1c2b3a",
            "hillshade-highlight-color": "#f5e6c8",
            "hillshade-exaggeration": 0.55,
            "hillshade-illumination-direction": 315,
          },
        } as unknown as Parameters<typeof mlMap.addLayer>[0],
        firstSymbol,
      );
    } else {
      mlMap.setLayoutProperty(HILLSHADE_LAYER, "visibility", "visible");
    }
  }

  map.setFog?.({
    range: [0.8, 8],
    color: "rgba(200, 230, 255, 0.8)",
    "horizon-blend": 0.08,
    "high-color": "#8cb5d6",
    "space-color": "#1a1a2e",
    "star-intensity": 0.15,
  });
  map.setLight?.({ anchor: "viewport", color: "#ffd280", intensity: 0.6, position: [1.5, 90, 80] });
  if (!mlMap.getLayer(SKY_LAYER)) {
    mlMap.addLayer({
      id: SKY_LAYER,
      type: "sky" as unknown as "background",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [90.0, 80.0],
        "sky-atmosphere-sun-intensity": 12,
      },
    } as unknown as Parameters<typeof mlMap.addLayer>[0]);
  } else {
    mlMap.setLayoutProperty(SKY_LAYER, "visibility", "visible");
  }

  if (opts.buildings === false) return;

  if (!mlMap.getSource(BLDG_SRC)) {
    mlMap.addSource(BLDG_SRC, {
      type: "vector",
      tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}"],
      minzoom: 0,
      maxzoom: 14,
      attribution: "© OpenFreeMap · © OpenStreetMap contributors",
    });
  }
  if (!mlMap.getLayer(BLDG_LAYER)) {
    const firstLabel = (mlMap.getStyle()?.layers ?? []).find(
      (l: { type: string; layout?: Record<string, unknown> }) =>
        l.type === "symbol" && l.layout?.["text-field"],
    )?.id;
    const ramp = (opts.ramp ?? DEFAULT_RAMP).flat();
    mlMap.addLayer(
      {
        id: BLDG_LAYER,
        type: "fill-extrusion",
        source: BLDG_SRC,
        "source-layer": "building",
        minzoom: 10,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], heightExpr, ...ramp],
          "fill-extrusion-height": heightExpr,
          "fill-extrusion-base": ["to-number", ["coalesce", ["get", "render_min_height"], 0]],
          "fill-extrusion-opacity": 0.88,
        },
      },
      firstLabel,
    );
  } else {
    mlMap.setLayoutProperty(BLDG_LAYER, "visibility", "visible");
  }
}

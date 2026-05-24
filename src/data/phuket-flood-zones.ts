/**
 * Phuket Low-Elevation Flood Zones — simplified polygon geometry.
 *
 * Three zones modelled on known Phuket flood geography:
 *   1. Patong Valley Bowl — surrounded by ridges on 3 sides, drains to beach
 *   2. Chalong / Rassada Flat — low tidal plain near the piers
 *   3. Klong Bang Yai Floodplain — northern agricultural flat, seasonally floods
 *
 * Not survey-accurate — illustrative for risk communication.
 * When flood level slider = Xm, these polygons extrude to Xm height,
 * showing which areas inundate first given their known low elevation.
 *
 * Works with MapLibre fill-extrusion + AWS Terrarium DEM terrain.
 * Terrain shows WHY: ridges funnel water into these bowls.
 */

interface GeoJSONPolygon {
  type: "Feature";
  properties: {
    name: string;
    desc: string;
    riskLevel: "high" | "medium";
  };
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONPolygon[];
}

// ─── Zone polygons ─────────────────────────────────────────────

const PATONG_VALLEY: GeoJSONPolygon = {
  type: "Feature",
  properties: {
    name: "Patong Valley",
    desc: "Enclosed valley — ridge runoff concentrates at beach road. Floods rapidly in heavy rain.",
    riskLevel: "high",
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [98.276, 7.882],
      [98.284, 7.875],
      [98.295, 7.872],
      [98.311, 7.876],
      [98.316, 7.885],
      [98.314, 7.897],
      [98.309, 7.908],
      [98.296, 7.915],
      [98.283, 7.910],
      [98.276, 7.901],
      [98.276, 7.882],
    ]],
  },
};

const CHALONG_RASSADA_FLAT: GeoJSONPolygon = {
  type: "Feature",
  properties: {
    name: "Chalong / Rassada",
    desc: "Low tidal flat near piers. Combination of tidal surge + rain causes rapid inundation.",
    riskLevel: "high",
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [98.352, 7.816],
      [98.370, 7.812],
      [98.390, 7.815],
      [98.408, 7.822],
      [98.418, 7.834],
      [98.416, 7.848],
      [98.404, 7.858],
      [98.388, 7.861],
      [98.368, 7.857],
      [98.354, 7.848],
      [98.348, 7.834],
      [98.352, 7.816],
    ]],
  },
};

const BANG_YAI_FLOODPLAIN: GeoJSONPolygon = {
  type: "Feature",
  properties: {
    name: "Klong Bang Yai Floodplain",
    desc: "Northern agricultural flat. Rivers drain from Thalang into this plain; floods seasonally.",
    riskLevel: "medium",
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [98.350, 7.958],
      [98.368, 7.950],
      [98.390, 7.948],
      [98.415, 7.954],
      [98.435, 7.968],
      [98.442, 7.985],
      [98.438, 8.002],
      [98.422, 8.012],
      [98.400, 8.015],
      [98.378, 8.010],
      [98.360, 8.000],
      [98.348, 7.984],
      [98.346, 7.968],
      [98.350, 7.958],
    ]],
  },
};

export const PHUKET_FLOOD_ZONES: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [PATONG_VALLEY, CHALONG_RASSADA_FLAT, BANG_YAI_FLOODPLAIN],
};

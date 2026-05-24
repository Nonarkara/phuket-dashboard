/**
 * MapLibre style descriptors for the five Phuket basemaps:
 *   street · satellite · vegetation · topography · maritime
 *
 * All sources are free / no-token: CartoDB, Esri, OpenTopoMap, NASA GIBS,
 * OpenStreetMap, OpenSeaMap. Each style is either a URL (string) or an
 * inline MapLibre style object.
 */

export type BasemapId =
  | "street"
  | "satellite"
  | "vegetation"
  | "topography"
  | "maritime";

export const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
  { id: "street", label: "Street" },
  { id: "satellite", label: "Satellite" },
  { id: "vegetation", label: "Vegetation" },
  { id: "topography", label: "Topography" },
  { id: "maritime", label: "Maritime" },
];

interface MaplibreRasterStyle {
  version: 8;
  sources: Record<
    string,
    {
      type: "raster";
      tiles: string[];
      tileSize: number;
      attribution: string;
      maxzoom?: number;
    }
  >;
  layers: { id: string; type: "raster"; source: string }[];
}

function singleRaster(
  id: string,
  tiles: string[],
  attribution: string,
  options: { tileSize?: number; maxzoom?: number } = {},
): MaplibreRasterStyle {
  const sourceId = `raster-${id}`;
  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles,
        tileSize: options.tileSize ?? 256,
        attribution,
        maxzoom: options.maxzoom ?? 19,
      },
    },
    layers: [{ id: `raster-${id}-layer`, type: "raster", source: sourceId }],
  };
}

function utcDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function basemapStyle(id: BasemapId): string | MaplibreRasterStyle {
  switch (id) {
    case "street":
      return "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    case "satellite":
      return singleRaster(
        "satellite",
        [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        "© Esri · World Imagery",
        { maxzoom: 19 },
      );

    case "topography":
      return singleRaster(
        "topography",
        [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        "© OpenTopoMap (CC-BY-SA)",
        { maxzoom: 17 },
      );

    case "vegetation": {
      // NASA GIBS MODIS Terra NDVI — 8-day composite, slight backdate to ensure availability.
      const date = utcDateOffset(8);
      return singleRaster(
        "vegetation",
        [
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        ],
        "NASA GIBS · MODIS NDVI 8-day",
        { maxzoom: 9 },
      );
    }

    case "maritime":
      // OSM base + OpenSeaMap nautical overlay (depth contours, sea marks, beacons).
      return {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap",
            maxzoom: 19,
          },
          seamark: {
            type: "raster",
            tiles: [
              "https://t1.openseamap.org/seamark/{z}/{x}/{y}.png",
              "https://t2.openseamap.org/seamark/{z}/{x}/{y}.png",
              "https://t3.openseamap.org/seamark/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenSeaMap",
            maxzoom: 18,
          },
        },
        layers: [
          { id: "base", type: "raster", source: "base" },
          { id: "seamark", type: "raster", source: "seamark" },
        ],
      };
  }
}

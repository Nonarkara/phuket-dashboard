import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TileLayer } from "@deck.gl/geo-layers";
import {
  ArcLayer,
  BitmapLayer,
  ColumnLayer,
  GeoJsonLayer,
  LineLayer,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import type { SeaRoute } from "../data/phuket-sea-routes";
import { PHUKET_PIERS } from "../data/phuket-sea-routes";
import type { Waterway } from "../data/phuket-waterways";
import { getProvinceLabels } from "../lib/thai-provinces";
import type {
  AirQualityPoint,
  ConflictZoneCollection,
  ConflictZoneProperties,
  DisasterAlert,
  FireEvent,
  FlightData,
  IncidentFeature,
  MapOverlay,
  MaritimeVessel,
  PksbBusPosition,
  PksbRouteCollection,
  PksbRouteProperties,
  PksbStopCollection,
  PksbStopProperties,
  PublicCamera,
  RainfallPoint,
  RefugeeMovement,
  RegionBorderCollection,
  TrafficEvent,
  TourismHotspot,
} from "../types/dashboard";

interface ProvinceLabel {
  name: string;
  coordinates: [number, number];
  region: string;
  borderArea?: string;
}

interface TileBounds {
  bbox: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

interface TileDataRequest {
  url?: string | null;
}

function extractTileBounds(tile: unknown): TileBounds["bbox"] | null {
  if (typeof tile !== "object" || tile === null) {
    return null;
  }

  const t = tile as Record<string, unknown>;

  // deck.gl v9 shape: tile.boundingBox = [[west, south], [east, north]]
  if (Array.isArray(t.boundingBox) && t.boundingBox.length === 2) {
    const [sw, ne] = t.boundingBox as [unknown, unknown];
    if (Array.isArray(sw) && Array.isArray(ne) && sw.length === 2 && ne.length === 2) {
      const [west, south] = sw as [number, number];
      const [east, north] = ne as [number, number];
      if ([west, south, east, north].every((n) => typeof n === "number" && Number.isFinite(n))) {
        return { west, south, east, north };
      }
    }
  }

  // legacy shape: tile.bbox = { west, south, east, north } | { left, bottom, right, top }
  const bbox = t.bbox;
  if (typeof bbox === "object" && bbox !== null) {
    const box = bbox as Record<string, unknown>;
    if (
      typeof box.west === "number" &&
      typeof box.south === "number" &&
      typeof box.east === "number" &&
      typeof box.north === "number"
    ) {
      return { west: box.west, south: box.south, east: box.east, north: box.north };
    }
    if (
      typeof box.left === "number" &&
      typeof box.bottom === "number" &&
      typeof box.right === "number" &&
      typeof box.top === "number"
    ) {
      return {
        west: box.left,
        south: box.bottom,
        east: box.right,
        north: box.top,
      };
    }
  }

  return null;
}

/**
 * Converts a TMS tile coordinate to an EPSG:3857 bounding-box string
 * suitable for WMS GetMap requests.
 */
function tileToBboxEpsg3857(x: number, y: number, z: number): string {
  const half = 20037508.342789244;
  const size = half * 2;
  const tileCount = Math.pow(2, z);
  const tileW = size / tileCount;
  const minX = -half + x * tileW;
  const maxX = minX + tileW;
  const maxY = half - y * tileW;
  const minY = maxY - tileW;
  return `${minX},${minY},${maxX},${maxY}`;
}

/**
 * WMS GetMap tile layer. Builds a bbox URL on-the-fly so that any OGC WMS
 * service can be rendered as a deck.gl raster overlay (works on servers that
 * don't expose WMTS / TMS endpoints).
 */
export function createWmsTileLayer({
  id,
  baseUrl,
  layers,
  maxZoom = 10,
  opacity = 0.75,
  extraParams = "",
}: {
  id: string;
  baseUrl: string;
  layers: string;
  maxZoom?: number;
  opacity?: number;
  extraParams?: string;
}) {
  return new TileLayer({
    id,
    data: "null",     // dummy — getTileData builds real URL
    minZoom: 0,
    maxZoom,
    tileSize: 256,
    opacity,
    getTileData: async (tile: { index: { x: number; y: number; z: number } }) => {
      const bbox = tileToBboxEpsg3857(tile.index.x, tile.index.y, tile.index.z);
      const url =
        `${baseUrl}?service=WMS&version=1.1.1&request=GetMap` +
        `&layers=${layers}&bbox=${bbox}` +
        `&width=256&height=256&srs=EPSG:3857&styles=&format=image/png&transparent=true` +
        (extraParams ? `&${extraParams}` : "");
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok || res.headers.get("content-type")?.includes("xml")) return null;
        const blob = await res.blob();
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    },
    renderSubLayers: (props) => {
      const image = props.data;
      if (!image) return null;
      const tile = props.tile as unknown as { boundingBox?: [[number, number], [number, number]]; bbox?: { west: number; south: number; east: number; north: number } };
      let west: number, south: number, east: number, north: number;
      if (tile?.boundingBox) { [[west, south], [east, north]] = tile.boundingBox; }
      else if (tile?.bbox) { ({ west, south, east, north } = tile.bbox); }
      else { return null; }
      return new BitmapLayer(props, {
        data: undefined,
        image,
        bounds: [west, south, east, north],
      });
    },
  });
}

export function createRasterTileLayer({
  id,
  data,
  maxZoom,
  opacity = 1,
  onTileError,
}: {
  id: string;
  data: string;
  maxZoom: number;
  opacity?: number;
  onTileError?: (error: unknown) => void;
}) {
  return new TileLayer({
    id,
    data,
    minZoom: 0,
    maxZoom,
    tileSize: 256,
    opacity,
    onTileError,
    renderSubLayers: (props) => {
      const image = props.data;
      if (!image) return null;
      const tile = props.tile as unknown as { boundingBox?: [[number, number], [number, number]]; bbox?: { west: number; south: number; east: number; north: number } };
      let west: number, south: number, east: number, north: number;
      if (tile?.boundingBox) {
        [[west, south], [east, north]] = tile.boundingBox;
      } else if (tile?.bbox) {
        ({ west, south, east, north } = tile.bbox);
      } else {
        return null;
      }
      return new BitmapLayer({
        id: `${props.id}-bitmap`,
        image,
        bounds: [west, south, east, north],
        opacity: props.opacity,
      });
    },
  });
}

export function createRasterOverlayLayer(
  overlay: MapOverlay,
  opacity = overlay.defaultOpacity,
  onTileError?: () => void,
) {
  if (!overlay.tileTemplate || typeof overlay.maxZoom !== "number") {
    return null;
  }

  return createRasterTileLayer({
    id: overlay.id,
    data: overlay.tileTemplate,
    maxZoom: overlay.maxZoom,
    opacity,
    onTileError: (error: unknown) => {
      console.warn(`${overlay.label} tile load failed`, error);
      onTileError?.();
    },
  });
}

export const createIncidentLayer = (data: IncidentFeature[]) =>
  new ScatterplotLayer({
    id: "incidents-scatter",
    data,
    getPosition: (d: IncidentFeature) => d.geometry.coordinates,
    getFillColor: (d: IncidentFeature) =>
      d.properties.fatalities > 0 ? [239, 68, 68, 200] : [245, 158, 11, 200],
    getRadius: (d: IncidentFeature) =>
      Math.sqrt(d.properties.fatalities + 1) * 2000,
    pickable: true,
    opacity: 0.8,
  });

export const createHeatmapLayer = (data: IncidentFeature[]) =>
  new HeatmapLayer({
    id: "incidents-heatmap",
    data,
    getPosition: (d: IncidentFeature) => d.geometry.coordinates,
    getWeight: (d: IncidentFeature) => d.properties.fatalities + 1,
    radiusPixels: 40,
    intensity: 1,
    threshold: 0.05,
  });

export const createFireLayer = (data: FireEvent[]) =>
  new ScatterplotLayer({
    id: "nasa-firms-fires",
    data,
    getPosition: (d: FireEvent) => [d.longitude, d.latitude],
    getFillColor: [255, 165, 0, 180],
    getRadius: (d: FireEvent) => Math.sqrt(d.brightness || 1) * 300,
    pickable: true,
  });

export const createRefugeeLayer = (data: RefugeeMovement[]) =>
  new ArcLayer({
    id: "refugee-movements",
    data,
    getSourcePosition: (d: RefugeeMovement) => d.source,
    getTargetPosition: (d: RefugeeMovement) => d.target,
    getSourceColor: [0, 128, 255, 120],
    getTargetColor: [0, 255, 128, 120],
    getWidth: (d: RefugeeMovement) => Math.log10(d.count + 1) * 2,
    pickable: true,
  });

export const createRainfallLayer = (data: RainfallPoint[]) =>
  new HeatmapLayer({
    id: "rainfall-anomalies",
    data,
    getPosition: (d: RainfallPoint) => [d.lng, d.lat],
    getWeight: (d: RainfallPoint) => Math.abs(d.value),
    radiusPixels: 60,
    colorRange: [
      [255, 255, 255, 0],
      [0, 100, 200, 100],
      [0, 200, 255, 200],
    ],
  });

function getExecutiveStatusColor(status: "intervene" | "watch" | "stable") {
  if (status === "intervene") {
    return [239, 68, 68, 225] as [number, number, number, number];
  }

  if (status === "watch") {
    return [245, 158, 11, 220] as [number, number, number, number];
  }

  return [15, 111, 136, 205] as [number, number, number, number];
}

export function createDisasterAlertLayer(alerts: DisasterAlert[]) {
  if (!alerts.length) {
    return [];
  }

  return [
    new ScatterplotLayer({
      id: "disaster-alert-points",
      data: alerts,
      getPosition: (alert: DisasterAlert) => [alert.lng, alert.lat],
      getFillColor: (alert: DisasterAlert) => getExecutiveStatusColor(alert.severity),
      getRadius: (alert: DisasterAlert) =>
        alert.severity === "intervene" ? 5200 : alert.severity === "watch" ? 3800 : 2600,
      radiusUnits: "meters",
      radiusMinPixels: 4,
      radiusMaxPixels: 14,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [248, 250, 252, 220],
      pickable: true,
      opacity: 0.86,
    }),
    new TextLayer({
      id: "disaster-alert-labels",
      data: alerts.filter((alert) => alert.severity !== "stable"),
      getPosition: (alert: DisasterAlert) => [alert.lng, alert.lat],
      getText: (alert: DisasterAlert) => alert.area,
      getColor: [248, 250, 252, 210],
      getSize: 11,
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      getPixelOffset: [0, -14],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [15, 23, 42, 210],
      outlineWidth: 2,
      sizeUnits: "pixels",
      billboard: false,
      pickable: false,
    }),
  ];
}

export function createMaritimeTrafficLayers(vessels: MaritimeVessel[]) {
  if (!vessels.length) {
    return [];
  }

  return [
    new ScatterplotLayer({
      id: "maritime-vessels",
      data: vessels,
      getPosition: (vessel: MaritimeVessel) => [vessel.lng, vessel.lat],
      getFillColor: (vessel: MaritimeVessel) => getExecutiveStatusColor(vessel.status),
      getRadius: (vessel: MaritimeVessel) =>
        vessel.type.toLowerCase().includes("ferry") ? 1400 : 1000,
      radiusUnits: "meters",
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [226, 232, 240, 220],
      pickable: true,
      opacity: 0.88,
    }),
    new TextLayer({
      id: "maritime-vessel-labels",
      data: vessels.filter((vessel) => vessel.status !== "stable"),
      getPosition: (vessel: MaritimeVessel) => [vessel.lng, vessel.lat],
      getText: (vessel: MaritimeVessel) => vessel.name,
      getColor: [226, 232, 240, 200],
      getSize: 10,
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      getPixelOffset: [8, 0],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [15, 23, 42, 220],
      outlineWidth: 2,
      sizeUnits: "pixels",
      billboard: false,
      pickable: false,
    }),
  ];
}

export function createTourismHotspotLayer(hotspots: TourismHotspot[]) {
  if (!hotspots.length) {
    return [];
  }

  return [
    new ScatterplotLayer({
      id: "tourism-hotspots",
      data: hotspots,
      getPosition: (hotspot: TourismHotspot) => [hotspot.lng, hotspot.lat],
      getFillColor: (hotspot: TourismHotspot) => getExecutiveStatusColor(hotspot.status),
      getRadius: (hotspot: TourismHotspot) =>
        hotspot.status === "intervene" ? 2200 : hotspot.status === "watch" ? 1700 : 1300,
      radiusUnits: "meters",
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [255, 255, 255, 210],
      pickable: true,
      opacity: 0.72,
    }),
    new TextLayer({
      id: "tourism-hotspot-labels",
      data: hotspots.filter((hotspot) => hotspot.status !== "stable"),
      getPosition: (hotspot: TourismHotspot) => [hotspot.lng, hotspot.lat],
      getText: (hotspot: TourismHotspot) => hotspot.label,
      getColor: [248, 250, 252, 205],
      getSize: 10,
      getTextAnchor: "start",
      getAlignmentBaseline: "top",
      getPixelOffset: [8, 4],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [15, 23, 42, 220],
      outlineWidth: 2,
      sizeUnits: "pixels",
      billboard: false,
      pickable: false,
    }),
  ];
}

function getAirQualityColor(aqi: number): [number, number, number, number] {
  if (aqi <= 50) {
    return [34, 197, 94, 190];
  }

  if (aqi <= 100) {
    return [245, 158, 11, 190];
  }

  if (aqi <= 150) {
    return [249, 115, 22, 210];
  }

  if (aqi <= 200) {
    return [239, 68, 68, 220];
  }

  return [127, 29, 29, 230];
}

function createAirQualityStationLayer(
  id: string,
  data: AirQualityPoint[],
  weightKey: "aqi" | "pm25",
) {
  return new ScatterplotLayer({
    id,
    data,
    getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
    getFillColor: (d: AirQualityPoint) => getAirQualityColor(d.aqi),
    getRadius: (d: AirQualityPoint) =>
      weightKey === "pm25" ? Math.max(5000, d.pm25 * 280) : Math.max(5000, d.aqi * 160),
    pickable: true,
    radiusMinPixels: 3,
    radiusMaxPixels: 14,
    opacity: 0.68,
    stroked: true,
    lineWidthMinPixels: 1,
    getLineColor: [255, 255, 255, 180],
  });
}

export function createAirQualityHeatmapLayers(
  data: AirQualityPoint[],
  weightKey: "aqi" | "pm25",
) {
  const maxWeight = weightKey === "pm25" ? 80 : 220;
  const idPrefix = weightKey === "pm25" ? "pm25" : "aqi";

  return [
    new HeatmapLayer({
      id: `${idPrefix}-heatmap`,
      data,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getWeight: (d: AirQualityPoint) => d[weightKey],
      radiusPixels: weightKey === "pm25" ? 56 : 64,
      intensity: 1,
      threshold: 0.03,
      colorRange: [
        [59, 130, 246, 30],
        [34, 197, 94, 90],
        [245, 158, 11, 140],
        [249, 115, 22, 180],
        [239, 68, 68, 210],
        [127, 29, 29, 225],
      ],
      aggregation: "SUM",
      weightsTextureSize: 512,
    }),
    createAirQualityStationLayer(`${idPrefix}-stations`, data, weightKey),
    new TextLayer({
      id: `${idPrefix}-labels`,
      data,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getText: (d: AirQualityPoint) =>
        weightKey === "pm25" ? `${Math.round(d.pm25)}` : `${Math.round(d.aqi)}`,
      getColor: [226, 232, 240, 220],
      getSize: 11,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      getPixelOffset: [0, -18],
      sizeUnits: "pixels",
      pickable: false,
      visible: data.some((point) => point[weightKey] <= maxWeight),
    }),
  ];
}

export const createModisTerraLayer = (date: string, opacity = 0.72) =>
  createRasterTileLayer({
    id: "modis-terra-true-color",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxZoom: 9,
    opacity,
    onTileError: (error: unknown) => {
      console.warn("MODIS Terra tile load failed", error);
    },
  });

export const createModisAquaLayer = (date: string, opacity = 0.72) =>
  createRasterTileLayer({
    id: "modis-aqua-true-color",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxZoom: 9,
    opacity,
    onTileError: (error: unknown) => {
      console.warn("MODIS Aqua tile load failed", error);
    },
  });

export const createModisFalseColorLayer = (date: string, opacity = 0.72) =>
  createRasterTileLayer({
    id: "modis-terra-false-color",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxZoom: 9,
    opacity,
    onTileError: (error: unknown) => {
      console.warn("MODIS false color tile load failed", error);
    },
  });

export const createViirsTrueColorLayer = (date: string, opacity = 0.72) =>
  createRasterTileLayer({
    id: "viirs-true-color",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxZoom: 9,
    opacity,
    onTileError: (error: unknown) => {
      console.warn("VIIRS true color tile load failed", error);
    },
  });

export const createBlueMarbleLayer = (date: string, opacity = 0.72) =>
  createRasterTileLayer({
    id: "blue-marble-relief",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief/default/${date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
    maxZoom: 8,
    opacity,
    onTileError: (error: unknown) => {
      console.warn("Blue Marble tile load failed", error);
    },
  });

export const createSentinelLayer = (date: string, opacity = 0.72) =>
  createViirsTrueColorLayer(date, opacity);

export const createCopernicusLayer = (date: string, opacity = 0.72) =>
  createModisTerraLayer(date, opacity);

export const createJaxaRainLayer = (date: string) =>
  createRasterTileLayer({
    id: "jaxa-gsmap-rain",
    data: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    maxZoom: 6,
    opacity: 0.6,
  });

export const createDetailedSatelliteLayer = (date: string, opacity = 0.72) =>
  createModisAquaLayer(date, opacity);

export const createRegionalBorderLayer = (data: RegionBorderCollection) =>
  new GeoJsonLayer({
    id: "regional-borders",
    data: data as never,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: [0, 0, 0, 0],
    getLineColor: [0, 255, 255, 100],
    getLineWidth: 2000,
    lineWidthMinPixels: 1,
  });

function getConflictZoneFillColor(
  properties: ConflictZoneProperties,
): [number, number, number, number] {
  if (properties.priority >= 3) {
    return properties.status === "active"
      ? [239, 68, 68, 72]
      : [249, 115, 22, 64];
  }

  return [245, 158, 11, 54];
}

function getConflictZoneLineColor(
  properties: ConflictZoneProperties,
): [number, number, number, number] {
  if (properties.priority >= 3) {
    return properties.status === "active"
      ? [248, 113, 113, 220]
      : [251, 191, 36, 210];
  }

  return [245, 158, 11, 190];
}

function getConflictZoneProperties(feature: unknown): ConflictZoneProperties {
  return (feature as { properties: ConflictZoneProperties }).properties;
}

export function createConflictZonesLayer(data: ConflictZoneCollection) {
  if (!data.features.length) {
    return null;
  }

  return new GeoJsonLayer({
    id: "conflict-zones",
    data: data.features as never,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 2,
    getFillColor: (feature) =>
      getConflictZoneFillColor(getConflictZoneProperties(feature)),
    getLineColor: (feature) =>
      getConflictZoneLineColor(getConflictZoneProperties(feature)),
    getLineWidth: (feature) =>
      getConflictZoneProperties(feature).priority >= 3 ? 2400 : 1800,
  });
}

export const createNightlightLayer = () =>
  createRasterTileLayer({
    id: "viirs-nightlights",
    data: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_AtSensor_M15/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    maxZoom: 8,
  });

function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return [148, 163, 184, alpha];
  }

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);

  return [r, g, b, alpha];
}

export function createProvinceLabelsLayer() {
  const labels = getProvinceLabels() as ProvinceLabel[];

  return new TextLayer({
    id: "province-labels",
    data: labels,
    getPosition: (d: ProvinceLabel) => d.coordinates,
    getText: (d: ProvinceLabel) => d.name,
    getSize: (d: ProvinceLabel) => (d.borderArea ? 13 : 11),
    getColor: (d: ProvinceLabel) =>
      d.borderArea ? [245, 158, 11, 220] : [148, 163, 184, 180],
    getTextAnchor: "middle" as const,
    getAlignmentBaseline: "center" as const,
    fontFamily: "Helvetica Neue, Arial, sans-serif",
    fontWeight: "bold" as unknown as number,
    outlineColor: [10, 15, 26, 200],
    outlineWidth: 2,
    sizeUnits: "pixels" as const,
    billboard: false,
    pickable: false,
  });
}

function getPksbStopColor(routeId: PksbStopProperties["routeId"]) {
  if (routeId === "dragon_line") {
    return [219, 0, 0, 210] as [number, number, number, number];
  }

  if (routeId === "main_line") {
    return [53, 198, 243, 210] as [number, number, number, number];
  }

  return [255, 165, 0, 215] as [number, number, number, number];
}

export function createPksbRouteLayers(
  routes: PksbRouteCollection,
  stops: PksbStopCollection,
) {
  if (!routes.features.length && !stops.features.length) {
    return [];
  }

  return [
    new GeoJsonLayer({
      id: "pksb-route-lines",
      data: routes.features as never,
      pickable: true,
      stroked: true,
      filled: false,
      lineCapRounded: true,
      lineJointRounded: true,
      lineWidthMinPixels: 2,
      getLineWidth: (feature) =>
        ((feature as { properties: PksbRouteProperties }).properties.routeId ===
        "main_line"
          ? 6
          : 4),
      getLineColor: (feature) =>
        hexToRgba(
          (feature as { properties: PksbRouteProperties }).properties.color,
          210,
        ),
    }),
    new GeoJsonLayer({
      id: "pksb-route-stops",
      data: stops.features as never,
      pickable: true,
      pointType: "circle",
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      pointRadiusUnits: "meters",
      pointRadiusMinPixels: 3,
      pointRadiusMaxPixels: 8,
      getPointRadius: 120,
      getFillColor: (feature) =>
        getPksbStopColor(
          (feature as { properties: PksbStopProperties }).properties.routeId,
        ),
      getLineColor: [248, 250, 252, 230],
    }),
  ];
}

/* ─── PKSB Live Bus Layer ─────────────────────────────────────── */

const PKSB_BUS_ROUTE_COLORS: Record<string, [number, number, number, number]> = {
  "rawai-airport": [22, 184, 176, 230],
  "patong-old-bus-station": [255, 204, 51, 230],
  "dragon-line": [219, 0, 0, 230],
};

export function createPksbBusLayers(buses: PksbBusPosition[]) {
  if (!buses.length) return [];

  return [
    new ScatterplotLayer({
      id: "pksb-live-buses",
      data: buses,
      getPosition: (bus: PksbBusPosition) => [bus.lng, bus.lat],
      getFillColor: (bus: PksbBusPosition) =>
        PKSB_BUS_ROUTE_COLORS[bus.routeId] ?? [22, 184, 176, 230],
      getRadius: 600,
      radiusUnits: "meters",
      radiusMinPixels: 6,
      radiusMaxPixels: 14,
      stroked: true,
      lineWidthMinPixels: 2,
      getLineColor: [255, 255, 255, 240],
      pickable: true,
      opacity: 0.92,
    }),
    new TextLayer({
      id: "pksb-bus-labels",
      data: buses.filter((b) => b.status === "moving"),
      getPosition: (bus: PksbBusPosition) => [bus.lng, bus.lat],
      getText: (bus: PksbBusPosition) => bus.licensePlate,
      getColor: [248, 250, 252, 200],
      getSize: 10,
      getTextAnchor: "start" as const,
      getAlignmentBaseline: "center" as const,
      getPixelOffset: [12, 0],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [15, 23, 42, 220],
      outlineWidth: 2,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

/* ─── Multi-scale Distance Grid Layer ─────────────────────────── */

const KM_GRID_BOUNDS = {
  west: 98.16,
  east: 98.64,
  south: 7.64,
  north: 8.24,
};

/** Approximate degrees per kilometer at the Phuket latitude (~7.9°N). */
const DEG_PER_KM_LAT = 1 / 111.32;
const DEG_PER_KM_LNG = 1 / (111.32 * Math.cos((7.9 * Math.PI) / 180));

export type GridScale = 0.5 | 1 | 5 | 10;

export const GRID_SCALES: { value: GridScale; label: string }[] = [
  { value: 0.5, label: "500m" },
  { value: 1, label: "1km" },
  { value: 5, label: "5km" },
  { value: 10, label: "10km" },
];

interface GridLine {
  start: [number, number];
  end: [number, number];
  kind: "major" | "minor";
  axis: "vertical" | "horizontal";
  indexKm: number;
}

interface GridLabel {
  position: [number, number];
  text: string;
  axis: "x" | "y";
}

function buildKmGridData(scaleKm: GridScale) {
  const lines: GridLine[] = [];
  const labels: GridLabel[] = [];
  const { west, east, south, north } = KM_GRID_BOUNDS;
  const stepLng = DEG_PER_KM_LNG * scaleKm;
  const stepLat = DEG_PER_KM_LAT * scaleKm;
  const majorEvery = 5;
  const lngStart = Math.floor(west / stepLng) * stepLng;
  const latStart = Math.floor(south / stepLat) * stepLat;

  let idx = 0;
  for (let lng = lngStart; lng <= east + stepLng / 2; lng += stepLng) {
    const kind = idx % majorEvery === 0 ? "major" : "minor";
    lines.push({ start: [lng, south], end: [lng, north], kind, axis: "vertical", indexKm: idx });

    if (kind === "major" && idx > 0) {
      const dist = idx * scaleKm;
      labels.push({
        position: [lng, north - DEG_PER_KM_LAT * 0.35],
        text: dist < 1 ? `${dist * 1000}m` : `${dist}km`,
        axis: "x",
      });
    }
    idx++;
  }

  idx = 0;
  for (let lat = latStart; lat <= north + stepLat / 2; lat += stepLat) {
    const kind = idx % majorEvery === 0 ? "major" : "minor";
    lines.push({ start: [west, lat], end: [east, lat], kind, axis: "horizontal", indexKm: idx });

    if (kind === "major" && idx > 0) {
      const dist = idx * scaleKm;
      labels.push({
        position: [west + DEG_PER_KM_LNG * 0.55, lat],
        text: dist < 1 ? `${dist * 1000}m` : `${dist}km`,
        axis: "y",
      });
    }
    idx++;
  }

  return { lines, labels };
}

const gridCache = new Map<GridScale, { lines: GridLine[]; labels: GridLabel[] }>();

function getGridData(scaleKm: GridScale) {
  if (!gridCache.has(scaleKm)) {
    gridCache.set(scaleKm, buildKmGridData(scaleKm));
  }
  return gridCache.get(scaleKm)!;
}

export function createKilometerGridLayer(scaleKm: GridScale = 1) {
  const data = getGridData(scaleKm);
  return [
    new LineLayer({
      id: "km-grid-lines",
      data: data.lines,
      getSourcePosition: (d: GridLine) => d.start,
      getTargetPosition: (d: GridLine) => d.end,
      getColor: (d: GridLine) =>
        d.kind === "major"
          ? [15, 111, 136, 165]
          : [15, 111, 136, 78],
      getWidth: (d: GridLine) => (d.kind === "major" ? 1.4 : 0.75),
      widthUnits: "pixels" as const,
      widthMinPixels: 1,
      pickable: false,
    }),
    new TextLayer({
      id: "km-grid-labels",
      data: data.labels,
      getPosition: (d: GridLabel) => d.position,
      getText: (d: GridLabel) => d.text,
      getSize: 9,
      getColor: [15, 23, 42, 210],
      getTextAnchor: (d: GridLabel) => (d.axis === "x" ? "middle" : "start"),
      getAlignmentBaseline: (d: GridLabel) =>
        d.axis === "x" ? "bottom" : "center",
      getPixelOffset: (d: GridLabel) =>
        d.axis === "x" ? [0, -2] : [3, 0],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [248, 250, 252, 220],
      outlineWidth: 2,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

function getPublicCameraColor(
  type: PublicCamera["type"],
  validationState: PublicCamera["validationState"],
): [number, number, number, number] {
  if (validationState === "candidate") {
    return [100, 116, 139, 180];
  }

  if (type === "traffic") {
    return [245, 158, 11, 220];
  }

  if (type === "bay") {
    return [59, 130, 246, 220];
  }

  return [14, 165, 233, 220];
}

export function createPublicCameraLayer(cameras: PublicCamera[]) {
  return new ScatterplotLayer({
    id: "public-cameras",
    data: cameras,
    getPosition: (camera: PublicCamera) => [camera.lng, camera.lat],
    getFillColor: (camera: PublicCamera) =>
      getPublicCameraColor(camera.type, camera.validationState),
    getRadius: (camera: PublicCamera) =>
      camera.validationState === "verified" ? 420 : 540,
    radiusUnits: "meters",
    radiusMinPixels: 4,
    radiusMaxPixels: 10,
    stroked: true,
    lineWidthMinPixels: 1,
    getLineColor: [248, 250, 252, 235],
    pickable: true,
  });
}

/* ─── Flight Layer ─────────────────────────────────────────────── */

const FLIGHT_COUNTRY_COLORS: Record<string, [number, number, number, number]> = {
  Thailand: [56, 189, 248, 200],  // cyan
  Myanmar: [245, 158, 11, 200],   // amber
  Cambodia: [34, 197, 94, 200],   // green
  Malaysia: [168, 85, 247, 200],  // purple
};

function getFlightColor(country: string): [number, number, number, number] {
  return FLIGHT_COUNTRY_COLORS[country] ?? [148, 163, 184, 160];
}

export function createFlightPathsLayer(flights: FlightData[]) {
  if (!flights || flights.length === 0) return null;

  return [
    new ScatterplotLayer({
      id: "flight-positions",
      data: flights,
      getPosition: (d: FlightData) => [d.longitude, d.latitude, d.altitude],
      getRadius: 3000,
      getFillColor: (d: FlightData) => getFlightColor(d.origin_country),
      radiusMinPixels: 3,
      radiusMaxPixels: 8,
      lineWidthMinPixels: 1,
      stroked: true,
      getLineColor: [255, 255, 255, 120],
      pickable: true,
    }),
    new TextLayer({
      id: "flight-callsigns",
      data: flights.filter((d: FlightData) => d.callsign),
      getPosition: (d: FlightData) => [d.longitude, d.latitude],
      getText: (d: FlightData) => d.callsign,
      getSize: 10,
      getColor: [226, 232, 240, 160],
      getTextAnchor: "start" as const,
      getAlignmentBaseline: "top" as const,
      getPixelOffset: [8, 4],
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [10, 15, 26, 200],
      outlineWidth: 2,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

// ─── Traffic Events Layer ────────────────────────────────────────

function trafficColor(type: string): [number, number, number, number] {
  const lower = type.toLowerCase();
  if (/accident|crash|collision/i.test(lower)) return [239, 68, 68, 220];
  if (/congestion|traffic jam|slow/i.test(lower)) return [245, 158, 11, 200];
  if (/construction|road work/i.test(lower)) return [59, 130, 246, 180];
  return [251, 191, 36, 180];
}

export function createTrafficEventLayers(events: TrafficEvent[]) {
  if (!events.length) return [];

  return [
    new ScatterplotLayer<TrafficEvent>({
      id: "traffic-events-dot",
      data: events,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 120,
      getFillColor: (d) => trafficColor(d.type),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      radiusMinPixels: 5,
      radiusMaxPixels: 14,
      pickable: true,
    }),
    new TextLayer<TrafficEvent>({
      id: "traffic-events-label",
      data: events,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.type?.substring(0, 12) ?? "event",
      getSize: 10,
      getColor: [255, 255, 255, 230],
      getAngle: 0,
      getTextAnchor: "start" as const,
      getAlignmentBaseline: "center" as const,
      getPixelOffset: [10, 0],
      fontFamily: "monospace",
      fontWeight: 700,
      outlineWidth: 2,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

export function createSeaRoutesLayers(routes: SeaRoute[]) {
  if (!routes.length) return [];
  const colorByOperator: Record<SeaRoute["operatorClass"], [number, number, number, number]> = {
    ferry: [56, 189, 248, 220],
    speedboat: [251, 191, 36, 220],
    longtail: [167, 139, 250, 220],
  };
  return [
    new PathLayer({
      id: "phuket-sea-routes",
      data: routes,
      getPath: (d: SeaRoute) => d.path,
      getColor: (d: SeaRoute) => colorByOperator[d.operatorClass],
      getWidth: 2,
      widthUnits: "pixels" as const,
      widthMinPixels: 1.5,
      jointRounded: false,
      capRounded: false,
      pickable: false,
    }),
    new ScatterplotLayer({
      id: "phuket-sea-piers",
      data: PHUKET_PIERS,
      getPosition: (d: { lng: number; lat: number }) => [d.lng, d.lat],
      getRadius: 4,
      radiusUnits: "pixels" as const,
      radiusMinPixels: 3,
      radiusMaxPixels: 6,
      getFillColor: [56, 189, 248, 240],
      getLineColor: [15, 23, 42, 255],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
    }),
    new TextLayer({
      id: "phuket-sea-pier-labels",
      data: PHUKET_PIERS,
      getPosition: (d: { lng: number; lat: number }) => [d.lng, d.lat],
      getText: (d: { name: string }) => d.name,
      getSize: 10,
      getColor: [15, 23, 42, 240],
      getAlignmentBaseline: "top" as const,
      getTextAnchor: "middle" as const,
      getPixelOffset: [0, 8],
      fontFamily: "JetBrains Mono, SF Mono, monospace",
      outlineColor: [248, 250, 252, 230],
      outlineWidth: 2,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

export function createWaterwaysLayer(waterways: Waterway[]) {
  if (!waterways.length) return [];
  return [
    new PathLayer({
      id: "phuket-waterways",
      data: waterways,
      getPath: (d: Waterway) => d.path,
      getColor: (d: Waterway) =>
        d.kind === "river"
          ? [29, 78, 216, 245]
          : [14, 165, 233, 230],
      getWidth: (d: Waterway) => (d.kind === "river" ? 4.5 : 3),
      widthUnits: "pixels" as const,
      widthMinPixels: 2.5,
      jointRounded: true,
      capRounded: true,
      pickable: false,
    }),
  ];
}

// ─── Public Infrastructure (POI) ────────────────────────────────
// Sources: OpenStreetMap (Overpass API) → public/data/phuket-poi.geojson

export type PoiAmenity =
  | "police"
  | "fire_station"
  | "hospital"
  | "clinic"
  | "school"
  | "university"
  | "college";

export interface PoiFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    amenity: PoiAmenity | string;
    name: string;
    name_th?: string;
    operator?: string;
    phone?: string;
    address?: string;
    emergency?: string;
  };
}

export interface PoiCollection {
  type: "FeatureCollection";
  features: PoiFeature[];
}

/** Consistent palette — emergency reds, civic blues, health magenta, education amber */
function poiColor(amenity: string): [number, number, number, number] {
  switch (amenity) {
    case "police":       return [37, 99, 235, 240];
    case "fire_station": return [220, 38, 38, 240];
    case "hospital":     return [236, 72, 153, 240];
    case "clinic":       return [244, 114, 182, 230];
    case "school":       return [245, 158, 11, 240];
    case "university":   return [217, 119, 6, 240];
    case "college":      return [217, 119, 6, 240];
    default:             return [148, 163, 184, 230];
  }
}

function poiRadius(amenity: string): number {
  switch (amenity) {
    case "hospital": return 9;
    case "police": return 8;
    case "fire_station": return 8;
    case "university": return 8;
    case "college": return 7;
    case "clinic": return 6;
    case "school": return 6;
    default: return 5;
  }
}

export const POI_AMENITY_LABEL: Record<string, string> = {
  police: "Police",
  fire_station: "Fire Station",
  hospital: "Hospital",
  clinic: "Clinic",
  school: "School",
  university: "University",
  college: "College",
};

/** Creates one ScatterplotLayer per amenity (toggleable, pickable). */
export function createPoiLayers(
  poi: PoiCollection,
  enabledAmenities: Set<string> | null = null,
) {
  if (!poi?.features?.length) return [];
  const grouped = new Map<string, PoiFeature[]>();
  for (const f of poi.features) {
    const a = f.properties.amenity;
    if (enabledAmenities && !enabledAmenities.has(a)) continue;
    if (!grouped.has(a)) grouped.set(a, []);
    grouped.get(a)!.push(f);
  }

  return Array.from(grouped.entries()).map(([amenity, features]) =>
    new ScatterplotLayer<PoiFeature>({
      id: `phuket-poi-${amenity}`,
      data: features,
      getPosition: (f) => f.geometry.coordinates,
      getFillColor: () => poiColor(amenity),
      getLineColor: [255, 255, 255, 200],
      getRadius: () => poiRadius(amenity),
      lineWidthUnits: "pixels" as const,
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      radiusUnits: "pixels" as const,
      radiusMinPixels: poiRadius(amenity),
      radiusMaxPixels: poiRadius(amenity) + 3,
      pickable: true,
    }),
  );
}

// ─── Road network (OSM) ─────────────────────────────────────────

export interface RoadFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    id: string;
    highway: string;
    name?: string;
    ref?: string;
    lanes?: string;
  };
}

export interface RoadCollection {
  type: "FeatureCollection";
  features: RoadFeature[];
}

function roadColor(highway: string): [number, number, number, number] {
  switch (highway) {
    case "motorway": return [251, 191, 36, 255];
    case "trunk":    return [253, 224, 71, 245];
    case "primary":  return [255, 255, 255, 235];
    case "secondary":return [226, 232, 240, 215];
    case "tertiary": return [203, 213, 225, 195];
    default:         return [148, 163, 184, 175];
  }
}

function roadWidth(highway: string): number {
  switch (highway) {
    case "motorway": return 6;
    case "trunk":    return 5;
    case "primary":  return 4;
    case "secondary":return 3;
    case "tertiary": return 2.2;
    default:         return 1.6;
  }
}

export function createRoadNetworkLayer(roads: RoadCollection) {
  if (!roads?.features?.length) return [];
  return [
    new GeoJsonLayer({
      id: "phuket-roads",
      data: roads,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels" as const,
      lineWidthMinPixels: 1.8,
      getLineColor: (f: { properties?: { highway?: string } }) => roadColor(f.properties?.highway ?? ""),
      getLineWidth: (f: { properties?: { highway?: string } }) => roadWidth(f.properties?.highway ?? ""),
      pickable: true,
      lineJointRounded: true,
      lineCapRounded: true,
    }),
  ];
}

// ─── Canals + drainage (flood prevention) ──────────────────────

export interface CanalFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    id: string;
    waterway: string;
    name?: string;
  };
}

export interface CanalCollection {
  type: "FeatureCollection";
  features: CanalFeature[];
}

function canalColor(waterway: string): [number, number, number, number] {
  switch (waterway) {
    case "river":  return [29, 78, 216, 250];
    case "canal":  return [6, 182, 212, 245];
    case "stream": return [56, 189, 248, 235];
    case "drain":  return [251, 146, 60, 235];
    default:       return [14, 165, 233, 220];
  }
}

function canalWidth(waterway: string): number {
  switch (waterway) {
    case "river":  return 5;
    case "canal":  return 4;
    case "stream": return 2.4;
    case "drain":  return 2.2;
    default:       return 1.8;
  }
}

export function createCanalsLayer(canals: CanalCollection) {
  if (!canals?.features?.length) return [];
  return [
    new GeoJsonLayer({
      id: "phuket-canals",
      data: canals,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels" as const,
      lineWidthMinPixels: 1.8,
      getLineColor: (f: { properties?: { waterway?: string } }) => canalColor(f.properties?.waterway ?? ""),
      getLineWidth: (f: { properties?: { waterway?: string } }) => canalWidth(f.properties?.waterway ?? ""),
      pickable: true,
      lineJointRounded: true,
      lineCapRounded: true,
    }),
  ];
}

// ─── Flood monitoring stations ──────────────────────────────────

export interface FloodStationPoint {
  id: string;
  name: string;
  district: string;
  lat: number;
  lon: number;
  waterLevel: number;
  warningLevel: number;
  criticalLevel: number;
  status: "normal" | "watch" | "warning" | "critical";
  rainfall24h: number;
  capacity: number;
  advice: string;
}

function floodStatusColor(status: FloodStationPoint["status"]): [number, number, number, number] {
  switch (status) {
    case "normal":   return [34, 197, 94, 220];   // green
    case "watch":    return [234, 179, 8, 235];   // yellow
    case "warning":  return [249, 115, 22, 245];  // orange
    case "critical": return [220, 38, 38, 255];   // red
  }
}

function floodStatusRadius(status: FloodStationPoint["status"]): number {
  switch (status) {
    case "critical": return 14;
    case "warning":  return 11;
    case "watch":    return 9;
    case "normal":   return 7;
  }
}

export function createFloodStationLayer(stations: FloodStationPoint[]) {
  if (!stations.length) return [];
  return [
    // Outer pulse halo for elevated stations
    new ScatterplotLayer<FloodStationPoint>({
      id: "phuket-flood-halo",
      data: stations.filter(s => s.status === "warning" || s.status === "critical"),
      getPosition: (s) => [s.lon, s.lat],
      getFillColor: (s) => [...floodStatusColor(s.status).slice(0, 3), 60] as [number, number, number, number],
      getRadius: (s) => floodStatusRadius(s.status) + 8,
      radiusUnits: "pixels" as const,
      radiusMinPixels: 12,
      pickable: false,
      stroked: false,
    }),
    // Inner solid marker
    new ScatterplotLayer<FloodStationPoint>({
      id: "phuket-flood-stations",
      data: stations,
      getPosition: (s) => [s.lon, s.lat],
      getFillColor: (s) => floodStatusColor(s.status),
      getLineColor: [255, 255, 255, 230],
      getRadius: (s) => floodStatusRadius(s.status),
      radiusUnits: "pixels" as const,
      radiusMinPixels: 7,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels" as const,
      lineWidthMinPixels: 1.5,
      pickable: true,
    }),
  ];
}

// ─── Marine conditions (coastal sea state) ────────────────────
// Open-Meteo Marine API: wave height, SST, currents at 6 Phuket coastal points.
// For fishermen, boat operators, and coastal flood awareness.

export interface MarinePoint {
  id: string;
  station: string;
  lat: number;
  lon: number;
  waveHeight: number;        // meters
  wavePeriod: number;
  sst: number;               // °C
  currentVelocity: number;
  riskLevel: "calm" | "moderate" | "rough" | "very_rough" | "phenomenal";
  fishingAdvice: string;
  floodRisk: string;
}

function marineColor(risk: MarinePoint["riskLevel"]): [number, number, number, number] {
  switch (risk) {
    case "calm":        return [34, 197, 94, 230];   // green — safe to fish
    case "moderate":    return [125, 211, 252, 235]; // sky cyan
    case "rough":       return [234, 179, 8, 240];   // yellow
    case "very_rough":  return [249, 115, 22, 245];  // orange
    case "phenomenal":  return [220, 38, 38, 255];   // red — stay in port
  }
}

function marineRadius(waveHeight: number): number {
  // 5px minimum, +1.5px per meter of wave height
  return Math.max(5, 5 + waveHeight * 1.5);
}

export function createMarineLayer(stations: MarinePoint[]) {
  if (!stations.length) return [];
  return [
    // Outer ring — wave height visualization (scales with wave size)
    new ScatterplotLayer<MarinePoint>({
      id: "phuket-marine-waves",
      data: stations,
      getPosition: (s) => [s.lon, s.lat],
      getFillColor: (s) => [...marineColor(s.riskLevel).slice(0, 3), 35] as [number, number, number, number],
      getRadius: (s) => marineRadius(s.waveHeight) + 6,
      radiusUnits: "pixels" as const,
      radiusMinPixels: 8,
      pickable: false,
      stroked: false,
    }),
    // Inner solid marker — sea state status
    new ScatterplotLayer<MarinePoint>({
      id: "phuket-marine-stations",
      data: stations,
      getPosition: (s) => [s.lon, s.lat],
      getFillColor: (s) => marineColor(s.riskLevel),
      getLineColor: [255, 255, 255, 220],
      getRadius: (s) => marineRadius(s.waveHeight),
      radiusUnits: "pixels" as const,
      radiusMinPixels: 5,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels" as const,
      lineWidthMinPixels: 1.5,
      pickable: true,
    }),
    // Station label
    new TextLayer<MarinePoint>({
      id: "phuket-marine-labels",
      data: stations,
      getPosition: (s) => [s.lon, s.lat],
      getText: (s) => `${s.waveHeight.toFixed(1)}m`,
      getColor: [255, 255, 255, 240],
      getSize: 10,
      getPixelOffset: [0, -16],
      getAlignmentBaseline: "center",
      getTextAnchor: "middle",
      fontFamily: "IBM Plex Mono",
      fontWeight: "bold",
      background: true,
      backgroundPadding: [3, 1],
      getBackgroundColor: [0, 0, 0, 180],
    }),
  ];
}

function aqiCategoryColor(aqi: number): [number, number, number, number] {
  if (aqi >= 201) return [136, 28, 36, 230]; // very unhealthy / hazardous
  if (aqi >= 151) return [216, 36, 36, 230]; // unhealthy
  if (aqi >= 101) return [240, 130, 33, 230]; // unhealthy for sensitive
  if (aqi >= 51) return [241, 196, 15, 230]; // moderate
  return [78, 165, 88, 230]; // good
}

/**
 * Marks the worst-AQI station on the map with a small flag — a downward
 * pointer + value chip. Per Dr Non's brief: "small little flag coming down to
 * see which area has more AQI".
 */
export function createAqiFlagLayers(points: AirQualityPoint[]) {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => b.aqi - a.aqi);
  const worst = sorted[0];
  if (!Number.isFinite(worst.aqi)) return [];
  const color = aqiCategoryColor(worst.aqi);
  const data = [worst];
  return [
    // pin shaft (vertical line from anchor up to the chip)
    new LineLayer({
      id: "aqi-flag-shaft",
      data,
      getSourcePosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getTargetPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getColor: color,
      getWidth: 2,
      widthUnits: "pixels" as const,
      // shaft is rendered via TextLayer offset; LineLayer only used to
      // anchor the dot below.
      pickable: false,
    }),
    // dot at the actual station position
    new ScatterplotLayer({
      id: "aqi-flag-dot",
      data,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getRadius: 9,
      radiusUnits: "pixels" as const,
      radiusMinPixels: 7,
      radiusMaxPixels: 12,
      getFillColor: color,
      getLineColor: [15, 23, 42, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
    }),
    // chip above the dot showing AQI value + label
    new TextLayer({
      id: "aqi-flag-label",
      data,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getText: (d: AirQualityPoint) => `▼ AQI ${Math.round(d.aqi)} · ${d.label}`,
      getSize: 14,
      getColor: [15, 23, 42, 250],
      getAlignmentBaseline: "bottom" as const,
      getTextAnchor: "middle" as const,
      getPixelOffset: [0, -16],
      fontFamily: "JetBrains Mono, SF Mono, monospace",
      fontWeight: 700,
      outlineColor: [248, 250, 252, 250],
      outlineWidth: 4,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
}

/**
 * Phuket sub-district (tambon) boundary choropleth.
 * Renders district polygons as subtle outlines + faint fill.
 * Data: GISTDA administrative boundary FeatureServer (DOPA source).
 * Pickable — click a tambon → shows name + district.
 */
/**
 * PM2.5 vertical bar columns — one glowing column per AQI station,
 * height proportional to AQI value. Green/amber/red color by category.
 * Use in 3D mode so the bars rise above the terrain surface.
 */
const AQI_COLUMN_COLORS: Record<string, [number, number, number, number]> = {
  "Good":                           [34,  197,  94,  200],
  "Moderate":                       [250, 204,  21,  200],
  "Unhealthy for Sensitive Groups": [251, 146,  60,  200],
  "Unhealthy":                      [239,  68,  68,  210],
  "Very Unhealthy":                 [168,  85, 247,  220],
  "Hazardous":                      [127,  29,  29,  230],
};

export function createAqiColumnLayers(points: AirQualityPoint[]) {
  if (!points.length) return [];
  return [
    new ColumnLayer({
      id: "aqi-columns",
      data: points,
      diskResolution: 16,
      radius: 450,
      extruded: true,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getElevation: (d: AirQualityPoint) => Math.max(50, d.aqi * 12),
      getFillColor: (d: AirQualityPoint) =>
        AQI_COLUMN_COLORS[d.category ?? "Good"] ?? [34, 197, 94, 200],
      opacity: 0.75,
      pickable: true,
    }),
    // Label at top of column
    new TextLayer({
      id: "aqi-column-labels",
      data: points,
      getPosition: (d: AirQualityPoint) => [d.lng, d.lat],
      getText: (d: AirQualityPoint) => `AQI ${Math.round(d.aqi)}\n${d.label}`,
      getSize: 13,
      getColor: [248, 250, 252, 240],
      getAlignmentBaseline: "bottom" as const,
      getTextAnchor: "middle" as const,
      getPixelOffset: [0, -8],
      getElevation: (d: AirQualityPoint) => Math.max(50, d.aqi * 12) + 10,
      fontFamily: "JetBrains Mono, SF Mono, monospace",
      fontWeight: 700,
      outlineColor: [15, 23, 42, 220],
      outlineWidth: 3,
      sizeUnits: "pixels" as const,
      billboard: true,
      pickable: false,
    }),
  ];
}

export function createTambonLayer(geojson: unknown) {
  return new GeoJsonLayer({
    id: "gistda-tambons",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: geojson as any,
    stroked: true,
    filled: true,
    pickable: true,
    getFillColor: [88, 166, 255, 18],      // very faint blue tint
    getLineColor: [88, 166, 255, 140],     // cool blue hairline
    lineWidthMinPixels: 1,
    getLineWidth: 1,
    lineWidthUnits: "pixels" as const,
  });
}

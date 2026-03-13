import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TileLayer } from "@deck.gl/geo-layers";
import {
  ArcLayer,
  BitmapLayer,
  GeoJsonLayer,
  LineLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import { getProvinceLabels } from "../lib/thai-provinces";
import type {
  AirQualityPoint,
  ConflictZoneCollection,
  ConflictZoneProperties,
  FireEvent,
  FlightData,
  IncidentFeature,
  MapOverlay,
  RainfallPoint,
  RefugeeMovement,
  RegionBorderCollection,
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
  if (typeof tile !== "object" || tile === null || !("bbox" in tile)) {
    return null;
  }

  const bbox = tile.bbox;

  if (typeof bbox !== "object" || bbox === null) {
    return null;
  }

  const box = bbox as Record<string, unknown>;

  if (
    "west" in box &&
    "south" in box &&
    "east" in box &&
    "north" in box &&
    [box.west, box.south, box.east, box.north].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    return {
      west: box.west as number,
      south: box.south as number,
      east: box.east as number,
      north: box.north as number,
    };
  }

  if (
    "left" in box &&
    "bottom" in box &&
    "right" in box &&
    "top" in box &&
    [box.left, box.bottom, box.right, box.top].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    return {
      west: box.left as number,
      south: box.bottom as number,
      east: box.right as number,
      north: box.top as number,
    };
  }

  return null;
}

function createRasterTileLayer({
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
    getTileData: async (tile: TileDataRequest) => {
      if (!tile.url) return null;
      try {
        const response = await fetch(tile.url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        return await createImageBitmap(blob);
      } catch (e) {
        if (onTileError) onTileError(e);
        return null;
      }
    },
    renderSubLayers: (props) => {
      const { data: image, tile, ...layerProps } = props;
      const bounds = extractTileBounds(tile);

      if (!image || !bounds) {
        return null;
      }

      const { west, south, east, north } = bounds;
      const layerId = typeof layerProps.id === "string" ? layerProps.id : id;

      return new BitmapLayer({
        ...layerProps,
        id: `${layerId}-bitmap`,
        data: undefined,
        image,
        opacity,
        bounds: [west, south, east, north],
      });
    },
  });
}

export function createRasterOverlayLayer(
  overlay: MapOverlay,
  opacity = overlay.defaultOpacity,
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

/* ─── 1 × 1 km Grid Layer ──────────────────────────────────────── */

const KM_GRID_BOUNDS = {
  west: 98.2,
  east: 98.55,
  south: 7.7,
  north: 8.2,
};

/** Approximate degrees per kilometer at the Phuket latitude (~7.88°N). */
const DEG_PER_KM_LAT = 1 / 111.32;
const DEG_PER_KM_LNG = 1 / (111.32 * Math.cos((7.88 * Math.PI) / 180));

interface GridLine {
  start: [number, number];
  end: [number, number];
  kind: "major" | "minor";
}

function buildKmGridLines(): GridLine[] {
  const lines: GridLine[] = [];
  const { west, east, south, north } = KM_GRID_BOUNDS;

  // Snap to km grid origin
  const lngStart = Math.floor(west / DEG_PER_KM_LNG) * DEG_PER_KM_LNG;
  const latStart = Math.floor(south / DEG_PER_KM_LAT) * DEG_PER_KM_LAT;

  // Vertical lines (constant longitude)
  for (let lng = lngStart; lng <= east; lng += DEG_PER_KM_LNG) {
    const idx = Math.round((lng - lngStart) / DEG_PER_KM_LNG);
    lines.push({
      start: [lng, south],
      end: [lng, north],
      kind: idx % 5 === 0 ? "major" : "minor",
    });
  }

  // Horizontal lines (constant latitude)
  for (let lat = latStart; lat <= north; lat += DEG_PER_KM_LAT) {
    const idx = Math.round((lat - latStart) / DEG_PER_KM_LAT);
    lines.push({
      start: [west, lat],
      end: [east, lat],
      kind: idx % 5 === 0 ? "major" : "minor",
    });
  }

  return lines;
}

const KM_GRID_LINES = buildKmGridLines();

export function createKilometerGridLayer() {
  return [
    new LineLayer({
      id: "km-grid-lines",
      data: KM_GRID_LINES,
      getSourcePosition: (d: GridLine) => d.start,
      getTargetPosition: (d: GridLine) => d.end,
      getColor: (d: GridLine) =>
        d.kind === "major"
          ? [255, 255, 255, 60]
          : [255, 255, 255, 25],
      getWidth: (d: GridLine) => (d.kind === "major" ? 1.5 : 0.8),
      widthUnits: "pixels" as const,
      pickable: false,
    }),
    // 5-km labels at every 5th gridline intersection
    new TextLayer({
      id: "km-grid-labels",
      data: KM_GRID_LINES.filter(
        (line) =>
          line.kind === "major" &&
          line.start[1] === line.end[1], // horizontal majors only
      ).map((line, i) => ({
        position: [KM_GRID_BOUNDS.west + DEG_PER_KM_LNG * 0.5, line.start[1]] as [number, number],
        text: `${Math.round((line.start[1] - KM_GRID_BOUNDS.south) / DEG_PER_KM_LAT)} km`,
        index: i,
      })),
      getPosition: (d: { position: [number, number] }) => d.position,
      getText: (d: { text: string }) => d.text,
      getSize: 9,
      getColor: [255, 255, 255, 90],
      getTextAnchor: "start" as const,
      getAlignmentBaseline: "bottom" as const,
      fontFamily: "SF Mono, JetBrains Mono, monospace",
      outlineColor: [0, 0, 0, 160],
      outlineWidth: 1.5,
      sizeUnits: "pixels" as const,
      billboard: false,
      pickable: false,
    }),
  ];
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

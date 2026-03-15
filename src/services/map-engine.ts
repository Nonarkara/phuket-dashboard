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
  PksbRouteCollection,
  PksbRouteProperties,
  PksbStopCollection,
  PksbStopProperties,
  PublicCamera,
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

/* ─── 1 × 1 km Grid Layer ──────────────────────────────────────── */

const KM_GRID_BOUNDS = {
  west: 98.16,
  east: 98.64,
  south: 7.64,
  north: 8.24,
};

const KM_GRID_MAJOR_INTERVAL = 5;

/** Approximate degrees per kilometer at the Phuket latitude (~7.9°N). */
const DEG_PER_KM_LAT = 1 / 111.32;
const DEG_PER_KM_LNG = 1 / (111.32 * Math.cos((7.9 * Math.PI) / 180));

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

function roundKmIndex(distanceDegrees: number, degreesPerKm: number) {
  return Math.round(distanceDegrees / degreesPerKm);
}

function buildKmGridData() {
  const lines: GridLine[] = [];
  const labels: GridLabel[] = [];
  const { west, east, south, north } = KM_GRID_BOUNDS;
  const lngStart = Math.floor(west / DEG_PER_KM_LNG) * DEG_PER_KM_LNG;
  const latStart = Math.floor(south / DEG_PER_KM_LAT) * DEG_PER_KM_LAT;

  for (let lng = lngStart; lng <= east + DEG_PER_KM_LNG / 2; lng += DEG_PER_KM_LNG) {
    const indexKm = roundKmIndex(lng - lngStart, DEG_PER_KM_LNG);
    const kind = indexKm % KM_GRID_MAJOR_INTERVAL === 0 ? "major" : "minor";

    lines.push({
      start: [lng, south],
      end: [lng, north],
      kind,
      axis: "vertical",
      indexKm,
    });

    if (kind === "major" && indexKm > 0) {
      labels.push({
        position: [lng, north - DEG_PER_KM_LAT * 0.35],
        text: `${indexKm} km`,
        axis: "x",
      });
    }
  }

  for (let lat = latStart; lat <= north + DEG_PER_KM_LAT / 2; lat += DEG_PER_KM_LAT) {
    const indexKm = roundKmIndex(lat - latStart, DEG_PER_KM_LAT);
    const kind = indexKm % KM_GRID_MAJOR_INTERVAL === 0 ? "major" : "minor";

    lines.push({
      start: [west, lat],
      end: [east, lat],
      kind,
      axis: "horizontal",
      indexKm,
    });

    if (kind === "major" && indexKm > 0) {
      labels.push({
        position: [west + DEG_PER_KM_LNG * 0.55, lat],
        text: `${indexKm} km`,
        axis: "y",
      });
    }
  }

  return { lines, labels };
}

const KM_GRID_DATA = buildKmGridData();

export function createKilometerGridLayer() {
  return [
    new LineLayer({
      id: "km-grid-lines",
      data: KM_GRID_DATA.lines,
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
      data: KM_GRID_DATA.labels,
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

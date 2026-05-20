"use client";
import { apiUrl } from "../../lib/asset-path";
import MapLegend from "./MapLegend";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import type {
  MapViewState,
  PickingInfo,
  ViewStateChangeParameters,
} from "@deck.gl/core";
import type { DeckGLProps } from "@deck.gl/react";
import dynamic from "next/dynamic";
const DeckGL = dynamic<DeckGLProps>(
  () => import("@deck.gl/react").then((module) => module.default),
  { ssr: false },
);
import {
  createAqiFlagLayers,
  createDisasterAlertLayer,
  createFireLayer,
  createFlightPathsLayer,
  createIncidentLayer,
  createKilometerGridLayer,
  createMaritimeTrafficLayers,
  createPksbBusLayers,
  createPksbRouteLayers,
  createPublicCameraLayer,
  createRainfallLayer,
  createRasterTileLayer,
  createRefugeeLayer,
  createSeaRoutesLayers,
  createTrafficEventLayers,
  createTourismHotspotLayer,
  createWaterwaysLayer,
  createPoiLayers,
  createRoadNetworkLayer,
  createCanalsLayer,
  createFloodStationLayer,
  createMarineLayer,
  POI_AMENITY_LABEL,
  type PoiCollection,
  type PoiFeature,
  type RoadCollection,
  type RoadFeature,
  type CanalCollection,
  type CanalFeature,
  type FloodStationPoint,
  type MarinePoint,
} from "../../services/map-engine";
import {
  createSatelliteTileLayer,
  fetchRainViewerLatest,
  freshnessLabel as satelliteFreshnessLabel,
  freshnessTier as satelliteFreshnessTier,
  buildGistdaOceanMeta,
  GISTDA_OCEAN_WMS_BASE,
  GISTDA_OCEAN_LAYERS,
} from "../../services/satellite-layers";
import type { SatelliteSource } from "../../services/satellite-layers";
import { createWmsTileLayer, createTambonLayer } from "../../services/map-engine";
import { PHUKET_SEA_ROUTES } from "../../data/phuket-sea-routes";
import { PHUKET_WATERWAYS } from "../../data/phuket-waterways";
import {
  BASEMAP_OPTIONS,
  basemapStyle,
  type BasemapId,
} from "../../services/basemap-styles";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { GOVERNOR_CORRIDORS, findCorridorById } from "../../lib/governor-config";
import {
  buildScenarioUrl,
  fetchJsonOrFallback,
  fetchJsonOrNull,
  isAbortError,
} from "../../lib/client-requests";
import { getUsableMapboxToken } from "../../lib/mapbox";
import type {
  AirQualityPoint,
  DisasterAlert,
  DisasterFeedResponse,
  FeedMode,
  FireEvent,
  FlightArrivalsResponse,
  IncidentFeature,
  MaritimeSecurityResponse,
  MaritimeVessel,
  ProvinceSelection,
  FlightData,
  RainfallPoint,
  RefugeeMovement,
  PksbRouteFeature,
  PksbStopFeature,
  PksbBusPosition,
  PksbBusPositionResponse,
  PksbTransitResponse,
  PublicCamera,
  PublicCameraResponse,
  TrafficEvent,
  TrafficResponse,
  TourismHotspot,
  TourismHotspotsResponse,
} from "../../types/dashboard";

function countArrivalsNextMinutes(
  arrivals: ReadonlyArray<{ scheduledTime?: string }>,
  windowMin: number,
): number {
  if (!arrivals.length) return 0;
  const now = new Date();
  const bangkokOffsetMin = 7 * 60;
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowMin = (utcMin + bangkokOffsetMin + 24 * 60) % (24 * 60);
  return arrivals.reduce((count, arrival) => {
    const time = arrival?.scheduledTime;
    if (!time) return count;
    const [hh, mm] = time.split(":").map((part) => Number(part));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return count;
    const arrMin = hh * 60 + mm;
    let diff = arrMin - nowMin;
    if (diff < -12 * 60) diff += 24 * 60;
    if (diff > 12 * 60) diff -= 24 * 60;
    return diff >= -10 && diff <= windowMin ? count + 1 : count;
  }, 0);
}

function modeDotClass(mode: FeedMode | "unavailable"): string {
  if (mode === "live") return "bg-[#22c55e]";
  if (mode === "modeled" || mode === "hybrid") return "bg-[#f59e0b]";
  if (mode === "degraded") return "bg-[#ef4444]";
  return "bg-[var(--line)]";
}

import "maplibre-gl/dist/maplibre-gl.css";
import type maplibregl from "maplibre-gl";

const MapboxMap = dynamic(() => import("react-map-gl/maplibre"), { ssr: false });
const MAPBOX_TOKEN = getUsableMapboxToken(
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
);
const DEBUG_INGEST_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEBUG_INGEST === "true";

const globalLuma = globalThis as typeof globalThis & {
  __phuketDashboardLumaRegistered?: boolean;
};
const lumaReadyListeners = new Set<() => void>();

function subscribeToLumaReady(listener: () => void) {
  lumaReadyListeners.add(listener);
  return () => {
    lumaReadyListeners.delete(listener);
  };
}

function getLumaReadySnapshot() {
  return globalLuma.__phuketDashboardLumaRegistered === true;
}

function notifyLumaReady() {
  lumaReadyListeners.forEach((listener) => listener());
}

const PHUKET_BOUNDS = {
  latMin: 7.4,
  latMax: 8.5,
  lonMin: 98.0,
  lonMax: 99.0,
} as const;

const PHUKET_MIN_ZOOM = 9;
const PHUKET_MAX_ZOOM = 16;

function clampViewToPhuket(viewState: MapViewState): MapViewState {
  return {
    ...viewState,
    latitude: Math.max(
      PHUKET_BOUNDS.latMin,
      Math.min(PHUKET_BOUNDS.latMax, viewState.latitude),
    ),
    longitude: Math.max(
      PHUKET_BOUNDS.lonMin,
      Math.min(PHUKET_BOUNDS.lonMax, viewState.longitude),
    ),
    zoom: Math.max(
      PHUKET_MIN_ZOOM,
      Math.min(PHUKET_MAX_ZOOM, viewState.zoom),
    ),
  };
}

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 98.334,
  latitude: 7.886,
  zoom: 10,
  pitch: 45,
  bearing: -5,
  minZoom: PHUKET_MIN_ZOOM,
  maxZoom: PHUKET_MAX_ZOOM,
};

const EMPTY_PKSB_ROUTES = {
  type: "FeatureCollection",
  features: [],
} as const satisfies PksbTransitResponse["routes"];

// Basemap ids, options, and styles live in src/services/basemap-styles.ts

const EMPTY_PKSB_STOPS = {
  type: "FeatureCollection",
  features: [],
} as const satisfies PksbTransitResponse["stops"];

const EMPTY_PKSB_TRANSIT_RESPONSE: PksbTransitResponse = {
  generatedAt: new Date(0).toISOString(),
  source: [],
  routes: EMPTY_PKSB_ROUTES,
  stops: EMPTY_PKSB_STOPS,
};

const EMPTY_TRAFFIC_RESPONSE: TrafficResponse = {
  generatedAt: new Date(0).toISOString(),
  provider: "Longdo/ITIC",
  status: "fallback",
  events: [],
};

const EMPTY_PKSB_BUS_RESPONSE: PksbBusPositionResponse = {
  generatedAt: new Date(0).toISOString(),
  buses: [],
  mode: "modeled",
  sourceSummary: {
    label: "PKSB fallback",
    mode: "modeled",
    sources: ["PKSB fallback"],
  },
  freshness: {
    observedAt: null,
    checkedAt: new Date(0).toISOString(),
    ageMinutes: null,
    maxAgeMinutes: 15,
    isFresh: false,
    fallbackTier: "scenario",
    sourceIds: ["PKSB fallback"],
  },
};

const EMPTY_MARITIME_SECURITY_RESPONSE: MaritimeSecurityResponse = {
  generatedAt: new Date(0).toISOString(),
  posture: "stable",
  summary: "",
  provider: "Modeled ferry operations",
  vessels: [],
  chokepoints: [],
  sources: ["Modeled ferry operations"],
  mode: "modeled",
  sourceSummary: {
    label: "Modeled ferry operations",
    mode: "modeled",
    sources: ["Modeled ferry operations"],
  },
  freshness: {
    observedAt: null,
    checkedAt: new Date(0).toISOString(),
    ageMinutes: null,
    maxAgeMinutes: 60,
    isFresh: false,
    fallbackTier: "scenario",
    sourceIds: ["Modeled ferry operations"],
  },
};

function subscribeToClientState() {
  return () => {};
}

function detectWebglSupport() {
  if (typeof document === "undefined") {
    return true;
  }

  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2")) || Boolean(canvas.getContext("webgl"));
}

type GridScale = "off" | "1km" | "5km" | "10km";

type OverlayState = {
  precipitationRadar: boolean;
  waterways: boolean;
  aqiFlag: boolean;
  publicInfrastructure: boolean;
  roadNetwork: boolean;
  canalsDrainage: boolean;
  floodStations: boolean;
  marineConditions: boolean;
  gridScale: GridScale;
  sstAndaman: boolean;
  chlAndaman: boolean;
  tambonBoundaries: boolean;
};

function interpolateMotionFrame<
  T extends { id: string; lat: number; lng: number; heading?: number | null },
>(
  previous: T[],
  current: T[],
  progress: number,
) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const previousById = new Map(previous.map((item) => [item.id, item]));

  return current.map((item) => {
    const previousItem = previousById.get(item.id);
    if (!previousItem) {
      return item;
    }

    return {
      ...item,
      lat: previousItem.lat + (item.lat - previousItem.lat) * clampedProgress,
      lng: previousItem.lng + (item.lng - previousItem.lng) * clampedProgress,
      heading:
        typeof item.heading === "number" && typeof previousItem.heading === "number"
          ? previousItem.heading +
            ((((item.heading - previousItem.heading) % 360) + 540) % 360 - 180) *
              clampedProgress
          : item.heading,
    };
  });
}

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId: string = "ui",
) {
  if (!DEBUG_INGEST_ENABLED) {
    return;
  }

  // #region agent log
  fetch(apiUrl("/api/debug/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, hypothesisId, location, message, data }),
  }).catch(() => {});
  // #endregion
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIncidentFeature(value: unknown): value is IncidentFeature {
  return (
    isRecord(value) &&
    isRecord(value.properties) &&
    typeof value.properties.notes === "string"
  );
}

function isFireEvent(value: unknown): value is FireEvent {
  return isRecord(value) && typeof value.brightness === "number";
}

function hasLabel(value: unknown): value is RefugeeMovement | RainfallPoint {
  return isRecord(value) && typeof value.label === "string";
}

function isAirQualityPoint(value: unknown): value is AirQualityPoint {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.aqi === "number" &&
    typeof value.pm25 === "number"
  );
}

function isPksbBusPosition(value: unknown): value is PksbBusPosition {
  return (
    isRecord(value) &&
    typeof value.licensePlate === "string" &&
    typeof value.vehicleId === "string" &&
    typeof value.lng === "number"
  );
}

function isPksbRouteFeature(value: unknown): value is PksbRouteFeature {
  return (
    isRecord(value) &&
    isRecord(value.properties) &&
    typeof value.properties.routeId === "string" &&
    typeof value.properties.routeLabel === "string" &&
    typeof value.properties.directionLabel === "string"
  );
}

function isPksbStopFeature(value: unknown): value is PksbStopFeature {
  return (
    isRecord(value) &&
    isRecord(value.properties) &&
    typeof value.properties.routeId === "string" &&
    typeof value.properties.stopNameEn === "string" &&
    typeof value.properties.timetable === "string"
  );
}

function isPublicCamera(value: unknown): value is PublicCamera {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.location === "string" &&
    typeof value.locationLabel === "string" &&
    typeof value.provider === "string" &&
    typeof value.focusArea === "string" &&
    typeof value.strategicNote === "string"
  );
}

function isDisasterAlert(value: unknown): value is DisasterAlert {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.area === "string" &&
    typeof value.summary === "string"
  );
}

function isMaritimeVessel(value: unknown): value is MaritimeVessel {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.strategicNote === "string"
  );
}

function isTrafficEvent(value: unknown): value is TrafficEvent {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.type === "string" &&
    typeof value.lat === "number" &&
    typeof value.lng === "number"
  );
}

function isTourismHotspot(value: unknown): value is TourismHotspot {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.area === "string" &&
    typeof value.summary === "string"
  );
}

// ── POI / Road / Canal / Flood tooltip type guards ──
function isPoiFeature(o: unknown): o is PoiFeature {
  return !!o && typeof o === "object" && "properties" in o
    && typeof (o as { properties?: { amenity?: unknown } }).properties?.amenity === "string"
    && (o as { geometry?: { type?: string } }).geometry?.type === "Point";
}
function isRoadFeature(o: unknown): o is RoadFeature {
  return !!o && typeof o === "object" && "properties" in o
    && typeof (o as { properties?: { highway?: unknown } }).properties?.highway === "string";
}
function isCanalFeature(o: unknown): o is CanalFeature {
  return !!o && typeof o === "object" && "properties" in o
    && typeof (o as { properties?: { waterway?: unknown } }).properties?.waterway === "string";
}
function isFloodStation(o: unknown): o is FloodStationPoint {
  return !!o && typeof o === "object" && "warningLevel" in o && "waterLevel" in o;
}
function isMarinePoint(o: unknown): o is MarinePoint {
  return !!o && typeof o === "object" && "waveHeight" in o && "sst" in o && "fishingAdvice" in o;
}

function getTooltipText(object: unknown): string | null {
  if (isPoiFeature(object)) {
    const a = object.properties.amenity;
    const label = POI_AMENITY_LABEL[a] ?? a;
    const name  = object.properties.name || label;
    const parts = [`${label}: ${name}`];
    if (object.properties.name_th) parts.push(`(${object.properties.name_th})`);
    if (object.properties.phone)   parts.push(`☎ ${object.properties.phone}`);
    if (object.properties.address) parts.push(object.properties.address);
    return parts.join(" • ");
  }

  if (isRoadFeature(object)) {
    const h = object.properties.highway;
    const name = object.properties.name || object.properties.ref || h.toUpperCase();
    return `${h.toUpperCase()} • ${name}${object.properties.lanes ? ` • ${object.properties.lanes} lanes` : ""}`;
  }

  if (isCanalFeature(object)) {
    const w = object.properties.waterway;
    const name = object.properties.name || w.toUpperCase();
    return `${w.toUpperCase()} • ${name}`;
  }

  if (isFloodStation(object)) {
    const pct = Math.round((object.waterLevel / object.criticalLevel) * 100);
    return `${object.name} (${object.district}) • ${object.waterLevel}m / ${object.criticalLevel}m crit • ${pct}% • ${object.status.toUpperCase()} • ${object.advice}`;
  }

  if (isMarinePoint(object)) {
    return `${object.station} • Wave ${object.waveHeight.toFixed(1)}m (${object.riskLevel.replace("_", " ")}) • SST ${object.sst.toFixed(1)}°C • Current ${object.currentVelocity.toFixed(2)} m/s • 🎣 ${object.fishingAdvice} • 🌊 ${object.floodRisk}`;
  }

  if (isIncidentFeature(object)) {
    return object.properties.notes || object.properties.title;
  }

  if (isAirQualityPoint(object)) {
    return `${object.label}: AQI ${Math.round(object.aqi)} / PM2.5 ${Math.round(object.pm25)}`;
  }

  if (isPksbBusPosition(object)) {
    return `Bus ${object.licensePlate} • ${object.routeId} • ${object.status}`;
  }

  if (isPksbStopFeature(object)) {
    return `${object.properties.stopNameEn} • ${object.properties.routeLabel}`;
  }

  if (isPksbRouteFeature(object)) {
    return `${object.properties.routeLabel} • ${object.properties.directionLabel}`;
  }

  if (isPublicCamera(object)) {
    return `${object.label} • ${object.operationalState ?? object.validationState} • ${object.provider}`;
  }

  if (isDisasterAlert(object)) {
    return `${object.title} • ${object.area}`;
  }

  if (isMaritimeVessel(object)) {
    return `${object.name} • ${object.type} • ${object.status}`;
  }

  if (isTourismHotspot(object)) {
    return `${object.label} • ${object.area} • ${object.status}`;
  }

  if (isTrafficEvent(object)) {
    return `${object.type}: ${object.title}`;
  }

  if (hasLabel(object)) {
    return object.label;
  }

  if (isFireEvent(object)) {
    return `Fire Intensity: ${object.brightness}`;
  }

  return null;
}

export default function BorderMap({
  onProvinceSelect,
  selectedCorridorId,
  onCorridorSelect,
  disasterFeed,
  maritimeSecurityFeed,
  cameraFeed,
  tourismFeed,
  scenarioId,
}: {
  onProvinceSelect?: (province: ProvinceSelection) => void;
  selectedCorridorId?: string;
  onCorridorSelect?: (corridorId: string) => void;
  disasterFeed?: DisasterFeedResponse | null;
  maritimeSecurityFeed?: MaritimeSecurityResponse | null;
  cameraFeed?: PublicCameraResponse | null;
  tourismFeed?: TourismHotspotsResponse | null;
  scenarioId?: string | null;
}) {
  const is4K = useWarRoomScale();
  const mounted = useSyncExternalStore(
    subscribeToClientState,
    () => true,
    () => false,
  );
  const webglSupported = useMemo(
    () => (mounted ? detectWebglSupport() : true),
    [mounted],
  );
  const lumaReady = useSyncExternalStore(
    subscribeToLumaReady,
    getLumaReadySnapshot,
    () => false,
  );
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  // ─── 3D view mode ───────────────────────────────────────────────────────────
  const [is3D, setIs3D] = useState(false);
  // Stable ref so the building-layer helper can always read the current value
  // without needing to be recreated on every state change.
  const is3DRef = useRef(false);
  // Underlying MapLibre map instance — set once per map load / basemap change.
  const mlMapRef = useRef<maplibregl.Map | null>(null);

  // Camera follows view mode (matching Chula dashboard transition cadence).
  useEffect(() => {
    is3DRef.current = is3D;
    setViewState((prev) => ({
      ...prev,
      pitch: is3D ? 65 : 45,
      bearing: is3D ? -20 : -5,
      transitionDuration: 700,
    }));
  }, [is3D]);

  // ─── Basemap: exactly one active at a time (radio) ───
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("street");


  const [incidents, setIncidents] = useState<IncidentFeature[]>([]);
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [refugees, setRefugees] = useState<RefugeeMovement[]>([]);
  const [rainfall, setRainfall] = useState<RainfallPoint[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityPoint[]>([]);
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [arrivalsResp, setArrivalsResp] = useState<FlightArrivalsResponse | null>(null);
  const [rainViewerSource, setRainViewerSource] = useState<SatelliteSource | null>(null);
  const [pksbBusesMode, setPksbBusesMode] = useState<FeedMode | null>(null);
  const [maritimeMode, setMaritimeMode] = useState<FeedMode | null>(null);
  const [trafficStatus, setTrafficStatus] = useState<string>("");
  const [pksbRoutes, setPksbRoutes] =
    useState<PksbTransitResponse["routes"]>(EMPTY_PKSB_ROUTES);
  const [pksbStops, setPksbStops] =
    useState<PksbTransitResponse["stops"]>(EMPTY_PKSB_STOPS);
  const [pksbBuses, setPksbBuses] = useState<PksbBusPosition[]>([]);
  const [previousPksbBuses, setPreviousPksbBuses] = useState<PksbBusPosition[]>([]);
  const [busFrameStartedAt, setBusFrameStartedAt] = useState(() => Date.now());
  const pksbBusesRef = useRef<PksbBusPosition[]>([]);
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [maritimeVessels, setMaritimeVessels] = useState<MaritimeVessel[]>(
    maritimeSecurityFeed?.vessels ?? [],
  );
  const [previousMaritimeVessels, setPreviousMaritimeVessels] = useState<MaritimeVessel[]>(
    maritimeSecurityFeed?.vessels ?? [],
  );
  const [maritimeFrameStartedAt, setMaritimeFrameStartedAt] = useState(() => Date.now());
  const maritimeVesselsRef = useRef<MaritimeVessel[]>(maritimeSecurityFeed?.vessels ?? []);
  const [animationNow, setAnimationNow] = useState(() => Date.now());
  const [enabledOverlays, setEnabledOverlays] = useState<OverlayState>(() => ({
    precipitationRadar: false,
    waterways: false,
    aqiFlag: false,
    publicInfrastructure: false,
    roadNetwork: false,
    canalsDrainage: false,
    floodStations: false,
    marineConditions: false,
    sstAndaman: false,
    chlAndaman: false,
    tambonBoundaries: false,
    gridScale: "off",
  }));

  // ─── 3D building layer helpers ────────────────────────────────────────────
  // Injects or toggles a fill-extrusion layer on the underlying MapLibre map.
  // Called on every map load (including basemap changes) and on is3D changes.
  // Uses is3DRef so the function itself is stable (no deps that change often).
  const applyBuilding3DLayer = useCallback((mlMap: maplibregl.Map) => {
    if (!mlMap?.isStyleLoaded?.()) return;
    const BLDG_SRC  = "phuket-bldg-src";
    const BLDG_LAYER = "phuket-bldg-3d";
    const DEM_SRC   = "phuket-terrain-dem";
    const SKY_LAYER = "phuket-sky";
    const show = is3DRef.current;

    // ── Height expression ───────────────────────────────────────
    // Priority: render_height → height → levels * 3.2m → 6m default
    // Buildings with many levels (hotels, condos) will extrude dramatically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heightExpr: any = [
      "to-number",
      ["coalesce",
        ["get", "render_height"],
        ["get", "height"],
        ["*", ["to-number", ["coalesce", ["get", "building:levels"], ["get", "levels"], 0]], 3.2],
        6,
      ],
    ];

    if (show) {
      // ── 1. DEM terrain — AWS Terrarium (free, global, 15m resolution) ──
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
      // Exaggeration 2.0 — Phuket's ridgeline (max 529m) will tower visually
      (mlMap as maplibregl.Map & { setTerrain?: (opt: unknown) => void }).setTerrain?.({
        source: DEM_SRC,
        exaggeration: 2.0,
      });

      // ── 2. Sky atmosphere — dramatic look for 3D ──
      // maplibre v5 removed BackgroundPaint/AnyLayer exports — cast via unknown
      if (!mlMap.getLayer(SKY_LAYER)) {
        mlMap.addLayer({
          id: SKY_LAYER,
          type: "sky" as unknown as "background",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 90.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        } as unknown as Parameters<typeof mlMap.addLayer>[0]);
      }

      // ── 3. Building extrusions ──
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
        mlMap.addLayer(
          {
            id: BLDG_LAYER,
            type: "fill-extrusion",
            source: BLDG_SRC,
            "source-layer": "building",
            minzoom: 10,
            paint: {
              // Warm amber for tall (hotels/towers) → teal for mid → cool gray for ground-floor
              // Tall Patong hotels (~50–80m) glow amber; Old Town shophouses (~6–9m) stay gray
              "fill-extrusion-color": [
                "interpolate", ["linear"],
                heightExpr,
                0,   "#1c2b3a",   // ground-floor: dark gray-blue
                6,   "#253545",   // 2-storey: slate
                10,  "#2a4a5c",   // 3-storey: teal-gray
                20,  "#1e7896",   // mid-rise: teal
                40,  "#d47a1e",   // tall: amber (big hotels start here)
                70,  "#f5a623",   // tower: golden amber
                100, "#ff6b35",   // high-rise: orange-amber
                150, "#ff4444",   // ultra-tall: red (visual alarm — stands out)
              ],
              "fill-extrusion-height": heightExpr,
              "fill-extrusion-base": [
                "to-number",
                ["coalesce", ["get", "render_min_height"], 0],
              ],
              "fill-extrusion-opacity": 0.88,
            },
          },
          firstLabel,
        );
      } else {
        mlMap.setLayoutProperty(BLDG_LAYER, "visibility", "visible");
      }
    } else {
      // ── Disable terrain, sky, buildings ──
      (mlMap as maplibregl.Map & { setTerrain?: (opt: null) => void }).setTerrain?.(null);
      if (mlMap.getLayer(BLDG_LAYER)) mlMap.setLayoutProperty(BLDG_LAYER, "visibility", "none");
      if (mlMap.getLayer(SKY_LAYER)) mlMap.setLayoutProperty(SKY_LAYER, "visibility", "none");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads is3DRef, not is3D directly

  // Re-sync building layer whenever is3D toggles
  useEffect(() => {
    if (mlMapRef.current) applyBuilding3DLayer(mlMapRef.current);
  }, [is3D, applyBuilding3DLayer]);

  // On every map load (fires for fresh mount and on basemap key change)
  const handleMapLoad = useCallback(
    (event: { target: maplibregl.Map }) => {
      mlMapRef.current = event.target;
      applyBuilding3DLayer(event.target);
    },
    [applyBuilding3DLayer],
  );

  // ── Lazy-loaded GeoJSON / data caches for new overlays ──
  const [poiData, setPoiData] = useState<PoiCollection | null>(null);
  const [roadsData, setRoadsData] = useState<RoadCollection | null>(null);
  const [canalsData, setCanalsData] = useState<CanalCollection | null>(null);
  const [floodStations, setFloodStations] = useState<FloodStationPoint[]>([]);
  const [marineStations, setMarineStations] = useState<MarinePoint[]>([]);
  const [tambonGeoJson, setTambonGeoJson] = useState<object | null>(null);

  useEffect(() => {
    if (enabledOverlays.publicInfrastructure && !poiData) {
      fetch("/data/phuket-poi.geojson")
        .then(r => r.json())
        .then((d: PoiCollection) => setPoiData(d))
        .catch(() => undefined);
    }
  }, [enabledOverlays.publicInfrastructure, poiData]);

  useEffect(() => {
    if (enabledOverlays.roadNetwork && !roadsData) {
      fetch("/data/phuket-roads.geojson")
        .then(r => r.json())
        .then((d: RoadCollection) => setRoadsData(d))
        .catch(() => undefined);
    }
  }, [enabledOverlays.roadNetwork, roadsData]);

  useEffect(() => {
    if (enabledOverlays.canalsDrainage && !canalsData) {
      fetch("/data/phuket-canals.geojson")
        .then(r => r.json())
        .then((d: CanalCollection) => setCanalsData(d))
        .catch(() => undefined);
    }
  }, [enabledOverlays.canalsDrainage, canalsData]);

  useEffect(() => {
    if (enabledOverlays.floodStations && floodStations.length === 0) {
      fetch("/api/modules/thai-flood-stations")
        .then(r => r.json())
        .then((d: { data?: FloodStationPoint[] }) => {
          if (Array.isArray(d?.data)) setFloodStations(d.data);
        })
        .catch(() => undefined);
    }
  }, [enabledOverlays.floodStations, floodStations.length]);

  useEffect(() => {
    if (enabledOverlays.marineConditions && marineStations.length === 0) {
      fetch("/api/modules/open-meteo-marine")
        .then(r => r.json())
        .then((d: { data?: MarinePoint[] }) => {
          if (Array.isArray(d?.data)) setMarineStations(d.data);
        })
        .catch(() => undefined);
    }
  }, [enabledOverlays.marineConditions, marineStations.length]);

  // GISTDA tambon boundaries — lazy fetch on first toggle
  useEffect(() => {
    if (enabledOverlays.tambonBoundaries && !tambonGeoJson) {
      fetch("/api/gistda/tambons")
        .then((r) => r.json())
        .then((d: object) => setTambonGeoJson(d))
        .catch(() => undefined);
    }
  }, [enabledOverlays.tambonBoundaries, tambonGeoJson]);

  const disasterAlerts = disasterFeed?.alerts ?? [];
  const publicCameras = [
    ...(cameraFeed?.cameras ?? []),
    ...(cameraFeed?.scoutTargets ?? []),
  ];
  const tourismHotspots = tourismFeed?.hotspots ?? [];
  const animatedPksbBuses = interpolateMotionFrame(
    previousPksbBuses,
    pksbBuses,
    (animationNow - busFrameStartedAt) / 15000,
  );
  const animatedMaritimeVessels = interpolateMotionFrame(
    previousMaritimeVessels,
    maritimeVessels,
    (animationNow - maritimeFrameStartedAt) / 30000,
  );
  const movingBusCount = pksbBuses.filter(
    (bus) => bus.status === "moving" || bus.status === "dwelling",
  ).length;
  const disasterAlertCount = disasterAlerts.length;
  const maritimeVesselCount = animatedMaritimeVessels.length;
  const arrivalsNext60Count = countArrivalsNextMinutes(arrivalsResp?.arrivals ?? [], 60);
  const verifiedCameraCount = publicCameras.filter(
    (camera) => camera.operationalState === "live" || camera.operationalState === "reachable",
  ).length;
  const hasMapboxBaseMap = true;
  const activeCorridor = selectedCorridorId
    ? findCorridorById(selectedCorridorId)
    : GOVERNOR_CORRIDORS[0];
  const mapStyle = basemapStyle(activeBasemap);
  const fallbackBackgroundClass =
    "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),_rgba(8,20,34,0.95)_62%)]";
  const slowMapControllerRef = useRef<AbortController | null>(null);
  const slowMapRequestIdRef = useRef(0);
  const flightControllerRef = useRef<AbortController | null>(null);
  const flightRequestIdRef = useRef(0);
  const busControllerRef = useRef<AbortController | null>(null);
  const busRequestIdRef = useRef(0);
  const maritimeControllerRef = useRef<AbortController | null>(null);
  const maritimeRequestIdRef = useRef(0);

  const loadSlowMapData = useEffectEvent(async () => {
    const requestId = ++slowMapRequestIdRef.current;
    slowMapControllerRef.current?.abort();
    const controller = new AbortController();
    slowMapControllerRef.current = controller;

    try {
      const [
        incidentData,
        fireData,
        refugeeData,
        rainfallData,
        airQualityData,
        pksbTransitData,
        trafficData,
      ] = await Promise.all([
        fetchJsonOrFallback<IncidentFeature[]>("/api/incidents", [], {
          signal: controller.signal,
        }),
        fetchJsonOrFallback<FireEvent[]>("/api/fires", [], {
          signal: controller.signal,
        }),
        fetchJsonOrFallback<RefugeeMovement[]>("/api/movements", [], {
          signal: controller.signal,
        }),
        fetchJsonOrFallback<RainfallPoint[]>("/api/rainfall", [], {
          signal: controller.signal,
        }),
        fetchJsonOrFallback<AirQualityPoint[]>("/api/air-quality", [], {
          signal: controller.signal,
        }),
        fetchJsonOrFallback<PksbTransitResponse>(
          buildScenarioUrl("/api/transit/pksb", scenarioId),
          EMPTY_PKSB_TRANSIT_RESPONSE,
          { signal: controller.signal },
        ),
        fetchJsonOrFallback<TrafficResponse>(
          buildScenarioUrl("/api/traffic", scenarioId),
          EMPTY_TRAFFIC_RESPONSE,
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted || requestId !== slowMapRequestIdRef.current) {
        return;
      }

      setIncidents(Array.isArray(incidentData) ? incidentData : []);
      setFires(Array.isArray(fireData) ? fireData : []);
      setRefugees(Array.isArray(refugeeData) ? refugeeData : []);
      setRainfall(Array.isArray(rainfallData) ? rainfallData : []);
      setAirQuality(Array.isArray(airQualityData) ? airQualityData : []);
      setPksbRoutes(pksbTransitData.routes);
      setPksbStops(pksbTransitData.stops);
      setTrafficEvents(Array.isArray(trafficData.events) ? trafficData.events : []);
      setTrafficStatus(typeof trafficData.status === "string" ? trafficData.status : "");
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const loadFlights = useEffectEvent(async () => {
    const requestId = ++flightRequestIdRef.current;
    flightControllerRef.current?.abort();
    const controller = new AbortController();
    flightControllerRef.current = controller;

    try {
      const [flightData, arrivalsData] = await Promise.all([
        fetchJsonOrFallback<FlightData[]>(
          buildScenarioUrl("/api/flights", scenarioId),
          [],
          { signal: controller.signal },
        ),
        fetchJsonOrNull<FlightArrivalsResponse>(
          buildScenarioUrl("/api/flights/arrivals", scenarioId),
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted || requestId !== flightRequestIdRef.current) {
        return;
      }

      setFlights(Array.isArray(flightData) ? flightData : []);
      if (arrivalsData) setArrivalsResp(arrivalsData);
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const loadPksbBuses = useEffectEvent(async () => {
    const requestId = ++busRequestIdRef.current;
    busControllerRef.current?.abort();
    const controller = new AbortController();
    busControllerRef.current = controller;

    try {
      const busData = await fetchJsonOrFallback<PksbBusPositionResponse>(
        buildScenarioUrl("/api/transit/pksb/buses", scenarioId),
        EMPTY_PKSB_BUS_RESPONSE,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== busRequestIdRef.current) {
        return;
      }

      const nextBuses = Array.isArray(busData.buses) ? busData.buses : [];
      setPreviousPksbBuses(pksbBusesRef.current);
      pksbBusesRef.current = nextBuses;
      setPksbBuses(nextBuses);
      setPksbBusesMode(busData.mode ?? null);
      setBusFrameStartedAt(Date.now());
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const loadMaritime = useEffectEvent(async () => {
    const requestId = ++maritimeRequestIdRef.current;
    maritimeControllerRef.current?.abort();
    const controller = new AbortController();
    maritimeControllerRef.current = controller;

    try {
      const maritimeData = await fetchJsonOrFallback<MaritimeSecurityResponse>(
        buildScenarioUrl("/api/maritime/security", scenarioId),
        EMPTY_MARITIME_SECURITY_RESPONSE,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== maritimeRequestIdRef.current) {
        return;
      }

      const nextVessels = Array.isArray(maritimeData.vessels) ? maritimeData.vessels : [];
      setPreviousMaritimeVessels(maritimeVesselsRef.current);
      maritimeVesselsRef.current = nextVessels;
      setMaritimeVessels(nextVessels);
      setMaritimeMode(maritimeData.mode ?? null);
      setMaritimeFrameStartedAt(Date.now());
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const handleViewStateChange = ({
    viewState: nextViewState,
  }: ViewStateChangeParameters<MapViewState>) => {
    setViewState(clampViewToPhuket(nextViewState));
  };

  const handleWireframeViewStateChange = ({
    viewState: nextViewState,
  }: ViewStateChangeParameters<MapViewState>) => {
    const clamped = clampViewToPhuket(nextViewState);
    setViewState((prev) => ({
      ...prev,
      longitude: clamped.longitude,
      latitude: clamped.latitude,
      zoom: clamped.zoom,
    }));
  };

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!globalLuma.__phuketDashboardLumaRegistered) {
      luma.registerAdapters([webgl2Adapter]);
      globalLuma.__phuketDashboardLumaRegistered = true;
      notifyLumaReady();
    }
  }, [mounted]);

  useEffect(() => {
    debugLog("H1", "BorderMap.tsx:useEffect", "mounted effect ran", {
      hasMapboxToken: MAPBOX_TOKEN.length > 0,
      hasWebgl: webglSupported,
    });
  }, [webglSupported]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAnimationNow(Date.now());
    }, 150);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!maritimeSecurityFeed?.vessels) {
      return;
    }

    setPreviousMaritimeVessels(maritimeVesselsRef.current);
    maritimeVesselsRef.current = maritimeSecurityFeed.vessels;
    setMaritimeVessels(maritimeSecurityFeed.vessels);
    setMaritimeFrameStartedAt(Date.now());
  }, [maritimeSecurityFeed]);

  useEffect(() => {
    void loadSlowMapData();
    const interval = window.setInterval(() => void loadSlowMapData(), 2 * 60 * 1000);

    return () => {
      slowMapRequestIdRef.current += 1;
      slowMapControllerRef.current?.abort();
      slowMapControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  useEffect(() => {
    void loadFlights();
    const interval = window.setInterval(() => void loadFlights(), 30000);

    return () => {
      flightRequestIdRef.current += 1;
      flightControllerRef.current?.abort();
      flightControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  useEffect(() => {
    void loadPksbBuses();
    const interval = window.setInterval(() => void loadPksbBuses(), 15000);

    return () => {
      busRequestIdRef.current += 1;
      busControllerRef.current?.abort();
      busControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  useEffect(() => {
    void loadMaritime();
    const interval = window.setInterval(() => void loadMaritime(), 30000);

    return () => {
      maritimeRequestIdRef.current += 1;
      maritimeControllerRef.current?.abort();
      maritimeControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  useEffect(() => {
    if (!enabledOverlays.precipitationRadar) return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      const source = await fetchRainViewerLatest(controller.signal);
      if (!cancelled && source) setRainViewerSource(source);
    };
    void load();
    const interval = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [enabledOverlays.precipitationRadar]);

  const gridScale: 1 | 5 | 10 | null =
    enabledOverlays.gridScale === "1km"
      ? 1
      : enabledOverlays.gridScale === "5km"
        ? 5
        : enabledOverlays.gridScale === "10km"
          ? 10
          : null;
  const precipitationSource =
    enabledOverlays.precipitationRadar && rainViewerSource ? rainViewerSource : null;
  const gistdaOceanDate = buildGistdaOceanMeta().capturedAt;
  const layers = [
    // ── GISTDA ocean WMS overlays (raster — bottommost so operational layers sit on top) ──
    ...(enabledOverlays.sstAndaman
      ? [createWmsTileLayer({ id: "gistda-sst", baseUrl: GISTDA_OCEAN_WMS_BASE, layers: GISTDA_OCEAN_LAYERS.sst, maxZoom: 10, opacity: 0.72 })]
      : []),
    ...(enabledOverlays.chlAndaman
      ? [createWmsTileLayer({ id: "gistda-chl", baseUrl: GISTDA_OCEAN_WMS_BASE, layers: GISTDA_OCEAN_LAYERS.chl, maxZoom: 10, opacity: 0.68 })]
      : []),
    // ── User-toggleable overlays (above basemap, below operational layers) ──
    ...(enabledOverlays.tambonBoundaries && tambonGeoJson ? [createTambonLayer(tambonGeoJson)] : []),
    ...(precipitationSource ? [createSatelliteTileLayer(precipitationSource)] : []),
    ...(enabledOverlays.waterways ? createWaterwaysLayer(PHUKET_WATERWAYS) : []),
    ...(enabledOverlays.aqiFlag ? createAqiFlagLayers(airQuality) : []),
    ...(enabledOverlays.roadNetwork && roadsData ? createRoadNetworkLayer(roadsData) : []),
    ...(enabledOverlays.canalsDrainage && canalsData ? createCanalsLayer(canalsData) : []),
    ...(enabledOverlays.publicInfrastructure && poiData ? createPoiLayers(poiData) : []),
    ...(enabledOverlays.floodStations && floodStations.length ? createFloodStationLayer(floodStations) : []),
    ...(enabledOverlays.marineConditions && marineStations.length ? createMarineLayer(marineStations) : []),
    // ── Foundation layers (always on) ──
    ...(gridScale !== null ? createKilometerGridLayer(gridScale) : []),
    ...createSeaRoutesLayers(PHUKET_SEA_ROUTES),
    ...createDisasterAlertLayer(disasterAlerts),
    createRainfallLayer(rainfall),
    createIncidentLayer(incidents),
    createFireLayer(fires),
    createRefugeeLayer(refugees),
    ...createPksbRouteLayers(pksbRoutes, pksbStops),
    ...createPksbBusLayers(animatedPksbBuses),
    ...createMaritimeTrafficLayers(animatedMaritimeVessels),
    createPublicCameraLayer(publicCameras),
    ...createTourismHotspotLayer(tourismHotspots),
    ...createTrafficEventLayers(trafficEvents),
    ...(createFlightPathsLayer(flights) ?? []),
  ].filter(Boolean);

  const focusPresets = GOVERNOR_CORRIDORS;


  const handleMapClick = ({ object }: PickingInfo<unknown>) => {
    if (isIncidentFeature(object)) {
      onProvinceSelect?.({
        name: object.properties.location || "Local Sector",
        location: object.properties.location,
        type: object.properties.type,
        notes: object.properties.notes,
        fatalities: object.properties.fatalities,
        eventDate: object.properties.eventDate,
      });
      return;
    }

    if (isPksbStopFeature(object)) {
      onProvinceSelect?.({
        name: object.properties.stopNameEn,
        type: object.properties.routeLabel,
        location: object.properties.stopNameTh,
        notes: `${object.properties.routeDirection}. ${object.properties.direction}. Timetable: ${object.properties.timetable}`,
        externalUrl: object.properties.mapUrl,
        source: "Phuket Smart Bus public tracker",
      });
      return;
    }

    if (isPksbRouteFeature(object)) {
      onProvinceSelect?.({
        name: object.properties.routeLabel,
        type: "Transit corridor",
        notes: object.properties.directionLabel,
        source: "Phuket Smart Bus public tracker",
      });
      return;
    }

    if (isPublicCamera(object)) {
      onProvinceSelect?.({
        name: object.label,
        type:
          object.validationState === "verified"
            ? "Verified camera"
            : "Scout target",
        location: object.locationLabel,
        notes: object.strategicNote,
        externalUrl: object.accessUrl ?? undefined,
        source: `${object.provider} / ${object.focusArea}`,
      });
      return;
    }

    if (isDisasterAlert(object)) {
      onProvinceSelect?.({
        name: object.title,
        type: `Disaster ${object.severity}`,
        location: object.area,
        notes: object.summary,
        eventDate: object.issuedAt,
        externalUrl: object.url,
        source: object.source,
      });
      return;
    }

    if (isMaritimeVessel(object)) {
      onProvinceSelect?.({
        name: object.name,
        type: `${object.type} / ${object.status}`,
        location: object.destination ?? "Andaman corridor",
        notes: object.strategicNote,
        eventDate: object.lastSeen,
        source: object.source,
      });
      return;
    }

    if (isTourismHotspot(object)) {
      onProvinceSelect?.({
        name: object.label,
        type: `Tourism hotspot / ${object.kind}`,
        location: object.area,
        notes: object.summary,
        externalUrl: object.url,
        source: object.source,
      });
    }
  };

  // Basemap is rendered by MapLibre (mapStyle below). DeckGL only carries operator overlays.
  const allLayers = layers.filter(Boolean);

  if (!mounted || !lumaReady) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-raised)] animate-pulse" />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Dark background visible when no basemap tiles loaded yet */}
      <div
        className={`pointer-events-none absolute inset-0 ${fallbackBackgroundClass}`}
        aria-hidden="true"
      />

      {webglSupported ? (
        <div className="absolute inset-0 flex">
          {/* Primary map */}
          <div className={`relative ${is4K ? "flex-[2]" : "flex-1"}`}>
            <DeckGL
              id="phuket-deck"
              viewState={viewState}
              onViewStateChange={handleViewStateChange}
              controller={true}
              layers={allLayers}
              onClick={handleMapClick}
              getTooltip={({ object }: PickingInfo<unknown>) => getTooltipText(object)}
            >
              {hasMapboxBaseMap ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <MapboxMap
                  key={activeBasemap}
                  mapStyle={mapStyle}
                  attributionControl={false}
                  onLoad={handleMapLoad as any}
                />
              ) : (
                <div className="absolute inset-0 bg-[#0c121e]/20 pointer-events-none" />
              )}
            </DeckGL>
            <MapLegend />
          </div>

          {/* Wireframe street map (4K split-view only) */}
          {is4K && (
            <>
              <div className="w-[2px] bg-[var(--line)] z-50 shrink-0" />
              <div className="relative flex-1">
                <DeckGL
                  id="phuket-deck-wireframe"
                  viewState={{ ...viewState, pitch: 0, bearing: 0 }}
                  onViewStateChange={handleWireframeViewStateChange}
                  controller={true}
                  layers={[
                    createRasterTileLayer({
                      id: "wireframe-carto",
                      data: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
                      maxZoom: 19,
                    }),
                    ...createPksbBusLayers(animatedPksbBuses),
                    ...createTrafficEventLayers(trafficEvents),
                    createPublicCameraLayer(publicCameras),
                    ...createMaritimeTrafficLayers(animatedMaritimeVessels),
                  ].flat().filter(Boolean)}
                  getTooltip={({ object }: PickingInfo<unknown>) => getTooltipText(object)}
                />
                {/* Wireframe label */}
                <div className="absolute left-3 top-3 z-50 border border-[var(--line)] bg-[rgba(248,246,240,0.9)] px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                    Street watch
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 px-5 pb-24 pt-24">
          <div className="flex h-full items-center justify-center border border-[var(--line)] bg-[rgba(248,246,240,0.72)] backdrop-blur-sm">
            <div className="w-[min(680px,100%)] border border-[var(--line)] bg-[var(--bg)] p-5">
              <div className="eyebrow">Operational map fallback</div>
              <h3 className="pt-1 text-[20px] font-bold tracking-[-0.04em] text-[var(--ink)]">
                {activeCorridor?.label ?? "Island corridor"} still stays in focus
              </h3>
              <p className="pt-2 text-[12px] leading-5 text-[var(--muted)]">
                This client does not expose WebGL, so the deck.gl map cannot render here.
                The operator workflow is still live through corridor focus, bus and ferry counts,
                road friction, and the airport-to-pier handoff story.
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  { label: "Road events", value: trafficEvents.length },
                  { label: "Weather alerts", value: disasterAlertCount },
                  { label: "Live cameras", value: verifiedCameraCount },
                  { label: "Boat contacts", value: maritimeVesselCount },
                ].map((item) => (
                  <div key={item.label} className="border border-[var(--line)] px-3 py-2">
                    <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                      {item.label}
                    </div>
                    <div className="pt-1 text-[18px] font-mono font-bold text-[var(--ink)]">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="border border-[var(--line)] px-3 py-3">
                  <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                    Focus corridor
                  </div>
                  <div className="pt-1 text-[12px] font-semibold text-[var(--ink)]">
                    {activeCorridor?.label ?? "Phuket island"}
                  </div>
                  <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                    {activeCorridor
                      ? `${activeCorridor.focusAreas.join(", ")} remain available through the governor corridor cards.`
                      : "Island chokepoints remain available through the governor corridor cards."}
                  </div>
                </div>
                <div className="border border-[var(--line)] px-3 py-3">
                  <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                    Operator focus
                  </div>
                  <div className="pt-1 text-[12px] font-semibold text-[var(--ink)]">
                    {BASEMAP_OPTIONS.find((b) => b.id === activeBasemap)?.label ?? "Street"} basemap
                  </div>
                  <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                    The main controls stay limited to corridor focus, basemap choice, and three overlay toggles.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 p-2 sm:p-3 xl:p-4">
        <section
          className="pointer-events-auto max-h-[calc(100%-1rem)] w-full max-w-[620px] overflow-y-auto border border-[rgba(15,23,42,0.16)] bg-[#f1ede2] px-3 py-2 backdrop-blur-md sm:px-4 sm:py-3"
          style={{
            color: "#0d1117",
            ["--ink" as never]: "#0d1117",
            ["--dim" as never]: "#475569",
            ["--muted" as never]: "#1e293b",
            ["--cool" as never]: "#0f6f88",
            ["--line" as never]: "rgba(15,23,42,0.18)",
            ["--line-bright" as never]: "rgba(15,23,42,0.45)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              Phuket operator map
            </div>
            <div className="border border-[rgba(15,111,136,0.24)] bg-[rgba(15,111,136,0.08)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
              {BASEMAP_OPTIONS.find((b) => b.id === activeBasemap)?.label ?? "Street"}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-end gap-2 sm:mt-2 sm:gap-3">
            <h3 className="text-[16px] font-bold tracking-normal text-[var(--ink)] sm:text-[18px]">
              {activeCorridor?.label ?? "Airport to pier corridor"}
            </h3>
            <div className="hidden text-[10px] uppercase tracking-[0.14em] text-[var(--dim)] sm:block">
              {activeCorridor?.focusAreas.join(" / ") ?? "Phuket transfer watch"}
            </div>
          </div>
          <p className="mt-2 hidden max-w-[560px] text-[11px] leading-5 text-[var(--muted)] sm:block">
            Airport arrivals, road friction, bus lift, and ferry handoff stay on one wall so the operator can see where timing breaks first.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2 md:grid-cols-4">
            {[
              {
                label: "Arrivals 60m",
                value: arrivalsNext60Count,
                mode: arrivalsResp?.mode ?? "unavailable",
                title: arrivalsResp
                  ? `${arrivalsResp.totalFlights} scheduled today · ${arrivalsResp.sourceSummary?.label ?? arrivalsResp.source}`
                  : "Awaiting arrivals feed",
              },
              {
                label: "Buses moving",
                value: movingBusCount,
                mode: pksbBusesMode ?? "unavailable",
                title: `PKSB transit · ${pksbBusesMode ?? "no signal"}`,
              },
              {
                label: "Road events",
                value: trafficEvents.length,
                mode: trafficStatus === "ok" || trafficEvents.length > 0 ? "live" : "unavailable",
                title: `Traffic feed · ${trafficStatus || "no signal"}`,
              },
              {
                label: "Boat contacts",
                value: maritimeVesselCount,
                mode: maritimeMode ?? "unavailable",
                title: `Maritime security · ${maritimeMode ?? "no signal"}`,
              },
            ].map((item) => (
              <div
                key={item.label}
                title={item.title}
                className="min-w-0 border border-[rgba(15,111,136,0.18)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5 sm:bg-[rgba(255,255,255,0.58)] sm:px-3 sm:py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[7px] uppercase tracking-[0.12em] text-[var(--dim)] sm:tracking-[0.16em]">
                    {item.label}
                  </div>
                  <span
                    aria-label={`${item.label} data state: ${item.mode}`}
                    className={`h-1.5 w-1.5 rounded-full ${modeDotClass(item.mode as FeedMode | "unavailable")}`}
                  />
                </div>
                <div className="mt-0.5 font-mono text-[16px] font-bold text-[var(--ink)] sm:mt-1 sm:text-[18px]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 hidden flex-wrap items-center gap-1.5 border-t border-[rgba(15,111,136,0.18)] pt-2 sm:flex">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Corridor
            </span>
            {focusPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activeCorridor?.id === preset.id}
                data-control-classification="selects corridor"
                onClick={() => {
                  onCorridorSelect?.(preset.id);
                  setViewState((current) => ({
                    ...current,
                    ...preset.view,
                  }));
                }}
                className={`whitespace-nowrap border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  selectedCorridorId === preset.id
                    ? "border-[var(--ink)] bg-[rgba(17,17,17,0.08)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--dim)] hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-2 hidden flex-wrap items-center gap-1.5 sm:flex">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Basemap
            </span>
            {BASEMAP_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={activeBasemap === option.id}
                data-control-classification="changes view"
                onClick={() => setActiveBasemap(option.id)}
                className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  activeBasemap === option.id
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                }`}
              >
                {option.label}
              </button>
            ))}

            {/* ── 3D toggle — sits inline with basemap row ── */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">View</span>
              <button
                type="button"
                aria-pressed={is3D}
                data-control-classification="changes view"
                onClick={() => {
                  setIs3D((v) => !v);
                  setViewState((prev) =>
                    !is3D && prev.zoom < 13
                      ? { ...prev, zoom: 13, pitch: 65, bearing: -20 }
                      : prev,
                  );
                }}
                title={is3D ? "Switch to 2D flat view" : "Switch to 3D — buildings extrude (auto-zooms to a useful level)"}
                className={`border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition-all duration-300 ${
                  is3D
                    ? "border-[var(--cool)] bg-[var(--cool)] text-white shadow-[0_0_8px_rgba(15,111,136,0.5)]"
                    : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--cool)] hover:text-[var(--cool)]"
                }`}
              >
                {is3D ? "3D" : "2D"}
              </button>
            </div>
          </div>

          <div className="mt-2 hidden flex-wrap items-center gap-1.5 border-t border-[rgba(15,111,136,0.18)] pt-2 sm:flex">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Overlays
            </span>
            {[
              { id: "aqiFlag" as const, label: "AQI" },
              { id: "precipitationRadar" as const, label: "Precipitation" },
              { id: "waterways" as const, label: "Waterways" },
              { id: "roadNetwork" as const, label: "Roads" },
              { id: "canalsDrainage" as const, label: "Canals" },
              { id: "publicInfrastructure" as const, label: "POI" },
              { id: "floodStations" as const, label: "Flood" },
              { id: "marineConditions" as const, label: "Marine" },
              { id: "sstAndaman" as const, label: "Sea Temp" },
              { id: "chlAndaman" as const, label: "Chl-a" },
              { id: "tambonBoundaries" as const, label: "Districts" },
            ].map((toggle) => (
              <button
                key={toggle.id}
                type="button"
                aria-pressed={enabledOverlays[toggle.id]}
                onClick={() =>
                  setEnabledOverlays((prev) => ({
                    ...prev,
                    [toggle.id]: !prev[toggle.id],
                  }))
                }
                className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  enabledOverlays[toggle.id]
                    ? "border-[var(--cool)] bg-[var(--cool)] text-white"
                    : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                }`}
              >
                {toggle.label}
              </button>
            ))}
          </div>

          <div className="mt-2 hidden flex-wrap items-center gap-1.5 border-t border-[rgba(15,23,42,0.18)] pt-2 sm:flex">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Grid
            </span>
            {(["off", "1km", "5km", "10km"] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                aria-pressed={enabledOverlays.gridScale === scale}
                onClick={() =>
                  setEnabledOverlays((prev) => ({ ...prev, gridScale: scale }))
                }
                className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  enabledOverlays.gridScale === scale
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                }`}
              >
                {scale === "off" ? "Off" : scale}
              </button>
            ))}
          </div>

          {precipitationSource && (
            <div className="mt-2 hidden space-y-1 border-t border-[rgba(15,111,136,0.18)] pt-2 sm:block">
              {[precipitationSource]
                .filter((s): s is SatelliteSource => Boolean(s))
                .map((s) => {
                  const tier = satelliteFreshnessTier(s.capturedAt, s.cadence);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                        {s.cadence === "minute" ? "Radar" : "Satellite"}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]"
                        title={s.attribution}
                      >
                        {s.shortLabel}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          tier === "fresh"
                            ? "bg-[#22c55e]"
                            : tier === "acceptable"
                              ? "bg-[#f59e0b]"
                              : "bg-[#ef4444]"
                        }`}
                        aria-label={`${s.shortLabel} freshness: ${tier}`}
                      />
                      <span className="shrink-0 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                        {satelliteFreshnessLabel(s.capturedAt)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </div>

    </div>
  );
}

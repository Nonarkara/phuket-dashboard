"use client";
import { apiUrl } from "../../lib/asset-path";

import {
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
  createAirQualityHeatmapLayers,
  createDisasterAlertLayer,
  createFireLayer,
  createFlightPathsLayer,
  createHeatmapLayer,
  createIncidentLayer,
  createMaritimeTrafficLayers,
  createPksbBusLayers,
  createPksbRouteLayers,
  createPublicCameraLayer,
  createRasterOverlayLayer,
  createRainfallLayer,
  createRefugeeLayer,
  createTrafficEventLayers,
  createTourismHotspotLayer,
} from "../../services/map-engine";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { GOVERNOR_CORRIDORS, findCorridorById } from "../../lib/governor-config";
import {
  buildScenarioUrl,
  fetchJsonOrFallback,
  isAbortError,
} from "../../lib/client-requests";
import { getUsableMapboxToken } from "../../lib/mapbox";
import type {
  AirQualityPoint,
  DisasterAlert,
  DisasterFeedResponse,
  FireEvent,
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

const MapboxMap = dynamic(() => import("react-map-gl/mapbox"), { ssr: false });
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

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 98.334,
  latitude: 7.886,
  zoom: 10,
  pitch: 45,
  bearing: -5,
  minZoom: 5,
  maxZoom: 18,
};

const EMPTY_PKSB_ROUTES = {
  type: "FeatureCollection",
  features: [],
} as const satisfies PksbTransitResponse["routes"];

type BasemapId =
  | "esri-aerial"
  | "eox-sentinel2"
  | "osm-streets"
  | "carto-light"
  | "stadia-dark"
  | "mapbox-satellite"
  | "mapbox-light";

const BASEMAP_FALLBACK_CHAIN: BasemapId[] = [
  "eox-sentinel2",
  "esri-aerial",
  "osm-streets",
  "carto-light",
  "stadia-dark",
];

const BASEMAP_FALLBACK_CHAIN_WITH_MAPBOX: BasemapId[] = [
  "mapbox-light",
  "mapbox-satellite",
  ...BASEMAP_FALLBACK_CHAIN,
];

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

type ViewPreset = "operations" | "safety" | "weather" | "tourism";

type OverlayState = {
  rainfallAnomalies: boolean;
  disasterAlerts: boolean;
  aqiHeatmap: boolean;
  incidentHeatmap: boolean;
  incidentPoints: boolean;
  thermalHotspots: boolean;
  populationMovement: boolean;
  pksbRoutes: boolean;
  pksbLiveBuses: boolean;
  maritimeTraffic: boolean;
  publicCameras: boolean;
  tourismHotspots: boolean;
  trafficEvents: boolean;
  flightPaths: boolean;
};

const PRESET_LAYER_MAP: Record<ViewPreset, OverlayState> = {
  operations: {
    rainfallAnomalies: false,
    disasterAlerts: false,
    aqiHeatmap: false,
    incidentHeatmap: false,
    incidentPoints: false,
    thermalHotspots: false,
    populationMovement: true,
    pksbRoutes: true,
    pksbLiveBuses: true,
    maritimeTraffic: true,
    publicCameras: true,
    tourismHotspots: false,
    trafficEvents: true,
    flightPaths: false,
  },
  safety: {
    rainfallAnomalies: false,
    disasterAlerts: true,
    aqiHeatmap: false,
    incidentHeatmap: false,
    incidentPoints: true,
    thermalHotspots: true,
    populationMovement: false,
    pksbRoutes: true,
    pksbLiveBuses: true,
    maritimeTraffic: false,
    publicCameras: true,
    tourismHotspots: false,
    trafficEvents: true,
    flightPaths: false,
  },
  weather: {
    rainfallAnomalies: true,
    disasterAlerts: true,
    aqiHeatmap: true,
    incidentHeatmap: false,
    incidentPoints: false,
    thermalHotspots: false,
    populationMovement: false,
    pksbRoutes: false,
    pksbLiveBuses: false,
    maritimeTraffic: true,
    publicCameras: false,
    tourismHotspots: false,
    trafficEvents: false,
    flightPaths: false,
  },
  tourism: {
    rainfallAnomalies: false,
    disasterAlerts: false,
    aqiHeatmap: false,
    incidentHeatmap: false,
    incidentPoints: false,
    thermalHotspots: false,
    populationMovement: true,
    pksbRoutes: true,
    pksbLiveBuses: true,
    maritimeTraffic: false,
    publicCameras: true,
    tourismHotspots: true,
    trafficEvents: true,
    flightPaths: true,
  },
};

const LENS_OPTIONS: Array<{
  id: ViewPreset;
  label: string;
  description: string;
}> = [
  {
    id: "operations",
    label: "Operations",
    description: "Airport transfers, buses, roads, and pier lift.",
  },
  {
    id: "safety",
    label: "Safety",
    description: "Incidents, alerts, cameras, and thermal pressure.",
  },
  {
    id: "weather",
    label: "Weather",
    description: "Rain load, air quality, sea state, and warnings.",
  },
  {
    id: "tourism",
    label: "Tourism",
    description: "Visitor flow, flights, hotspots, and movement load.",
  },
];

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

function getTooltipText(object: unknown): string | null {
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

  // ─── Basemap: exactly one active at a time (radio) ───
  const hasMapbox = MAPBOX_TOKEN.length > 0;
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>(
    hasMapbox ? "mapbox-light" : "osm-streets",
  );

  const [activePreset, setActivePreset] = useState<ViewPreset>("operations");

  const applyPreset = (preset: ViewPreset) => {
    setActivePreset(preset);
    setEnabledOverlays({ ...PRESET_LAYER_MAP[preset] });
  };

  const [incidents, setIncidents] = useState<IncidentFeature[]>([]);
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [refugees, setRefugees] = useState<RefugeeMovement[]>([]);
  const [rainfall, setRainfall] = useState<RainfallPoint[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityPoint[]>([]);
  const [flights, setFlights] = useState<FlightData[]>([]);
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
    ...PRESET_LAYER_MAP.operations,
  }));
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
  const verifiedCameraCount = publicCameras.filter(
    (camera) => camera.operationalState === "live" || camera.operationalState === "reachable",
  ).length;
  const hasMapboxBaseMap = hasMapbox && (activeBasemap === "mapbox-satellite" || activeBasemap === "mapbox-light");
  const activeCorridor = selectedCorridorId
    ? findCorridorById(selectedCorridorId)
    : GOVERNOR_CORRIDORS[0];
  const mapStyle = activeBasemap === "mapbox-light"
    ? "mapbox://styles/mapbox/light-v11"
    : "mapbox://styles/mapbox/satellite-streets-v12";
  const fallbackBackgroundClass =
    "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),_rgba(8,20,34,0.95)_62%)]";
  const activeLens = LENS_OPTIONS.find((option) => option.id === activePreset);
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
      const flightData = await fetchJsonOrFallback<FlightData[]>(
        buildScenarioUrl("/api/flights", scenarioId),
        [],
        { signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== flightRequestIdRef.current) {
        return;
      }

      setFlights(Array.isArray(flightData) ? flightData : []);
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
      setMaritimeFrameStartedAt(Date.now());
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const handleViewStateChange = ({
    viewState: nextViewState,
  }: ViewStateChangeParameters<MapViewState>) => {
    setViewState(nextViewState);
  };

  const handleWireframeViewStateChange = ({
    viewState: nextViewState,
  }: ViewStateChangeParameters<MapViewState>) => {
    setViewState((prev) => ({
      ...prev,
      longitude: nextViewState.longitude,
      latitude: nextViewState.latitude,
      zoom: nextViewState.zoom,
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

  const layers = [
    enabledOverlays.rainfallAnomalies && createRainfallLayer(rainfall),
    ...(enabledOverlays.disasterAlerts
      ? createDisasterAlertLayer(disasterAlerts)
      : []),
    ...(enabledOverlays.aqiHeatmap
      ? createAirQualityHeatmapLayers(airQuality, "aqi")
      : []),
    enabledOverlays.incidentHeatmap
      ? createHeatmapLayer(incidents)
      : enabledOverlays.incidentPoints
        ? createIncidentLayer(incidents)
        : null,
    enabledOverlays.thermalHotspots ? createFireLayer(fires) : null,
    enabledOverlays.populationMovement ? createRefugeeLayer(refugees) : null,
    ...(enabledOverlays.pksbRoutes
      ? createPksbRouteLayers(pksbRoutes, pksbStops)
      : []),
    ...(enabledOverlays.pksbLiveBuses
      ? createPksbBusLayers(animatedPksbBuses)
      : []),
    ...(enabledOverlays.maritimeTraffic
      ? createMaritimeTrafficLayers(animatedMaritimeVessels)
      : []),
    enabledOverlays.publicCameras
      ? createPublicCameraLayer(publicCameras)
      : null,
    ...(enabledOverlays.tourismHotspots
      ? createTourismHotspotLayer(tourismHotspots)
      : []),
    ...(enabledOverlays.trafficEvents
      ? createTrafficEventLayers(trafficEvents)
      : []),
    ...(enabledOverlays.flightPaths ? (createFlightPathsLayer(flights) ?? []) : []),
  ].filter(Boolean);

  const focusPresets = GOVERNOR_CORRIDORS;

  const [, setBasemapErrorCount] = useState(0);
  const basemapFallbackChain = hasMapbox
    ? BASEMAP_FALLBACK_CHAIN_WITH_MAPBOX
    : BASEMAP_FALLBACK_CHAIN;

  const basemapChoice =
    activeBasemap === "esri-aerial" ||
    activeBasemap === "eox-sentinel2" ||
    activeBasemap === "mapbox-satellite"
      ? "aerial"
      : "map";

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

  // ─── Basemap tile layer (exactly one, sits at the bottom) ───
  const handleBasemapTileError = () => {
    setBasemapErrorCount((count) => {
      const nextCount = count + 1;
      if (nextCount < 3) {
        return nextCount;
      }

      const currentIdx = basemapFallbackChain.indexOf(activeBasemap);
      const nextIdx = (currentIdx + 1) % basemapFallbackChain.length;
      setActiveBasemap(basemapFallbackChain[nextIdx]);
      return 0;
    });
  };

  const makeBasemapLayer = (id: string, label: string, tileTemplate: string, maxZoom: number) =>
    createRasterOverlayLayer(
      {
        id, label, shortLabel: label, description: label, source: label,
        family: "imagery", role: "base-option", kind: "raster" as const,
        defaultOpacity: 1, enabledByDefault: true, maxZoom, tileTemplate,
        updatedAt: new Date().toISOString(),
      },
      1,
      handleBasemapTileError,
    );

  const basemapTileLayer = (() => {
    if (activeBasemap === "eox-sentinel2") {
      return makeBasemapLayer("basemap-eox", "EOX Sentinel-2 Cloudless",
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg", 15);
    }
    if (activeBasemap === "esri-aerial") {
      return makeBasemapLayer("basemap-esri", "ESRI Aerial",
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 19);
    }
    if (activeBasemap === "osm-streets") {
      return makeBasemapLayer("basemap-osm", "OpenStreetMap",
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png", 19);
    }
    if (activeBasemap === "carto-light") {
      return makeBasemapLayer("basemap-carto", "CartoDB Positron",
        "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", 19);
    }
    if (activeBasemap === "stadia-dark") {
      return makeBasemapLayer("basemap-stadia", "Stadia Dark",
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png", 20);
    }
    // mapbox-satellite and mapbox-light are handled by the MapboxMap component
    return null;
  })();

  // Basemap tile goes first, then the operator overlays
  const allLayers = [basemapTileLayer, ...layers].filter(Boolean);

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
                <MapboxMap
                  mapboxAccessToken={MAPBOX_TOKEN}
                  mapStyle={mapStyle}
                  reuseMaps
                  attributionControl={false}
                />
              ) : (
                <div className="absolute inset-0 bg-[#0c121e]/20 pointer-events-none" />
              )}
            </DeckGL>
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
                    makeBasemapLayer("wireframe-carto", "CartoDB Positron",
                      "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", 19),
                    ...(enabledOverlays.pksbLiveBuses
                      ? createPksbBusLayers(animatedPksbBuses)
                      : []),
                    enabledOverlays.trafficEvents ? createTrafficEventLayers(trafficEvents) : null,
                    enabledOverlays.publicCameras ? createPublicCameraLayer(publicCameras) : null,
                    ...(enabledOverlays.maritimeTraffic
                      ? createMaritimeTrafficLayers(animatedMaritimeVessels)
                      : []),
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
                    {activeLens?.label ?? "Operations"} lens active
                  </div>
                  <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                    The main controls stay limited to corridor focus, lens selection, and basemap choice.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 p-3 xl:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <section className="pointer-events-auto w-full max-w-[620px] border border-[rgba(255,255,255,0.2)] bg-[linear-gradient(135deg,rgba(248,246,240,0.94),rgba(233,244,240,0.84))] px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                  Phuket operator map
                </div>
                <div className="border border-[rgba(15,111,136,0.24)] bg-[rgba(15,111,136,0.08)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
                  {activeLens?.label ?? "Operations"} lens
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h3 className="text-[18px] font-bold tracking-[-0.04em] text-[var(--ink)]">
                  {activeCorridor?.label ?? "Airport to pier corridor"}
                </h3>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--dim)]">
                  {activeCorridor?.focusAreas.join(" / ") ?? "Phuket transfer watch"}
                </div>
              </div>
              <p className="mt-2 max-w-[560px] text-[11px] leading-5 text-[var(--muted)]">
                Airport arrivals, road friction, bus lift, and ferry handoff stay on one wall so the operator can see where timing breaks first.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Flights inbound", value: flights.length },
                  { label: "Buses moving", value: movingBusCount },
                  { label: "Road events", value: trafficEvents.length },
                  { label: "Boat contacts", value: maritimeVesselCount },
                ].map((item) => (
                  <div key={item.label} className="border border-[rgba(15,111,136,0.18)] bg-[rgba(255,255,255,0.58)] px-3 py-2">
                    <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
                      {item.label}
                    </div>
                    <div className="mt-1 text-[18px] font-mono font-bold text-[var(--ink)]">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pointer-events-auto border border-[rgba(255,255,255,0.2)] bg-[rgba(248,246,240,0.9)] px-3 py-3 backdrop-blur-md">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                Basemap
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  aria-pressed={basemapChoice === "map"}
                  data-control-classification="changes view"
                  onClick={() => setActiveBasemap(hasMapbox ? "mapbox-light" : "osm-streets")}
                  className={`border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    basemapChoice === "map"
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                  }`}
                >
                  Map
                </button>
                <button
                  type="button"
                  aria-pressed={basemapChoice === "aerial"}
                  data-control-classification="changes view"
                  onClick={() =>
                    setActiveBasemap(hasMapbox ? "mapbox-satellite" : "esri-aerial")
                  }
                  className={`border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    basemapChoice === "aerial"
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                  }`}
                >
                  Aerial
                </button>
              </div>
            </section>
          </div>

          <section className="pointer-events-none border border-[rgba(255,255,255,0.16)] bg-[rgba(248,246,240,0.86)] px-3 py-2 backdrop-blur-md">
            <div className="pointer-events-none flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="pointer-events-none shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                Corridor
              </div>
              <div className="pointer-events-auto no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto xl:justify-end">
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
                    className={`whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      selectedCorridorId === preset.id
                        ? "border-[var(--ink)] bg-[rgba(17,17,17,0.08)] text-[var(--ink)]"
                        : "border-[var(--line)] text-[var(--dim)] hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
                    } relative z-10`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 p-3 xl:p-4">
        <section className="pointer-events-none border border-[rgba(255,255,255,0.16)] bg-[rgba(248,246,240,0.9)] px-3 py-3 backdrop-blur-md">
          <div className="pointer-events-none flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <div className="pointer-events-none text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                Lens
              </div>
              {LENS_OPTIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  data-control-classification="changes view"
                  onClick={() => applyPreset(preset.id)}
                  className={`border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    activePreset === preset.id
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                  } relative z-10`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="max-w-[420px] text-[10px] leading-4 text-[var(--muted)] xl:text-right">
              {activeLens?.description ?? "Operator lens active."}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

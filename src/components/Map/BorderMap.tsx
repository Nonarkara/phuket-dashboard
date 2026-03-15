"use client";

import { useEffect, useState } from "react";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import dynamic from "next/dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DeckGL = dynamic(() => (import("@deck.gl/react") as any).then((m: any) => m.default || m.DeckGL), { ssr: false }) as any;
import {
  BusFront,
  Camera,
  CloudRain,
  Droplets,
  Flame,
  Globe,
  Grid3x3,
  Layers,
  Map as MapIcon,
  MapPinned,
  MoonStar,
  Plane,
  Satellite,
  Snowflake,
  Tag,
  Thermometer,
  Users,
  Waves,
  Wind,
} from "lucide-react";
import {
  createAirQualityHeatmapLayers,
  createConflictZonesLayer,
  createDisasterAlertLayer,
  createFireLayer,
  createFlightPathsLayer,
  createHeatmapLayer,
  createIncidentLayer,
  createKilometerGridLayer,
  createMaritimeTrafficLayers,
  createPksbRouteLayers,
  createPublicCameraLayer,
  createProvinceLabelsLayer,
  createRainfallLayer,
  createRasterOverlayLayer,
  createRefugeeLayer,
  createRegionalBorderLayer,
  createTourismHotspotLayer,
} from "../../services/map-engine";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { GOVERNOR_CORRIDORS, findCorridorById } from "../../lib/governor-config";
import { getUsableMapboxToken } from "../../lib/mapbox";
import { buildMapOverlayCatalog } from "../../lib/map-overlays";
import type {
  AirQualityPoint,
  ConflictZoneCollection,
  ConflictZoneFeature,
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
  RegionBorderCollection,
  RegionBorderFeature,
  PksbRouteFeature,
  PksbStopFeature,
  PksbTransitResponse,
  PublicCamera,
  PublicCameraResponse,
  TourismHotspot,
  TourismHotspotsResponse,
} from "../../types/dashboard";

const MapboxMap = dynamic(() => import("react-map-gl/mapbox"), { ssr: false });
const MAPBOX_TOKEN = getUsableMapboxToken(
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
);

// Register WebGL adapter for deck.gl v9
luma.registerAdapters([webgl2Adapter]);

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 98.334,
  latitude: 7.886,
  zoom: 10,
  pitch: 45,
  bearing: -5,
  minZoom: 5,
  maxZoom: 18,
};

const EMPTY_BORDERS: RegionBorderCollection = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_CONFLICT_ZONES: ConflictZoneCollection = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_PKSB_ROUTES = {
  type: "FeatureCollection",
  features: [],
} as const satisfies PksbTransitResponse["routes"];

const EMPTY_PKSB_STOPS = {
  type: "FeatureCollection",
  features: [],
} as const satisfies PksbTransitResponse["stops"];

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId: string = "ui",
) {
  // #region agent log
  fetch("/api/debug/ingest", {
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

function isRegionBorderFeature(value: unknown): value is RegionBorderFeature {
  return (
    isRecord(value) &&
    isRecord(value.properties) &&
    typeof value.properties.NAME_0 === "string"
  );
}

function isConflictZoneFeature(value: unknown): value is ConflictZoneFeature {
  return (
    isRecord(value) &&
    isRecord(value.properties) &&
    typeof value.properties.name === "string" &&
    typeof value.properties.summary === "string" &&
    typeof value.properties.priority === "number"
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

function isTourismHotspot(value: unknown): value is TourismHotspot {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.area === "string" &&
    typeof value.summary === "string"
  );
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return fallback;
    }

    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function getTooltipText(object: unknown): string | null {
  if (isIncidentFeature(object)) {
    return object.properties.notes || object.properties.title;
  }

  if (isRegionBorderFeature(object)) {
    return object.properties.NAME_0 ?? null;
  }

  if (isConflictZoneFeature(object)) {
    return `${object.properties.name}: ${object.properties.summary}`;
  }

  if (isAirQualityPoint(object)) {
    return `${object.label}: AQI ${Math.round(object.aqi)} / PM2.5 ${Math.round(object.pm25)}`;
  }

  if (isPksbStopFeature(object)) {
    return `${object.properties.stopNameEn} • ${object.properties.routeLabel}`;
  }

  if (isPksbRouteFeature(object)) {
    return `${object.properties.routeLabel} • ${object.properties.directionLabel}`;
  }

  if (isPublicCamera(object)) {
    return `${object.label} • ${object.validationState} • ${object.provider}`;
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

  if (hasLabel(object)) {
    return object.label;
  }

  if (isFireEvent(object)) {
    return `Fire Intensity: ${object.brightness}`;
  }

  return null;
}

function formatCompactCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

export default function BorderMap({
  onProvinceSelect,
  selectedCorridorId,
  onCorridorSelect,
}: {
  onProvinceSelect?: (province: ProvinceSelection) => void;
  selectedCorridorId?: string;
  onCorridorSelect?: (corridorId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(true);
  const [satelliteOpacity, setSatelliteOpacity] = useState(62);
  const [isDetailedMap, setIsDetailedMap] = useState(true);
  const [showAerialBasemap, setShowAerialBasemap] = useState(MAPBOX_TOKEN.length === 0);
  const [showStreets, setShowStreets] = useState(MAPBOX_TOKEN.length === 0);

  const [incidents, setIncidents] = useState<IncidentFeature[]>([]);
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [refugees, setRefugees] = useState<RefugeeMovement[]>([]);
  const [rainfall, setRainfall] = useState<RainfallPoint[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityPoint[]>([]);
  const [disasterAlerts, setDisasterAlerts] = useState<DisasterAlert[]>([]);
  const [maritimeVessels, setMaritimeVessels] = useState<MaritimeVessel[]>([]);
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [borders, setBorders] = useState<RegionBorderCollection | null>(null);
  const [conflictZones, setConflictZones] =
    useState<ConflictZoneCollection>(EMPTY_CONFLICT_ZONES);
  const [pksbRoutes, setPksbRoutes] =
    useState<PksbTransitResponse["routes"]>(EMPTY_PKSB_ROUTES);
  const [pksbStops, setPksbStops] =
    useState<PksbTransitResponse["stops"]>(EMPTY_PKSB_STOPS);
  const [publicCameras, setPublicCameras] = useState<PublicCamera[]>([]);
  const [tourismHotspots, setTourismHotspots] = useState<TourismHotspot[]>([]);

  const getSafeDate = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const safeDate = getSafeDate();
  const overlayCatalog = buildMapOverlayCatalog(safeDate);
  const baseOverlays = overlayCatalog.overlays.filter(
    (overlay) => overlay.role === "base-option",
  );
  const additionalOverlays = overlayCatalog.overlays.filter(
    (overlay) => overlay.role !== "base-option",
  );
  const [satelliteOverlay, setSatelliteOverlay] = useState<string>(
    overlayCatalog.defaultImageryOverlayId,
  );
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(
    () =>
      overlayCatalog.overlays.reduce<Record<string, boolean>>((memo, overlay) => {
        memo[overlay.id] = overlay.enabledByDefault;
        return memo;
      }, {}),
  );
  const activeSatelliteOverlay =
    baseOverlays.find((overlay) => overlay.id === satelliteOverlay) ??
    baseOverlays[0];
  const signalCount = incidents.length;
  const hotspotCount = fires.length;
  const rainCount = rainfall.length;
  const busStopCount = pksbStops.features.length;
  const cameraCount = publicCameras.length;
  const disasterAlertCount = disasterAlerts.length;
  const maritimeVesselCount = maritimeVessels.length;
  const verifiedCameraCount = publicCameras.filter(
    (camera) => camera.validationState === "verified",
  ).length;
  const tourismHotspotCount = tourismHotspots.length;
  const hasMapboxBaseMap = MAPBOX_TOKEN.length > 0;
  const totalActiveLayers = Object.entries(enabledOverlays).filter(
    ([, active]) => active,
  ).length;
  const activeCorridor = selectedCorridorId
    ? findCorridorById(selectedCorridorId)
    : GOVERNOR_CORRIDORS[0];
  const mapStyle = isDetailedMap
    ? "mapbox://styles/mapbox/satellite-streets-v12"
    : "mapbox://styles/mapbox/light-v11";
  const fallbackBackgroundClass = isDetailedMap
    ? "bg-[radial-gradient(circle_at_top,_var(--line-bright),_var(--bg)_52%),linear-gradient(180deg,_var(--bg)_0%,_var(--bg-surface)_100%)]"
    : "bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.08),_rgba(10,15,26,0.98)_42%),linear-gradient(180deg,_rgba(4,8,15,1)_0%,_rgba(2,6,12,1)_100%)]";

  const provinceLabelsLayer = enabledOverlays.provinceLabels
    ? createProvinceLabelsLayer()
    : null;

  const satelliteLayer =
    showSatelliteOverlay && activeSatelliteOverlay
      ? createRasterOverlayLayer(activeSatelliteOverlay, satelliteOpacity / 100)
      : null;

  const selectedAdditionalOverlays = additionalOverlays.filter(
    (overlay) => enabledOverlays[overlay.id],
  );
  const rasterAnalyticLayers = selectedAdditionalOverlays
    .filter((overlay) => overlay.kind === "raster")
    .map((overlay) => createRasterOverlayLayer(overlay, overlay.defaultOpacity))
    .filter(Boolean);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const hasWebgl =
      Boolean(canvas.getContext("webgl2")) || Boolean(canvas.getContext("webgl"));

    setWebglSupported(hasWebgl);
    setMounted(true);
    debugLog("H1", "BorderMap.tsx:useEffect", "mounted effect ran", {
      safeDate,
      hasMapboxToken: MAPBOX_TOKEN.length > 0,
      baseOverlayCount: baseOverlays.length,
      hasWebgl,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCorridorId) {
      return;
    }

    const corridor = findCorridorById(selectedCorridorId);
    if (!corridor) {
      return;
    }

    setViewState((current) => ({
      ...current,
      ...corridor.view,
    }));
  }, [selectedCorridorId]);

  useEffect(() => {
    const loadData = async () => {
      const [
        incidentData,
        fireData,
        refugeeData,
        rainfallData,
        airQualityData,
        disasterData,
        maritimeData,
        borderData,
        conflictZoneData,
        flightData,
        pksbTransitData,
        publicCameraData,
        tourismHotspotData,
      ] = await Promise.all([
        fetchJson<IncidentFeature[]>("/api/incidents", []),
        fetchJson<FireEvent[]>("/api/fires", []),
        fetchJson<RefugeeMovement[]>("/api/movements", []),
        fetchJson<RainfallPoint[]>("/api/rainfall", []),
        fetchJson<AirQualityPoint[]>("/api/air-quality", []),
        fetchJson<DisasterFeedResponse>("/api/disaster/brief", {
          generatedAt: new Date(0).toISOString(),
          posture: "watch",
          summary: "",
          alerts: [],
          layers: [],
          rainfallNodes: 0,
          sources: [],
        }),
        fetchJson<MaritimeSecurityResponse>("/api/maritime/security", {
          generatedAt: new Date(0).toISOString(),
          posture: "watch",
          summary: "",
          provider: "",
          vessels: [],
          chokepoints: [],
          sources: [],
        }),
        fetchJson<RegionBorderCollection>("/data/region_borders.geojson", EMPTY_BORDERS),
        fetchJson<ConflictZoneCollection>("/data/conflict_zones.geojson", EMPTY_CONFLICT_ZONES),
        fetchJson<FlightData[]>("/api/flights", []),
        fetchJson<PksbTransitResponse>("/api/transit/pksb", {
          generatedAt: new Date(0).toISOString(),
          source: [],
          routes: EMPTY_PKSB_ROUTES,
          stops: EMPTY_PKSB_STOPS,
        }),
        fetchJson<PublicCameraResponse>("/api/public-cameras", {
          generatedAt: new Date(0).toISOString(),
          source: [],
          cameras: [],
          scoutTargets: [],
        }),
        fetchJson<TourismHotspotsResponse>("/api/tourism/hotspots", {
          generatedAt: new Date(0).toISOString(),
          summary: "",
          provider: "",
          hotspots: [],
          sources: [],
        }),
      ]);

      setIncidents(Array.isArray(incidentData) ? incidentData : []);
      setFires(Array.isArray(fireData) ? fireData : []);
      setRefugees(Array.isArray(refugeeData) ? refugeeData : []);
      setRainfall(Array.isArray(rainfallData) ? rainfallData : []);
      setAirQuality(Array.isArray(airQualityData) ? airQualityData : []);
      setDisasterAlerts(Array.isArray(disasterData.alerts) ? disasterData.alerts : []);
      setMaritimeVessels(Array.isArray(maritimeData.vessels) ? maritimeData.vessels : []);
      setFlights(Array.isArray(flightData) ? flightData : []);
      setBorders(borderData);
      setConflictZones(conflictZoneData);
      setPksbRoutes(pksbTransitData.routes);
      setPksbStops(pksbTransitData.stops);
      setPublicCameras(publicCameraData.cameras);
      setTourismHotspots(
        Array.isArray(tourismHotspotData.hotspots) ? tourismHotspotData.hotspots : [],
      );
    };

    loadData();

    // Refresh map data every 2 minutes
    const mapDataInterval = setInterval(loadData, 2 * 60 * 1000);

    // Refresh flight data every 30 seconds
    const flightInterval = setInterval(async () => {
      const flightData = await fetchJson<FlightData[]>("/api/flights", []);
      setFlights(Array.isArray(flightData) ? flightData : []);
    }, 30000);

    return () => {
      clearInterval(mapDataInterval);
      clearInterval(flightInterval);
    };
  }, []);

  const layers = [
    satelliteLayer,
    ...rasterAnalyticLayers,
    enabledOverlays.borderContext && borders && createRegionalBorderLayer(borders),
    enabledOverlays.conflictZones && createConflictZonesLayer(conflictZones),
    enabledOverlays.rainfallAnomalies && createRainfallLayer(rainfall),
    ...(enabledOverlays.disasterAlerts
      ? createDisasterAlertLayer(disasterAlerts)
      : []),
    ...(enabledOverlays.aqiHeatmap
      ? createAirQualityHeatmapLayers(airQuality, "aqi")
      : []),
    ...(enabledOverlays.pm25Heatmap
      ? createAirQualityHeatmapLayers(airQuality, "pm25")
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
    ...(enabledOverlays.maritimeTraffic
      ? createMaritimeTrafficLayers(maritimeVessels)
      : []),
    enabledOverlays.publicCameras
      ? createPublicCameraLayer(publicCameras)
      : null,
    ...(enabledOverlays.tourismHotspots
      ? createTourismHotspotLayer(tourismHotspots)
      : []),
    ...(enabledOverlays.flightPaths ? (createFlightPathsLayer(flights) ?? []) : []),
    ...(enabledOverlays.kmGrid ? createKilometerGridLayer() : []),
    provinceLabelsLayer,
  ].filter(Boolean);

  const analyticControls = additionalOverlays.filter(
    (overlay) => overlay.role === "analytic",
  );
  const operationalControls = additionalOverlays.filter(
    (overlay) => overlay.role === "operational",
  );
  const focusPresets = GOVERNOR_CORRIDORS;
  const mapModeControls = [
    {
      id: "satellite-overlay",
      active: showSatelliteOverlay,
      label: "NASA overlay",
      icon: Globe,
      onClick: () => setShowSatelliteOverlay((value) => !value),
    },
    {
      id: "aerial-base",
      active: showAerialBasemap,
      label: "ESRI aerial",
      icon: Satellite,
      onClick: () => setShowAerialBasemap((value) => !value),
    },
    {
      id: "roads-base",
      active: showStreets,
      label: "OSM roads",
      icon: MapPinned,
      onClick: () => setShowStreets((value) => !value),
    },
    {
      id: "detail-base",
      active: isDetailedMap,
      label: "Detailed map",
      icon: MapIcon,
      onClick: () => setIsDetailedMap((value) => !value),
    },
    {
      id: "night-lights",
      active: enabledOverlays.nightLights,
      label: "Night lights",
      icon: MoonStar,
      onClick: () => toggleOverlay("nightLights"),
    },
  ] as const;
  const layerControls = [
    ...analyticControls.map((overlay) => ({
      id: overlay.id,
      active: enabledOverlays[overlay.id],
      label: overlay.label,
      detail:
        overlay.id === "thermalHotspots"
          ? `${formatCompactCount(hotspotCount)} hotspots`
          : overlay.id === "aqiHeatmap" || overlay.id === "pm25Heatmap"
            ? `${formatCompactCount(airQuality.length)} stations`
            : overlay.id === "rainfallAnomalies"
              ? `${formatCompactCount(rainCount)} rain nodes`
              : overlay.shortLabel,
      icon:
        overlay.family === "weather"
          ? CloudRain
          : overlay.family === "air"
            ? Wind
            : overlay.family === "thermal"
              ? Flame
              : overlay.family === "lights"
                ? MoonStar
                : Layers,
      onClick: () => toggleOverlay(overlay.id),
    })),
    ...operationalControls.map((overlay) => ({
      id: overlay.id,
      active: enabledOverlays[overlay.id],
      label: overlay.label,
      detail:
        overlay.id === "conflictZones"
          ? `${formatCompactCount(conflictZones.features.length)} zones`
          : overlay.id === "disasterAlerts"
            ? `${formatCompactCount(disasterAlertCount)} alerts`
            : overlay.id === "maritimeTraffic"
              ? `${formatCompactCount(maritimeVesselCount)} vessels`
              : overlay.id === "tourismHotspots"
                ? `${formatCompactCount(tourismHotspotCount)} hotspots`
          : overlay.id === "populationMovement"
            ? `${formatCompactCount(refugees.length)} flows`
            : overlay.id === "pksbRoutes"
              ? `${formatCompactCount(busStopCount)} stops`
              : overlay.id === "publicCameras"
                ? `${formatCompactCount(cameraCount)} cams`
            : overlay.id === "incidentHeatmap" || overlay.id === "incidentPoints"
              ? `${formatCompactCount(signalCount)} signals`
              : overlay.id === "provinceLabels"
                ? "Province index"
                : overlay.id === "flightPaths"
                  ? `${formatCompactCount(flights.length)} aircraft`
                  : overlay.shortLabel,
      icon:
        overlay.id === "disasterAlerts"
          ? CloudRain
          : overlay.id === "maritimeTraffic"
            ? Waves
            : overlay.id === "tourismHotspots"
              ? MapPinned
        : overlay.id === "populationMovement"
          ? Users
          : overlay.id === "pksbRoutes"
            ? BusFront
            : overlay.id === "publicCameras"
              ? Camera
          : overlay.id === "conflictZones"
            ? MapPinned
            : overlay.id === "rainfallAnomalies"
              ? CloudRain
              : overlay.id === "provinceLabels"
                ? Tag
                : overlay.id === "flightPaths"
                  ? Plane
                  : overlay.id === "kmGrid"
                    ? Grid3x3
                    : overlay.id === "seaSurfaceTemp"
                      ? Waves
                      : overlay.id === "soilMoisture"
                        ? Droplets
                        : overlay.id === "cloudTop"
                          ? Snowflake
                          : overlay.id === "bhuvanLandUse"
                            ? Thermometer
                            : Layers,
      onClick: () => toggleOverlay(overlay.id),
    })),
  ];

  const toggleOverlay = (overlayId: string) => {
    setEnabledOverlays((current) => ({
      ...current,
      [overlayId]: !current[overlayId],
    }));
  };

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

    if (isRegionBorderFeature(object)) {
      onProvinceSelect?.({
        name: object.properties.NAME_0 ?? "Regional Sector",
        iso: object.properties.ISO_A3 || object.properties.ADM0_A3,
      });
      return;
    }

    if (isConflictZoneFeature(object)) {
      onProvinceSelect?.({
        name: object.properties.name,
        type: "Focus zone",
        notes: object.properties.summary,
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

  // When aerial basemap is on, use ESRI World Imagery tiles (free, no token needed)
  const aerialLayer = showAerialBasemap
    ? createRasterOverlayLayer(
        {
          id: "esri-aerial",
          label: "ESRI Aerial",
          shortLabel: "AERIAL",
          description: "High-resolution aerial imagery",
          source: "ESRI",
          family: "imagery",
          role: "base-option",
          kind: "raster" as const,
          defaultOpacity: 1,
          enabledByDefault: false,
          maxZoom: 19,
          tileTemplate:
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          updatedAt: new Date().toISOString(),
        },
        1,
      )
    : null;

  // OpenStreetMap streets/roads layer (free, no token needed)
  const streetsLayer = showStreets
    ? createRasterOverlayLayer(
        {
          id: "osm-streets",
          label: "OpenStreetMap",
          shortLabel: "OSM",
          description: "Street-level roads and infrastructure",
          source: "OpenStreetMap",
          family: "imagery",
          role: "base-option",
          kind: "raster" as const,
          defaultOpacity: 0.85,
          enabledByDefault: false,
          maxZoom: 19,
          tileTemplate:
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          updatedAt: new Date().toISOString(),
        },
        0.85,
      )
    : null;

  // Prepend basemap layers so they sit below all other layers
  const allLayers = [aerialLayer, streetsLayer, ...layers].filter(Boolean);

  if (!mounted) {
    debugLog("H2", "BorderMap.tsx:render", "rendered not-mounted placeholder", {
      mounted,
    });
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-raised)] animate-pulse" />
    );
  }

  debugLog("H3", "BorderMap.tsx:render", "rendered mounted map UI", {
    mounted,
    showSatelliteOverlay,
    satelliteOverlay,
    hasMapboxToken: MAPBOX_TOKEN.length > 0,
    webglSupported,
  });

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {!hasMapboxBaseMap && (
        <div
          className={`absolute inset-0 ${fallbackBackgroundClass}`}
          aria-hidden="true"
        />
      )}

      {webglSupported ? (
        <DeckGL
          id="phuket-deck"
          viewState={viewState}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onViewStateChange={({ viewState: nextViewState }: { viewState: any }) => {
            const next = nextViewState as MapViewState;
            setViewState(next);
          }}
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
      ) : (
        <div className="absolute inset-0 px-5 pb-24 pt-24">
          <div className="flex h-full items-center justify-center border border-[var(--line)] bg-[rgba(248,246,240,0.72)] backdrop-blur-sm">
            <div className="w-[min(680px,100%)] border border-[var(--line)] bg-[var(--bg)] p-5">
              <div className="eyebrow">Operational map fallback</div>
              <h3 className="pt-1 text-[20px] font-bold tracking-[-0.04em] text-[var(--ink)]">
                {activeCorridor?.label ?? "Island corridor"} still stays in focus
              </h3>
              <p className="pt-2 text-[12px] leading-5 text-[var(--muted)]">
                This client does not expose WebGL, so the deck.gl map cannot render here.
                The governor workflow stays live on internal APIs, corridor selection, cameras,
                flights, overlays, and satellite configuration.
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  { label: "Signals", value: signalCount },
                  { label: "Alerts", value: disasterAlertCount },
                  { label: "Verified cams", value: verifiedCameraCount },
                  { label: "AIS", value: maritimeVesselCount },
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
                    Overlay posture
                  </div>
                  <div className="pt-1 text-[12px] font-semibold text-[var(--ink)]">
                    {totalActiveLayers} layers configured
                  </div>
                  <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                    Satellite, disaster alerts, AIS, tourism hotspots, flights, rainfall,
                    and camera overlays stay operational when WebGL is available on the client.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {enabledOverlays.kmGrid && (
        <div className="pointer-events-none absolute bottom-14 right-3 z-30 border border-[rgba(15,111,136,0.25)] bg-[rgba(248,246,240,0.88)] px-2.5 py-1.5 backdrop-blur-sm xl:right-4 xl:bottom-16">
          <div className="text-[8px] font-mono font-bold uppercase tracking-[0.24em] text-[var(--cool)]">
            Distance Grid
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
            1 x 1 km
          </div>
          <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-[var(--dim)]">
            Major lines every 5 km
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[rgba(248,246,240,0.85)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1.5 xl:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-bold tracking-tight text-[var(--ink)] uppercase">Island chokepoints</div>
              <div className="h-3 w-[1px] bg-[var(--line)]" />
              <div className="flex gap-3 text-[9px] font-mono font-bold text-[var(--dim)] uppercase tracking-tight">
                <span>SIG {signalCount}</span>
                <span>ALR {disasterAlertCount}</span>
                <span>AIS {maritimeVesselCount}</span>
                <span>VER {verifiedCameraCount}</span>
                <span>FLT {flights.length}</span>
                <span>LYR {totalActiveLayers}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 border-r border-[var(--line)] pr-2 mr-1">
              <span className="live-badge text-[8px] px-1" title="NASA GIBS latest imagery">LIVE</span>
              {baseOverlays.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={satelliteOverlay === option.id}
                  onClick={() => setSatelliteOverlay(option.id)}
                  className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    satelliteOverlay === option.id
                      ? "text-[var(--ink)] underline underline-offset-4"
                      : "text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
            {mapModeControls.slice(0, 3).map((control) => {
              const Icon = control.icon;
              return (
                <button
                  key={control.id}
                  type="button"
                  aria-pressed={control.active}
                  onClick={control.onClick}
                  className={`inline-flex h-7 items-center gap-1.5 border px-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    control.active
                      ? "border-[var(--cool)] bg-[rgba(15,111,136,0.06)] text-[var(--cool)]"
                      : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={11} />
                  {control.label.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--line)] px-3 py-1.5 xl:px-4">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {focusPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onCorridorSelect?.(preset.id);
                  setViewState((current) => ({
                    ...current,
                    ...preset.view,
                  }));
                }}
                className={`whitespace-nowrap rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  selectedCorridorId === preset.id
                    ? "border-[var(--ink)] bg-[rgba(17,17,17,0.05)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--dim)] hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 min-w-[140px] ${showSatelliteOverlay ? "opacity-100" : "opacity-40"}`}>
            <span className="text-[9px] font-mono text-[var(--dim)] shrink-0">VIS {satelliteOpacity}%</span>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={satelliteOpacity}
              disabled={!showSatelliteOverlay}
              onChange={(event) => setSatelliteOpacity(Number(event.target.value))}
              className="w-full h-1 bg-[var(--line)] rounded-full appearance-none accent-[var(--cool)] cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(248,246,240,0.85)] backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-1.5 xl:px-4">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {layerControls.map((control) => {
              const Icon = control.icon;
              return (
                <button
                  key={control.id}
                  type="button"
                  aria-pressed={control.active}
                  onClick={control.onClick}
                  className={`border whitespace-nowrap px-2 py-1 transition-colors ${
                    control.active
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-bright)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={10} className="shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      {control.label.split(" ")[0]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

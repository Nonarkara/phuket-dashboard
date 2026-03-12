"use client";

import { useEffect, useState } from "react";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import dynamic from "next/dynamic";
const DeckGL = dynamic(() => (import("@deck.gl/react") as any).then((m: any) => m.default || m.DeckGL), { ssr: false }) as any;
import {
  CloudRain,
  Flame,
  Globe,
  Layers,
  Map as MapIcon,
  MapPinned,
  MoonStar,
  Plane,
  Satellite,
  Tag,
  Users,
  Wind,
} from "lucide-react";
import {
  createAirQualityHeatmapLayers,
  createConflictZonesLayer,
  createFireLayer,
  createFlightPathsLayer,
  createHeatmapLayer,
  createIncidentLayer,
  createProvinceLabelsLayer,
  createRainfallLayer,
  createRasterOverlayLayer,
  createRefugeeLayer,
  createRegionalBorderLayer,
} from "../../services/map-engine";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { getUsableMapboxToken } from "../../lib/mapbox";
import { buildMapOverlayCatalog } from "../../lib/map-overlays";
import type {
  AirQualityPoint,
  ConflictZoneCollection,
  ConflictZoneFeature,
  FireEvent,
  IncidentFeature,
  ProvinceSelection,
  FlightData,
  RainfallPoint,
  RefugeeMovement,
  RegionBorderCollection,
  RegionBorderFeature,
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
}: {
  onProvinceSelect?: (province: ProvinceSelection) => void;
}) {
  const [mounted, setMounted] = useState(false);
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
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [borders, setBorders] = useState<RegionBorderCollection | null>(null);
  const [conflictZones, setConflictZones] =
    useState<ConflictZoneCollection>(EMPTY_CONFLICT_ZONES);

  const getSafeDate = () => {
    // NASA GIBS only serves imagery up to the current real-world date.
    // In this simulated environment (2026), requesting Date.now() returns
    // a future date against NASA's real calendar, resulting in transparent or black tiles.
    return "2024-03-01";
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
  const hasMapboxBaseMap = MAPBOX_TOKEN.length > 0;
  const totalActiveLayers = Object.entries(enabledOverlays).filter(
    ([, active]) => active,
  ).length;
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
    setMounted(true);
    const loadData = async () => {
      const [
        incidentData,
        fireData,
        refugeeData,
        rainfallData,
        airQualityData,
        borderData,
        conflictZoneData,
        flightData,
      ] = await Promise.all([
        fetchJson<IncidentFeature[]>("/api/incidents", []),
        fetchJson<FireEvent[]>("/api/fires", []),
        fetchJson<RefugeeMovement[]>("/api/movements", []),
        fetchJson<RainfallPoint[]>("/api/rainfall", []),
        fetchJson<AirQualityPoint[]>("/api/air-quality", []),
        fetchJson<RegionBorderCollection>("/data/region_borders.geojson", EMPTY_BORDERS),
        fetchJson<ConflictZoneCollection>("/data/conflict_zones.geojson", EMPTY_CONFLICT_ZONES),
        fetchJson<FlightData[]>("/api/flights", []),
      ]);

      setIncidents(Array.isArray(incidentData) ? incidentData : []);
      setFires(Array.isArray(fireData) ? fireData : []);
      setRefugees(Array.isArray(refugeeData) ? refugeeData : []);
      setRainfall(Array.isArray(rainfallData) ? rainfallData : []);
      setAirQuality(Array.isArray(airQualityData) ? airQualityData : []);
      setFlights(Array.isArray(flightData) ? flightData : []);
      setBorders(borderData);
      setConflictZones(conflictZoneData);
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
    ...(enabledOverlays.flightPaths ? (createFlightPathsLayer(flights) ?? []) : []),
    provinceLabelsLayer,
  ].filter(Boolean);

  const analyticControls = additionalOverlays.filter(
    (overlay) => overlay.role === "analytic",
  );
  const operationalControls = additionalOverlays.filter(
    (overlay) => overlay.role === "operational",
  );
  const focusPresets = [
    {
      id: "phuket-core",
      label: "Phuket island",
      summary: "Town, beaches, airport, and east coast",
      view: INITIAL_VIEW_STATE,
    },
    {
      id: "patong-coast",
      label: "Patong coast",
      summary: "Patong, Karon, Kata, and western access",
      view: {
        longitude: 98.284,
        latitude: 7.842,
        zoom: 11.25,
        pitch: 46,
        bearing: -20,
      },
    },
    {
      id: "airport-link",
      label: "Airport link",
      summary: "Airport, bridge, and northern road corridor",
      view: {
        longitude: 98.315,
        latitude: 8.112,
        zoom: 10.45,
        pitch: 42,
        bearing: -8,
      },
    },
    {
      id: "phang-nga-bay",
      label: "Phang Nga Bay",
      summary: "Bay approaches, piers, and marine routes",
      view: {
        longitude: 98.53,
        latitude: 8.085,
        zoom: 9.75,
        pitch: 38,
        bearing: 14,
      },
    },
  ] as const;
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
          : overlay.id === "populationMovement"
            ? `${formatCompactCount(refugees.length)} flows`
            : overlay.id === "incidentHeatmap" || overlay.id === "incidentPoints"
              ? `${formatCompactCount(signalCount)} signals`
              : overlay.id === "provinceLabels"
                ? "Province index"
                : overlay.id === "flightPaths"
                  ? `${formatCompactCount(flights.length)} aircraft`
                  : overlay.shortLabel,
      icon:
        overlay.id === "populationMovement"
          ? Users
          : overlay.id === "conflictZones"
            ? MapPinned
            : overlay.id === "rainfallAnomalies"
              ? CloudRain
              : overlay.id === "provinceLabels"
                ? Tag
                : overlay.id === "flightPaths"
                  ? Plane
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
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-raised)] animate-pulse" />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {!hasMapboxBaseMap && (
        <div
          className={`absolute inset-0 ${fallbackBackgroundClass}`}
          aria-hidden="true"
        />
      )}

      <DeckGL
        id="phuket-deck"
        viewState={viewState}
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

      <div className="pointer-events-auto absolute inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[rgba(248,246,240,0.85)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1.5 xl:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-bold tracking-tight text-[var(--ink)] uppercase">Operating Surface</div>
              <div className="h-3 w-[1px] bg-[var(--line)]" />
              <div className="flex gap-3 text-[9px] font-mono font-bold text-[var(--dim)] uppercase tracking-tight">
                <span>SIG {signalCount}</span>
                <span>AQI {airQuality.length}</span>
                <span>FLT {flights.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 border-r border-[var(--line)] pr-2 mr-1">
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
                onClick={() =>
                  setViewState((current) => ({
                    ...current,
                    ...preset.view,
                  }))
                }
                className="whitespace-nowrap rounded border border-[var(--line)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--dim)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
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

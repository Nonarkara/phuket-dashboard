import type {
  MapOverlay,
  MapOverlayCatalogResponse,
  MapOverlayKind,
} from "../types/dashboard";

const NASA_GIBS_SAFE_DATE = "2024-03-01";

function getSafeDate() {
  return NASA_GIBS_SAFE_DATE;
}

function rasterOverlay(overlay: Omit<MapOverlay, "kind" | "updatedAt">): MapOverlay {
  return {
    ...overlay,
    kind: "raster",
    updatedAt: new Date().toISOString(),
  };
}

function vectorOverlay(overlay: Omit<MapOverlay, "kind" | "updatedAt">): MapOverlay {
  return {
    ...overlay,
    kind: "vector",
    updatedAt: new Date().toISOString(),
  };
}

export function buildMapOverlayCatalog(
  focusDate = getSafeDate(),
): MapOverlayCatalogResponse {
  const overlays: MapOverlay[] = [
    rasterOverlay({
      id: "viirsTrueColor",
      label: "VIIRS True Color",
      shortLabel: "TRUE",
      description: "Natural-color daily scan for first-pass regional review.",
      source: "NASA GIBS / VIIRS",
      family: "imagery",
      role: "base-option",
      defaultOpacity: 0.74,
      enabledByDefault: true,
      maxZoom: 9,
      timeMode: "dated",
      tileTemplate:
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${focusDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    }),
    rasterOverlay({
      id: "modisFalseColor",
      label: "MODIS False Color",
      shortLabel: "FALSE",
      description:
        "Vegetation and burn-scar contrast for terrain, canopy health, and disturbance.",
      source: "NASA GIBS / MODIS Terra",
      family: "vegetation",
      role: "base-option",
      defaultOpacity: 0.78,
      enabledByDefault: false,
      maxZoom: 9,
      timeMode: "dated",
      tileTemplate:
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default/${focusDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    }),
    rasterOverlay({
      id: "blueMarble",
      label: "Blue Marble Relief",
      shortLabel: "RELIEF",
      description: "Terrain-first relief framing for ridgelines, approach routes, and coastlines.",
      source: "NASA GIBS / Blue Marble",
      family: "terrain",
      role: "base-option",
      defaultOpacity: 0.72,
      enabledByDefault: false,
      maxZoom: 8,
      timeMode: "dated",
      tileTemplate:
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief/default/${focusDate}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
    }),
    rasterOverlay({
      id: "vegetationIndex",
      label: "Vegetation Index",
      shortLabel: "EVI",
      description:
        "Eight-day vegetation intensity surface for canopy stress and seasonal greenness.",
      source: "NASA GIBS / MODIS Terra EVI",
      family: "vegetation",
      role: "analytic",
      defaultOpacity: 0.46,
      enabledByDefault: false,
      maxZoom: 9,
      timeMode: "default",
      tileTemplate:
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_EVI_8Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
    }),
    rasterOverlay({
      id: "nightLights",
      label: "Night Lights",
      shortLabel: "LIGHTS",
      description:
        "Hourly VIIRS day-night band for settlement brightness and infrastructure activity.",
      source: "NASA GIBS / VIIRS",
      family: "lights",
      role: "analytic",
      defaultOpacity: 0.48,
      enabledByDefault: false,
      maxZoom: 8,
      timeMode: "default",
      tileTemplate:
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_AtSensor_M15/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    }),
    rasterOverlay({
      id: "precipitationRate",
      label: "Precipitation Rate",
      shortLabel: "RAIN",
      description: "IMERG precipitation rate for recent rain-field pressure and mobility impact.",
      source: "NASA GIBS / IMERG",
      family: "weather",
      role: "analytic",
      defaultOpacity: 0.56,
      enabledByDefault: false,
      maxZoom: 6,
      timeMode: "dated",
      tileTemplate:
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${focusDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    }),
    rasterOverlay({
      id: "aerosolOpticalDepth",
      label: "Aerosol Optical Depth",
      shortLabel: "AER",
      description:
        "MODIS aerosol optical depth surface adapted from the Middle East dashboard for wider pollution drift context.",
      source: "NASA GIBS / MODIS",
      family: "air",
      role: "analytic",
      defaultOpacity: 0.58,
      enabledByDefault: false,
      maxZoom: 6,
      timeMode: "dated",
      tileTemplate:
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Value_Added_AOD/default/${focusDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    }),
    vectorOverlay({
      id: "borderContext",
      label: "Regional Boundaries",
      shortLabel: "REGION",
      description: "Province and country outlines for Andaman and southern Thailand framing.",
      source: "Local GeoJSON",
      family: "operational",
      role: "operational",
      defaultOpacity: 1,
      enabledByDefault: true,
    }),
    vectorOverlay({
      id: "conflictZones",
      label: "Focus Zones",
      shortLabel: "FOCUS",
      description:
        "Optional focus polygons for broader seasonal or operational orientation.",
      source: "Local GeoJSON",
      family: "operational",
      role: "operational",
      defaultOpacity: 0.72,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "incidentPoints",
      label: "Signal Points",
      shortLabel: "POINTS",
      description: "Point signals from local operations, weather, and safety feeds.",
      source: "Events / Reference feeds",
      family: "operational",
      role: "operational",
      defaultOpacity: 0.84,
      enabledByDefault: true,
    }),
    vectorOverlay({
      id: "incidentHeatmap",
      label: "Signal Heatmap",
      shortLabel: "HEAT",
      description: "Density view for clustered operating and safety signals.",
      source: "Events / Reference feeds",
      family: "operational",
      role: "operational",
      defaultOpacity: 0.92,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "thermalHotspots",
      label: "Thermal Hotspots",
      shortLabel: "FIRE",
      description: "Thermal anomalies and active fire detections.",
      source: "NASA FIRMS",
      family: "thermal",
      role: "analytic",
      defaultOpacity: 0.88,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "aqiHeatmap",
      label: "AQI Heatmap",
      shortLabel: "AQI",
      description: "Open-Meteo US AQI surface built from Phuket, nearby provinces, Bangkok, and Singapore.",
      source: "Open-Meteo",
      family: "air",
      role: "analytic",
      defaultOpacity: 0.82,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "pm25Heatmap",
      label: "PM2.5 Heatmap",
      shortLabel: "PM25",
      description: "Open-Meteo PM2.5 concentration hotspots for smoke and pollution pressure.",
      source: "Open-Meteo",
      family: "air",
      role: "analytic",
      defaultOpacity: 0.82,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "rainfallAnomalies",
      label: "Rainfall Shifts",
      shortLabel: "SHIFT",
      description: "Localized rainfall shifts and anomaly points.",
      source: "Rainfall cache",
      family: "weather",
      role: "analytic",
      defaultOpacity: 0.8,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "populationMovement",
      label: "Visitor Movement",
      shortLabel: "MOVE",
      description: "Visitor and mobility flow traces between airport, towns, beaches, and piers.",
      source: "Movement cache",
      family: "operational",
      role: "operational",
      defaultOpacity: 0.82,
      enabledByDefault: false,
    }),
    vectorOverlay({
      id: "provinceLabels",
      label: "Province Labels",
      shortLabel: "PROV",
      description: "Thai provincial names and boundary markers for geographic orientation.",
      source: "Reference data",
      family: "operational",
      role: "operational",
      defaultOpacity: 1,
      enabledByDefault: true,
    }),
    vectorOverlay({
      id: "flightPaths",
      label: "Flight Paths",
      shortLabel: "FLIGHT",
      description: "Real-time aircraft positions over Phuket and nearby approach routes.",
      source: "OpenSky Network",
      family: "operational",
      role: "operational",
      defaultOpacity: 0.85,
      enabledByDefault: true,
    }),
  ];

  return {
    updatedAt: new Date().toISOString(),
    defaultBasemap: "detailed-streets",
    defaultImageryOverlayId: "viirsTrueColor",
    overlays,
  };
}

export function getOverlayById(
  overlayId: string,
  focusDate = getSafeDate(),
): MapOverlay | undefined {
  return buildMapOverlayCatalog(focusDate).overlays.find(
    (overlay) => overlay.id === overlayId,
  );
}

export function isRasterOverlay(overlay: MapOverlay): overlay is MapOverlay & {
  kind: Extract<MapOverlayKind, "raster">;
  tileTemplate: string;
  maxZoom: number;
} {
  return overlay.kind === "raster" && Boolean(overlay.tileTemplate);
}

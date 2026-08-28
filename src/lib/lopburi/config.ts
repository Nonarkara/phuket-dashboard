// ─── Lopburi Province Configuration ─────────────────────────────
// Mirrors the Phuket governor-config format: corridors with map fly-to
// views, aliases, and default operational actions — adapted to an
// inland Chao Phraya / Pa Sak basin province.

export interface LopburiCorridorDefinition {
  id: string;
  label: string;
  aliases: string[];
  view: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  defaultAction: string;
}

export const LOPBURI_PROVINCE = {
  code: 16, // ThaiWater / HII province code for Lopburi
  nameEn: "Lopburi",
  nameTh: "ลพบุรี",
  center: { longitude: 100.75, latitude: 14.95 },
  defaultView: {
    longitude: 100.78,
    latitude: 14.97,
    zoom: 8.9,
    pitch: 42,
    bearing: -6,
  },
  // Rough province bounding box (used to filter national feeds like DOH CCTV)
  bbox: { west: 100.35, south: 14.55, east: 101.55, north: 15.65 },
} as const;

export const LOPBURI_CORRIDORS: LopburiCorridorDefinition[] = [
  {
    id: "old-town",
    label: "Old Town / Monkey Zone",
    aliases: ["old town", "phra prang sam yot", "monkey", "san phra kan", "narai palace"],
    view: { longitude: 100.6135, latitude: 14.801, zoom: 13.4, pitch: 46, bearing: -8 },
    defaultAction:
      "Keep the heritage quarter open, monitor macaque-crowd friction, and hold tourist-safety messaging steady.",
  },
  {
    id: "pasak-dam",
    label: "Pa Sak Jolasid Dam",
    aliases: ["pa sak", "jolasid", "dam", "reservoir", "phatthana nikhom"],
    view: { longitude: 101.066, latitude: 14.861, zoom: 11.0, pitch: 44, bearing: 10 },
    defaultAction:
      "Track reservoir storage and release tempo; pre-brief downstream districts before any spillway change.",
  },
  {
    id: "thawung-banmi",
    label: "Tha Wung / Ban Mi Lowlands",
    aliases: ["tha wung", "ban mi", "lopburi river", "lowland", "flood basin"],
    view: { longitude: 100.52, latitude: 14.94, zoom: 10.2, pitch: 42, bearing: -12 },
    defaultAction:
      "Watch Lopburi River bank capacity in the western lowlands; stage pumps and sandbags at known overflow points.",
  },
  {
    id: "highway-1",
    label: "Phahonyothin / Khok Samrong",
    aliases: ["highway 1", "phahonyothin", "khok samrong", "route 1"],
    view: { longitude: 100.72, latitude: 15.03, zoom: 10.4, pitch: 42, bearing: 0 },
    defaultAction:
      "Keep the Highway 1 spine moving; coordinate detours early if rain closes low sections.",
  },
  {
    id: "chai-badan",
    label: "Chai Badan / Highway 21",
    aliases: ["chai badan", "highway 21", "lam narai", "route 21"],
    view: { longitude: 101.13, latitude: 15.19, zoom: 10.2, pitch: 40, bearing: 8 },
    defaultAction:
      "Monitor Highway 21 runoff crossings and upland flash-flood feeds into the Pa Sak valley.",
  },
  {
    id: "military-district",
    label: "Fort Narai / Khok Kathiam",
    aliases: ["fort narai", "military", "special warfare", "khok kathiam", "airbase", "wing 2"],
    view: { longitude: 100.66, latitude: 14.86, zoom: 11.6, pitch: 44, bearing: -4 },
    defaultAction:
      "Sync with garrison liaison on joint flood-relief tasking and airbase support availability.",
  },
];

export function findLopburiCorridor(id: string) {
  return LOPBURI_CORRIDORS.find((c) => c.id === id);
}

// ─── Satellite layer catalog ────────────────────────────────────
// Free, no-token raster layers (NASA GIBS + Esri) rendered as a
// deck.gl TileLayer above the basemap. Dated layers use yesterday's
// scan so tiles are guaranteed to exist.

export interface SatelliteLayerDefinition {
  id: string;
  label: string;
  shortLabel: string;
  source: string;
  opacity: number;
  maxZoom: number;
  tileTemplate: string;
}

function gibsDate(daysAgo = 1): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function buildSatelliteLayerCatalog(): SatelliteLayerDefinition[] {
  const date = gibsDate(1);
  return [
    {
      id: "viirs-true-color",
      label: "VIIRS True Color (daily)",
      shortLabel: "TRUE",
      source: "NASA GIBS / VIIRS SNPP",
      opacity: 0.78,
      maxZoom: 9,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    },
    {
      id: "modis-flood-contrast",
      label: "MODIS 7-2-1 Flood Contrast",
      shortLabel: "FLOOD",
      source: "NASA GIBS / MODIS Terra",
      opacity: 0.8,
      maxZoom: 9,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    },
    {
      id: "imerg-rain",
      label: "IMERG Precipitation Rate",
      shortLabel: "RAIN",
      source: "NASA GIBS / IMERG",
      opacity: 0.6,
      maxZoom: 6,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    },
    {
      id: "night-lights",
      label: "VIIRS Night Lights",
      shortLabel: "LIGHTS",
      source: "NASA GIBS / VIIRS DNB",
      opacity: 0.55,
      maxZoom: 8,
      tileTemplate: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_AtSensor_M15/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    },
    {
      id: "esri-imagery",
      label: "Esri World Imagery (hi-res)",
      shortLabel: "HIRES",
      source: "Esri World Imagery",
      opacity: 0.95,
      maxZoom: 19,
      tileTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    },
  ];
}

export const LOPBURI_SCENARIO_IDS = [
  "red-monsoon-day",
  "stable-recovery-day",
  "tourism-surge-weekend",
] as const;

export function normalizeLopburiScenario(raw: string | null | undefined) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return (LOPBURI_SCENARIO_IDS as readonly string[]).includes(v)
    ? (v as (typeof LOPBURI_SCENARIO_IDS)[number])
    : null;
}

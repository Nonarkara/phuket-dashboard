/**
 * Satellite + precipitation overlays for Phuket.
 *
 * Sources:
 *   - NASA GIBS WMTS: VIIRS Suomi-NPP true colour, MODIS Terra true colour,
 *     IMERG precipitation rate (all daily, free, CORS-friendly).
 *   - RainViewer: real-time rainfall radar tiles (10-minute cadence, free).
 *
 * Each source carries a `capturedAt` ISO date so the UI can render an
 * "Xd ago" / "Xm ago" freshness chip per the godmode-dashboard pattern.
 */

import { createRasterTileLayer } from "./map-engine";

export type SatelliteId =
  | "viirs-truecolor"
  | "modis-truecolor"
  | "imerg-precip"
  | "rainviewer-radar"
  | "gistda-sst"
  | "gistda-chl";

export interface SatelliteSource {
  id: SatelliteId;
  label: string;
  shortLabel: string;
  description: string;
  capturedAt: string;
  tileTemplate: string;
  maxZoom: number;
  attribution: string;
  cadence: "daily" | "minute";
}

function utcDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// GISTDA Ocean WMS — Sea Surface Temperature + Chlorophyll-a over Andaman Sea.
// Open, daily cadence from VIIRS satellite, no auth required.
// Source: ocean.gistda.or.th (Geo-Informatics and Space Technology Development Agency, Thailand)
export const GISTDA_OCEAN_WMS_BASE = "https://ocean.gistda.or.th/geoserver/openwq/wms";

export const GISTDA_OCEAN_LAYERS = {
  sst: "lastest_sst",
  chl: "lastest_chl",
} as const;

/** Freshness metadata for the GISTDA ocean WMS layers (both update daily). */
export function buildGistdaOceanMeta(): { capturedAt: string } {
  return { capturedAt: utcDateOffset(1) };
}

export function buildDailyGibsSources(): SatelliteSource[] {
  const date = utcDateOffset(1);
  return [
    {
      id: "viirs-truecolor",
      label: "VIIRS true colour (Suomi-NPP)",
      shortLabel: "VIIRS",
      description:
        "Daytime true-colour from NOAA VIIRS / Suomi-NPP, ~750m resolution.",
      capturedAt: date,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      maxZoom: 9,
      attribution: "NASA GIBS · VIIRS Suomi-NPP",
      cadence: "daily",
    },
    {
      id: "modis-truecolor",
      label: "MODIS true colour (Terra)",
      shortLabel: "MODIS",
      description:
        "Daytime true-colour from MODIS / Terra, ~250m resolution.",
      capturedAt: date,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      maxZoom: 9,
      attribution: "NASA GIBS · MODIS Terra",
      cadence: "daily",
    },
    {
      id: "imerg-precip",
      label: "IMERG precipitation rate (GPM)",
      shortLabel: "Precip",
      description:
        "Half-hourly precipitation from NASA GPM IMERG, ~10km resolution.",
      capturedAt: date,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
      maxZoom: 7,
      attribution: "NASA GIBS · GPM IMERG",
      cadence: "daily",
    },
  ];
}

export interface RainViewerFrame {
  time: number; // unix seconds
  path: string;
}

interface RainViewerIndex {
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
}

/**
 * Fetches RainViewer's latest frame index. Returns a tile URL template
 * for the most recent radar frame and the timestamp it was captured at.
 */
export async function fetchRainViewerLatest(
  signal?: AbortSignal,
): Promise<SatelliteSource | null> {
  try {
    const res = await fetch(
      "https://api.rainviewer.com/public/weather-maps.json",
      { signal, cache: "no-store" },
    );
    if (!res.ok) return null;
    const idx = (await res.json()) as RainViewerIndex;
    const past = idx.radar?.past ?? [];
    const latest = past[past.length - 1];
    if (!idx.host || !latest) return null;
    const tileTemplate = `${idx.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
    return {
      id: "rainviewer-radar",
      label: "RainViewer rainfall radar",
      shortLabel: "Radar",
      description:
        "Real-time global rainfall radar from RainViewer (10-minute cadence).",
      capturedAt: new Date(latest.time * 1000).toISOString(),
      tileTemplate,
      maxZoom: 12,
      attribution: "RainViewer",
      cadence: "minute",
    };
  } catch {
    return null;
  }
}

export function freshnessLabel(capturedAt: string): string {
  const captured = new Date(capturedAt).getTime();
  if (!Number.isFinite(captured)) return "—";
  const diffMs = Date.now() - captured;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "captured just now";
  if (diffMin < 60) return `captured ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `captured ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "captured 1d ago";
  if (diffDays < 30) return `captured ${diffDays}d ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `captured ${months}mo ago`;
  }
  const years = (diffDays / 365).toFixed(1);
  return `captured ${years}y ago`;
}

export function freshnessTier(
  capturedAt: string,
  cadence: "daily" | "minute" = "daily",
): "fresh" | "acceptable" | "stale" {
  const captured = new Date(capturedAt).getTime();
  if (!Number.isFinite(captured)) return "stale";
  const diffMin = (Date.now() - captured) / 60000;
  if (cadence === "minute") {
    if (diffMin <= 30) return "fresh";
    if (diffMin <= 90) return "acceptable";
    return "stale";
  }
  const diffDays = diffMin / 1440;
  if (diffDays <= 2) return "fresh";
  if (diffDays <= 7) return "acceptable";
  return "stale";
}

export function createSatelliteTileLayer(source: SatelliteSource) {
  return createRasterTileLayer({
    id: `satellite-${source.id}`,
    data: source.tileTemplate,
    maxZoom: source.maxZoom,
    opacity: source.cadence === "minute" ? 0.65 : 0.85,
  });
}

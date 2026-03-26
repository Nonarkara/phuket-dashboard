import { NextRequest, NextResponse } from "next/server";

/**
 * STAC Satellite Discovery API
 *
 * Searches Microsoft Planetary Computer's STAC catalog for recent
 * satellite imagery over Phuket. Follows 2026 best practices:
 * - STAC API for discovery (SpatioTemporal Asset Catalog)
 * - COG (Cloud Optimized GeoTIFF) for partial reads
 * - Cloud-native: no downloads, stream tiles directly
 *
 * Collections: Sentinel-2 L2A, Landsat-9 C2-L2, MODIS
 */

const PLANETARY_COMPUTER_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const TIMEOUT_MS = 15_000;

// Phuket bounding box [west, south, east, north]
const PHUKET_BBOX = [98.2, 7.7, 98.5, 8.2];

// Andaman region (wider)
const ANDAMAN_BBOX = [97.5, 7.0, 99.5, 9.5];

interface StacItem {
  id: string;
  collection: string;
  datetime: string;
  properties: Record<string, unknown>;
  assets: Record<string, { href: string; type?: string; title?: string }>;
  bbox: number[];
  links: { rel: string; href: string }[];
}

interface StacSearchResponse {
  type: string;
  features: StacItem[];
  context?: { matched?: number; returned?: number };
}

interface SatelliteScene {
  id: string;
  collection: string;
  datetime: string;
  cloudCover: number | null;
  thumbnail: string | null;
  cogUrl: string | null;
  bbox: number[];
  properties: Record<string, unknown>;
}

async function stacSearch(params: {
  collections: string[];
  bbox: number[];
  datetime: string;
  limit: number;
  maxCloudCover?: number;
}): Promise<SatelliteScene[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      collections: params.collections,
      bbox: params.bbox,
      datetime: params.datetime,
      limit: params.limit,
      sortby: [{ field: "datetime", direction: "desc" }],
    };

    if (params.maxCloudCover !== undefined) {
      body.query = { "eo:cloud_cover": { lt: params.maxCloudCover } };
    }

    const res = await fetch(`${PLANETARY_COMPUTER_STAC}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const data = (await res.json()) as StacSearchResponse;

    return data.features.map((item) => ({
      id: item.id,
      collection: item.collection,
      datetime: item.properties.datetime as string ?? item.datetime,
      cloudCover: (item.properties["eo:cloud_cover"] as number) ?? null,
      thumbnail: item.assets.thumbnail?.href ?? item.assets.rendered_preview?.href ?? null,
      cogUrl: item.assets.B04?.href ?? item.assets.visual?.href ?? item.assets.B4?.href ?? null,
      bbox: item.bbox,
      properties: {
        platform: item.properties["platform"] ?? item.properties["eo:platform"],
        instrument: item.properties["instruments"] ?? item.properties["eo:instrument"],
        gsd: item.properties["gsd"],
        sunElevation: item.properties["view:sun_elevation"],
        offNadir: item.properties["view:off_nadir"],
      },
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get("collection") ?? "sentinel-2-l2a";
  const days = Number(request.nextUrl.searchParams.get("days") ?? "14");
  const maxCloud = Number(request.nextUrl.searchParams.get("maxCloud") ?? "30");
  const region = request.nextUrl.searchParams.get("region") ?? "phuket";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "10"), 25);

  const bbox = region === "andaman" ? ANDAMAN_BBOX : PHUKET_BBOX;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const datetime = `${startDate.toISOString().slice(0, 10)}/${endDate.toISOString().slice(0, 10)}`;

  const collections = collection === "all"
    ? ["sentinel-2-l2a", "landsat-c2-l2"]
    : [collection];

  const scenes = await stacSearch({
    collections,
    bbox,
    datetime,
    limit,
    maxCloudCover: maxCloud,
  });

  return NextResponse.json({
    query: {
      collections,
      bbox,
      datetime,
      maxCloudCover: maxCloud,
      region,
    },
    scenes,
    count: scenes.length,
    catalog: "Microsoft Planetary Computer",
    standard: "STAC (SpatioTemporal Asset Catalog)",
    assetFormat: "COG (Cloud Optimized GeoTIFF)",
    note: "Thumbnails and COG URLs require SAS token signing for direct access. Use Planetary Computer Hub or pystac-client with sign_inplace modifier.",
  });
}

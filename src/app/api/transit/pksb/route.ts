import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { FeatureCollection, GeoJsonProperties, MultiLineString, Point } from "geojson";
import type {
  PksbRouteCollection,
  PksbRouteFeature,
  PksbStopCollection,
  PksbStopFeature,
  PksbTransitResponse,
} from "../../../../types/dashboard";

const ROUTE_SOURCES = [
  {
    id: "dragon_line",
    label: "PKSB Dragon Line",
    url: "https://smartbus.phuket.cloud/assets/bus_dragon-APegdFKB.geojson",
    fallbackFile: "pksb-bus-dragon.geojson",
    defaultColor: "#db0000",
  },
  {
    id: "main_line",
    label: "PKSB Rawai-Airport Line",
    url: "https://smartbus.phuket.cloud/assets/bus_rawai_airport-DUpapKAY.geojson",
    fallbackFile: "pksb-bus-rawai-airport.geojson",
    defaultColor: "#35c6f3",
  },
  {
    id: "patong_line",
    label: "PKSB Patong-Terminal Line",
    url: "https://smartbus.phuket.cloud/assets/bus_oldbus_patong-BCJzyA2I.geojson",
    fallbackFile: "pksb-bus-patong-terminal.geojson",
    defaultColor: "#ffa500",
  },
] as const;

const ROUTE_META = Object.fromEntries(
  ROUTE_SOURCES.map((route) => [route.id, route]),
) as Record<(typeof ROUTE_SOURCES)[number]["id"], (typeof ROUTE_SOURCES)[number]>;

const STOPS_SOURCE = {
  url: "https://smartbus.phuket.cloud/assets/bus_stop_all-CUBpgz7Q.geojson",
  fallbackFile: "pksb-bus-stops.geojson",
};

type RawRouteProperties = GeoJsonProperties & {
  color?: string;
  name?: string;
  layer?: string;
  lenght?: number;
};

type RawStopProperties = GeoJsonProperties & {
  no?: number;
  route?: string;
  stop_name_eng?: string;
  stop_name_th?: string;
  direction?: string;
  route_direction?: string;
  time?: string;
  lat?: number;
  lon?: number;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function readFallbackJson<T>(filename: string): Promise<T | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", filename);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isFeatureCollection<T extends GeoJsonProperties>(
  value: unknown,
): value is FeatureCollection<MultiLineString | Point, T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  );
}

function normalizeRouteFeatures(
  routeId: keyof typeof ROUTE_META,
  payload: FeatureCollection<MultiLineString, RawRouteProperties>,
): PksbRouteFeature[] {
  const routeMeta = ROUTE_META[routeId];

  return payload.features
    .filter((feature) => feature.geometry?.type === "MultiLineString")
    .map((feature, index) => ({
      ...feature,
      properties: {
        id: `${routeId}-${index + 1}`,
        routeId,
        routeLabel: routeMeta.label,
        directionLabel:
          feature.properties?.name ||
          feature.properties?.layer ||
          `Direction ${index + 1}`,
        color: feature.properties?.color || routeMeta.defaultColor,
        lengthMeters:
          typeof feature.properties?.lenght === "number"
            ? feature.properties.lenght
            : null,
      },
    }));
}

function normalizeStopFeatures(
  payload: FeatureCollection<Point, RawStopProperties>,
): PksbStopFeature[] {
  return payload.features
    .filter((feature) => {
      const routeId = feature.properties?.route;
      return (
        feature.geometry?.type === "Point" &&
        (routeId === "dragon_line" || routeId === "main_line" || routeId === "patong_line")
      );
    })
    .map((feature) => {
      const routeId = feature.properties.route as keyof typeof ROUTE_META;
      const routeMeta = ROUTE_META[routeId];
      const [lon, lat] = feature.geometry.coordinates;

      return {
        ...feature,
        properties: {
          id: `${routeId}-stop-${feature.properties.no ?? "x"}`,
          routeId,
          routeLabel: routeMeta.label,
          routeColor: routeMeta.defaultColor,
          stopNumber: feature.properties.no ?? 0,
          stopNameEn:
            feature.properties.stop_name_eng ||
            feature.properties.stop_name_th ||
            "PKSB Stop",
          stopNameTh:
            feature.properties.stop_name_th ||
            feature.properties.stop_name_eng ||
            "PKSB Stop",
          direction: feature.properties.direction || "PKSB service",
          routeDirection:
            feature.properties.route_direction || routeMeta.label,
          timetable: feature.properties.time || "Public PKSB timetable",
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        },
      };
    });
}

export async function GET() {
  const routePayloads = await Promise.all(
    ROUTE_SOURCES.map(async (route) => {
      const live =
        (await fetchJson<FeatureCollection<MultiLineString, RawRouteProperties>>(
          route.url,
        )) ??
        (await readFallbackJson<FeatureCollection<MultiLineString, RawRouteProperties>>(
          route.fallbackFile,
        ));

      return { route, payload: live };
    }),
  );

  const liveStops =
    (await fetchJson<FeatureCollection<Point, RawStopProperties>>(STOPS_SOURCE.url)) ??
    (await readFallbackJson<FeatureCollection<Point, RawStopProperties>>(
      STOPS_SOURCE.fallbackFile,
    ));

  const routes: PksbRouteCollection = {
    type: "FeatureCollection",
    features: routePayloads.flatMap(({ route, payload }) =>
      payload && isFeatureCollection<RawRouteProperties>(payload)
        ? normalizeRouteFeatures(route.id, payload as FeatureCollection<MultiLineString, RawRouteProperties>)
        : [],
    ),
  };

  const stops: PksbStopCollection = {
    type: "FeatureCollection",
    features:
      liveStops && isFeatureCollection<RawStopProperties>(liveStops)
        ? normalizeStopFeatures(liveStops as FeatureCollection<Point, RawStopProperties>)
        : [],
  };

  const payload: PksbTransitResponse = {
    generatedAt: new Date().toISOString(),
    source: [
      "Phuket Smart Bus public tracker",
      "smartbus.phuket.cloud route GeoJSON",
      "Local PKSB snapshot fallback",
    ],
    routes,
    stops,
  };

  return NextResponse.json(payload);
}

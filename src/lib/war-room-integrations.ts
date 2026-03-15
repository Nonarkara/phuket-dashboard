import {
  CITY_ZONES,
  GOVERNOR_CORRIDORS,
  MARINE_POINTS,
  textMatchesAliases,
} from "./governor-config";
import { fallbackRainfall } from "./mock-data";
import type {
  ApiSourceEntry,
  Coordinates,
  DisasterAlert,
  DisasterFeedResponse,
  DisasterLayerDescriptor,
  ExecutiveStatus,
  GovernorScenarioId,
  MaritimeSecurityResponse,
  MaritimeVessel,
  TourismHotspot,
  TourismHotspotsResponse,
} from "../types/dashboard";

interface WarRoomOptions {
  scenario?: GovernorScenarioId | null;
}

const TMD_WARNING_URL =
  "https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=api&ukey=api12345";
const DEFAULT_GISTDA_PORTAL_URL = "https://disaster.gistda.or.th/services/open-api";
const DEFAULT_GISTDA_NSDC_URL = "https://nsdc.gistda.or.th";
const DEFAULT_GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const DEFAULT_GOOGLE_TRENDS_URL = "https://trends.google.com/trending/rss?geo=TH";
const DEFAULT_DATA_GO_TH_URL =
  "https://data.go.th/dataset?groups=tourism-and-sports";
const DEFAULT_TAT_PORTAL_URL = "https://tatdataapi.io";
const PHUKET_CENTER: Coordinates = [98.3381, 7.9519];
const ANDAMAN_BOUNDS = {
  minLat: 7.2,
  maxLat: 9.2,
  minLng: 97.9,
  maxLng: 99.25,
};

const STATUS_WEIGHT: Record<ExecutiveStatus, number> = {
  stable: 1,
  watch: 2,
  intervene: 3,
};

function resolveScenario(value?: GovernorScenarioId | null): GovernorScenarioId {
  if (
    value === "red-monsoon-day" ||
    value === "tourism-surge-weekend" ||
    value === "stable-recovery-day"
  ) {
    return value;
  }

  return "live";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function topStatus(statuses: ExecutiveStatus[]): ExecutiveStatus {
  return statuses.sort((left, right) => STATUS_WEIGHT[right] - STATUS_WEIGHT[left])[0] ?? "stable";
}

function statusFromWeatherText(text: string): ExecutiveStatus {
  if (/tsunami|flash flood|severe flood|landslide|red warning|storm surge/i.test(text)) {
    return "intervene";
  }

  if (/warning|heavy rain|rough sea|monsoon|thunderstorm|strong wind|flood/i.test(text)) {
    return "watch";
  }

  return "stable";
}

function statusFromVessel(vessel: Pick<MaritimeVessel, "type" | "speedKnots" | "destination" | "strategicNote">) {
  const type = vessel.type.toLowerCase();
  const note = vessel.strategicNote.toLowerCase();
  const destination = vessel.destination?.toLowerCase() ?? "";

  if (
    /unknown|unidentified|fishing/.test(type) &&
    vessel.speedKnots <= 2.5 &&
    /loiter|anchorage|pier|rassada|phi phi|ao nang|khao lak/.test(
      `${note} ${destination}`,
    )
  ) {
    return "intervene" as const;
  }

  if (/ferry|passenger|cargo|fishing/.test(type) || vessel.speedKnots <= 8) {
    return "watch" as const;
  }

  return "stable" as const;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout<T>(url: string, init?: RequestInit, timeoutMs = 8000) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "PhuketGovernorWarRoom/1.0",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 8000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json, text/plain, text/xml, application/xml, */*",
        "User-Agent": "PhuketGovernorWarRoom/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

function flattenTextEntries(value: unknown): string[] {
  if (typeof value === "string") {
    const text = stripHtml(value);
    return text.length >= 16 ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenTextEntries);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(flattenTextEntries);
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractObjectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.features)) {
    return record.features.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  for (const key of ["data", "items", "results", "response", "vessels", "places"]) {
    if (Array.isArray(record[key])) {
      return record[key].filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      );
    }
  }

  return [];
}

type AreaMatch = {
  label: string;
  center: Coordinates;
};

const AREA_CATALOG: Array<AreaMatch & { aliases: string[] }> = [
  ...MARINE_POINTS.map((point) => ({
    label: point.focusArea,
    center: point.center,
    aliases: point.aliases,
  })),
  ...CITY_ZONES.map((zone) => ({
    label: zone.label,
    center:
      GOVERNOR_CORRIDORS.find((corridor) => corridor.focusAreas.includes(zone.label))
        ?.center ?? PHUKET_CENTER,
    aliases: zone.aliases,
  })),
  {
    label: "Airport corridor",
    center: [98.3169, 8.1132] as Coordinates,
    aliases: ["airport", "arrivals", "transfer road"],
  },
  {
    label: "Phi Phi corridor",
    center: [98.553, 7.796] as Coordinates,
    aliases: ["phi phi", "ferry lane", "marine corridor"],
  },
  {
    label: "Island-wide",
    center: PHUKET_CENTER,
    aliases: ["phuket", "andaman", "island-wide"],
  },
];

function findAreaMatch(text: string): AreaMatch {
  const matched =
    AREA_CATALOG.find((area) => textMatchesAliases(text, area.aliases)) ??
    AREA_CATALOG[AREA_CATALOG.length - 1];

  return {
    label: matched.label,
    center: matched.center,
  };
}

function configuredLayer(
  id: string,
  label: string,
  kind: DisasterLayerDescriptor["kind"],
  source: string,
  configuredUrl: string | undefined,
  fallbackUrl: string,
): DisasterLayerDescriptor {
  return {
    id,
    label,
    kind,
    source,
    url: configuredUrl || fallbackUrl,
    configured: Boolean(configuredUrl),
  };
}

function buildDisasterLayers(): DisasterLayerDescriptor[] {
  return [
    configuredLayer(
      "gistda-disaster-api",
      "GISTDA Disaster Open API",
      "api",
      "GISTDA",
      process.env.GISTDA_DISASTER_FEED_URL,
      DEFAULT_GISTDA_PORTAL_URL,
    ),
    configuredLayer(
      "gistda-flood-wmts",
      "GISTDA Flood Layer",
      "wmts",
      "GISTDA",
      process.env.GISTDA_FLOOD_WMTS_URL,
      DEFAULT_GISTDA_PORTAL_URL,
    ),
    configuredLayer(
      "gistda-fire-wmts",
      "GISTDA Fire Layer",
      "wmts",
      "GISTDA",
      process.env.GISTDA_FIRE_WMTS_URL,
      DEFAULT_GISTDA_PORTAL_URL,
    ),
    configuredLayer(
      "gistda-nsdc-stac",
      "NSDC / STAC",
      "stac",
      "GISTDA NSDC",
      process.env.GISTDA_STAC_URL,
      DEFAULT_GISTDA_NSDC_URL,
    ),
    configuredLayer(
      "tmd-ndwc-cap",
      "TMD / NDWC Alerts",
      "cap",
      "TMD / NDWC",
      process.env.NDWC_ALERT_URL,
      TMD_WARNING_URL,
    ),
  ];
}

function buildScenarioDisasterFeed(
  scenario: Exclude<GovernorScenarioId, "live">,
): DisasterFeedResponse {
  const generatedAt = new Date().toISOString();

  if (scenario === "red-monsoon-day") {
    return {
      generatedAt,
      posture: "intervene",
      summary:
        "TMD-style flood and rough-sea warnings are aligned across west beaches, airport access, and the northbound Khao Lak corridor.",
      alerts: [
        {
          id: "scenario-disaster-west",
          title: "West coast red-monsoon warning",
          severity: "intervene",
          area: "Patong coast",
          summary:
            "Beach flag, surf, and short-burst runoff conditions need active command attention this morning.",
          lat: 7.8964,
          lng: 98.2961,
          issuedAt: generatedAt,
          source: "Scenario / TMD / NDWC",
        },
        {
          id: "scenario-disaster-airport",
          title: "Airport transfer flooding watch",
          severity: "watch",
          area: "Airport corridor",
          summary:
            "Transfer reliability is vulnerable to runoff and standing water along the airport approach.",
          lat: 8.1132,
          lng: 98.3169,
          issuedAt: generatedAt,
          source: "Scenario / TMD / NDWC",
        },
        {
          id: "scenario-disaster-khaolak",
          title: "Khao Lak coastal runoff alert",
          severity: "watch",
          area: "Khao Lak",
          summary:
            "Coach access and beachfront posture north of Phuket need tighter monsoon watchstanding.",
          lat: 8.6367,
          lng: 98.2487,
          issuedAt: generatedAt,
          source: "Scenario / TMD / NDWC",
        },
      ],
      layers: buildDisasterLayers(),
      rainfallNodes: 7,
      sources: ["Scenario / TMD / NDWC", "GISTDA layer catalog", "Rainfall fallback"],
    };
  }

  if (scenario === "tourism-surge-weekend") {
    return {
      generatedAt,
      posture: "watch",
      summary:
        "Weather risk is manageable, but isolated runoff and surf advisories still need to stay in the governor picture while visitor load climbs.",
      alerts: [
        {
          id: "scenario-disaster-weekend-west",
          title: "Residual surf caution",
          severity: "watch",
          area: "Patong coast",
          summary:
            "West-coast beaches are open but still need visible safety messaging during peak visitor hours.",
          lat: 7.8964,
          lng: 98.2961,
          issuedAt: generatedAt,
          source: "Scenario / TMD / NDWC",
        },
      ],
      layers: buildDisasterLayers(),
      rainfallNodes: 4,
      sources: ["Scenario / TMD / NDWC", "GISTDA layer catalog", "Rainfall fallback"],
    };
  }

  return {
    generatedAt,
    posture: "stable",
    summary:
      "Disaster posture has eased back to routine watch, with only light residual weather monitoring needed.",
    alerts: [
      {
        id: "scenario-disaster-recovery",
        title: "Recovery watch remains active",
        severity: "stable",
        area: "Island-wide",
        summary:
          "Residual weather awareness remains useful, but active warning pressure has subsided.",
        lat: PHUKET_CENTER[1],
        lng: PHUKET_CENTER[0],
        issuedAt: generatedAt,
        source: "Scenario / TMD / NDWC",
      },
    ],
    layers: buildDisasterLayers(),
    rainfallNodes: 3,
    sources: ["Scenario / TMD / NDWC", "GISTDA layer catalog", "Rainfall fallback"],
  };
}

async function fetchTmdDisasterAlerts() {
  const payloadText = await fetchTextWithTimeout(TMD_WARNING_URL);

  if (!payloadText) {
    return [
      {
        id: "tmd-fallback-1",
        title: "Andaman monsoon watch",
        severity: "watch" as const,
        area: "Patong coast",
        summary:
          "TMD fallback wording keeps west-coast beach safety and rough-sea awareness on watch.",
        lat: 7.8964,
        lng: 98.2961,
        issuedAt: new Date().toISOString(),
        source: "TMD Open Data fallback",
      },
      {
        id: "tmd-fallback-2",
        title: "Northbound runoff watch",
        severity: "watch" as const,
        area: "Khao Lak",
        summary:
          "Rainfall fallback keeps coach access and beach safety north of Phuket under watch.",
        lat: 8.6367,
        lng: 98.2487,
        issuedAt: new Date().toISOString(),
        source: "TMD Open Data fallback",
      },
    ] satisfies DisasterAlert[];
  }

  const payload = safeJsonParse(payloadText) ?? payloadText;
  const entries = uniqueStrings(
    flattenTextEntries(payload)
      .filter((entry) =>
        /phuket|patong|kata|karon|ao nang|krabi|phang nga|khao lak|airport|andaman|ภูเก็ต|กระบี่|พังงา/i.test(
          entry,
        ),
      )
      .map((entry) => entry.slice(0, 220)),
  ).slice(0, 6);

  if (entries.length === 0) {
    return [
      {
        id: "tmd-fallback-1",
        title: "Andaman monsoon watch",
        severity: "watch" as const,
        area: "Patong coast",
        summary:
          "TMD fallback wording keeps west-coast beach safety and rough-sea awareness on watch.",
        lat: 7.8964,
        lng: 98.2961,
        issuedAt: new Date().toISOString(),
        source: "TMD Open Data fallback",
      },
      {
        id: "tmd-fallback-2",
        title: "Northbound runoff watch",
        severity: "watch" as const,
        area: "Khao Lak",
        summary:
          "Rainfall fallback keeps coach access and beach safety north of Phuket under watch.",
        lat: 8.6367,
        lng: 98.2487,
        issuedAt: new Date().toISOString(),
        source: "TMD Open Data fallback",
      },
    ] satisfies DisasterAlert[];
  }

  return entries.map((entry, index) => {
    const area = findAreaMatch(entry);

    return {
      id: `tmd-alert-${index + 1}`,
      title: entry.split(".")[0] || "TMD warning",
      severity: statusFromWeatherText(entry),
      area: area.label,
      summary: entry,
      lat: area.center[1],
      lng: area.center[0],
      issuedAt: new Date().toISOString(),
      source: "TMD Open Data",
    } satisfies DisasterAlert;
  });
}

function extractFeatureCoordinates(item: Record<string, unknown>) {
  const geometry =
    typeof item.geometry === "object" && item.geometry !== null
      ? (item.geometry as Record<string, unknown>)
      : null;
  const coordinates = Array.isArray(geometry?.coordinates)
    ? geometry.coordinates
    : null;

  if (coordinates?.length && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    return {
      lng: coordinates[0] as number,
      lat: coordinates[1] as number,
    };
  }

  const lat =
    parseNumber(item.lat) ??
    parseNumber(item.latitude) ??
    parseNumber(item.y) ??
    parseNumber(item.Y);
  const lng =
    parseNumber(item.lng) ??
    parseNumber(item.lon) ??
    parseNumber(item.longitude) ??
    parseNumber(item.x) ??
    parseNumber(item.X);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

async function fetchGistdaDisasterAlerts() {
  const url = process.env.GISTDA_DISASTER_FEED_URL;

  if (!url) {
    return [];
  }

  const payload = await fetchJsonWithTimeout<unknown>(url, undefined, 9000);
  const objects = extractObjectList(payload);

  return objects
    .flatMap((item, index): DisasterAlert[] => {
      const position = extractFeatureCoordinates(item);
      const rawTitle =
        typeof item.title === "string"
          ? item.title
          : typeof item.name === "string"
            ? item.name
            : typeof item.event === "string"
              ? item.event
              : "GISTDA alert";
      const summary =
        typeof item.summary === "string"
          ? item.summary
          : typeof item.description === "string"
            ? item.description
            : rawTitle;

      if (!position) {
        return [];
      }

      const area = findAreaMatch(`${rawTitle} ${summary}`);

      return [
        {
          id: `gistda-alert-${index + 1}`,
          title: rawTitle,
          severity:
            typeof item.severity === "string"
              ? statusFromWeatherText(item.severity)
              : statusFromWeatherText(`${rawTitle} ${summary}`),
          area: area.label,
          summary: stripHtml(summary).slice(0, 220),
          lat: position.lat,
          lng: position.lng,
          issuedAt:
            typeof item.updatedAt === "string"
              ? item.updatedAt
              : typeof item.timestamp === "string"
                ? item.timestamp
                : new Date().toISOString(),
          source: "GISTDA Disaster API",
          url: typeof item.url === "string" ? item.url : undefined,
        } satisfies DisasterAlert,
      ];
    })
    .filter((item) =>
      item.lat >= ANDAMAN_BOUNDS.minLat &&
      item.lat <= ANDAMAN_BOUNDS.maxLat &&
      item.lng >= ANDAMAN_BOUNDS.minLng &&
      item.lng <= ANDAMAN_BOUNDS.maxLng,
    )
    .slice(0, 6);
}

export async function loadDisasterFeed(
  options: WarRoomOptions = {},
): Promise<DisasterFeedResponse> {
  const scenario = resolveScenario(options.scenario);

  if (scenario !== "live") {
    return buildScenarioDisasterFeed(scenario);
  }

  const [tmdAlerts, gistdaAlerts] = await Promise.all([
    fetchTmdDisasterAlerts(),
    fetchGistdaDisasterAlerts(),
  ]);
  const alerts = [...gistdaAlerts, ...tmdAlerts]
    .sort((left, right) => STATUS_WEIGHT[right.severity] - STATUS_WEIGHT[left.severity])
    .slice(0, 8);
  const posture = topStatus(alerts.map((alert) => alert.severity));
  const configuredLayers = buildDisasterLayers();

  return {
    generatedAt: new Date().toISOString(),
    posture,
    summary:
      posture === "intervene"
        ? `Disaster posture is elevated across Phuket-linked corridors with ${alerts.filter((alert) => alert.severity !== "stable").length} active warnings to clear today.`
        : posture === "watch"
          ? `Weather and warning posture is elevated but manageable with targeted checks across beaches, piers, and northbound access.`
          : `Disaster posture is broadly steady with only light warning pressure in the Phuket-Andaman operating area.`,
    alerts,
    layers: configuredLayers,
    rainfallNodes: fallbackRainfall.length,
    sources: uniqueStrings([
      ...alerts.map((alert) => alert.source),
      ...configuredLayers.map((layer) => layer.source),
      "Rainfall fallback",
    ]),
  };
}

function buildScenarioMaritimeSecurity(
  scenario: Exclude<GovernorScenarioId, "live">,
): MaritimeSecurityResponse {
  const generatedAt = new Date().toISOString();
  const provider =
    scenario === "tourism-surge-weekend"
      ? "Scenario / MarineTraffic"
      : "Scenario / AIS";
  const vessels: MaritimeVessel[] =
    scenario === "red-monsoon-day"
      ? [
          {
            id: "scenario-patrol-west",
            name: "West Coast Patrol",
            type: "patrol",
            lat: 7.89,
            lng: 98.28,
            speedKnots: 9,
            heading: 145,
            lastSeen: generatedAt,
            flag: "TH",
            destination: "Patong coast",
            status: "watch",
            source: provider,
            strategicNote:
              "Harbor and patrol posture is active on the west coast while passenger departures slow under monsoon conditions.",
          },
          {
            id: "scenario-rassada-ferry",
            name: "Rassada Ferry 12",
            type: "ferry",
            lat: 7.876,
            lng: 98.416,
            speedKnots: 0.6,
            heading: 52,
            lastSeen: generatedAt,
            flag: "TH",
            destination: "Phi Phi",
            status: "watch",
            source: provider,
            strategicNote:
              "Queued ferry posture should be checked against weather controls before departures resume.",
          },
        ]
      : scenario === "tourism-surge-weekend"
        ? [
            {
              id: "scenario-rassada-density",
              name: "Phi Phi Ferry Cluster",
              type: "ferry",
              lat: 7.879,
              lng: 98.422,
              speedKnots: 1.2,
              heading: 70,
              lastSeen: generatedAt,
              flag: "TH",
              destination: "Phi Phi",
              status: "intervene",
              source: provider,
              strategicNote:
                "Pier density is strong enough to affect passenger holding, bus timing, and crowd optics.",
            },
            {
              id: "scenario-ao-nang-longtail",
              name: "Ao Nang Longtail Apron",
              type: "passenger",
              lat: 8.029,
              lng: 98.821,
              speedKnots: 2.8,
              heading: 182,
              lastSeen: generatedAt,
              flag: "TH",
              destination: "Ao Nang",
              status: "watch",
              source: provider,
              strategicNote:
                "Krabi-side apron pressure can spill into Phuket tour timing and return-lane reliability.",
            },
            {
              id: "scenario-ao-po-yacht",
              name: "Ao Po Anchorage",
              type: "passenger",
              lat: 8.073,
              lng: 98.46,
              speedKnots: 1.9,
              heading: 18,
              lastSeen: generatedAt,
              flag: "SG",
              destination: "Ao Po Marina",
              status: "watch",
              source: provider,
              strategicNote:
                "Anchorage pressure is elevated enough to justify a quick marina-density check.",
            },
          ]
        : [
            {
              id: "scenario-stable-ferry",
              name: "Andaman Ferry Lane",
              type: "ferry",
              lat: 7.9,
              lng: 98.46,
              speedKnots: 11,
              heading: 88,
              lastSeen: generatedAt,
              flag: "TH",
              destination: "Phi Phi",
              status: "stable",
              source: provider,
              strategicNote:
                "Ferry flow has returned to a manageable rhythm with no abnormal queue behavior visible.",
            },
          ];

  return {
    generatedAt,
    posture: topStatus(vessels.map((vessel) => vessel.status)),
    summary:
      scenario === "tourism-surge-weekend"
        ? "AIS posture points to ferry-lane density and pier queue pressure as the maritime watch lead."
        : scenario === "red-monsoon-day"
          ? "Maritime posture is being driven more by weather control than by suspicious vessel movement."
          : "Tracked vessel posture is steady with no visible maritime security spike.",
    provider,
    vessels,
    chokepoints: [
      "Rassada - Phi Phi lane",
      "Chalong departures",
      "Ao Po anchorage",
      "Ao Nang longtail apron",
      "Khao Lak coastal approaches",
    ],
    sources: [provider],
  };
}

function buildFallbackMaritimeVessels(provider: string, generatedAt: string) {
  return [
    {
      id: "fallback-rassada-ferry",
      name: "Rassada Ferry 07",
      type: "ferry",
      lat: 7.8795,
      lng: 98.4213,
      speedKnots: 1.1,
      heading: 78,
      lastSeen: generatedAt,
      flag: "TH",
      destination: "Phi Phi",
      source: provider,
      strategicNote:
        "Use this lane to read ferry density and whether queueing is building into island access pressure.",
    },
    {
      id: "fallback-ao-po-anchorage",
      name: "Ao Po Marina Anchorage",
      type: "passenger",
      lat: 8.0708,
      lng: 98.459,
      speedKnots: 2.4,
      heading: 10,
      lastSeen: generatedAt,
      flag: "SG",
      destination: "Ao Po Marina",
      source: provider,
      strategicNote:
        "Anchorage pressure at Ao Po is a good proxy for premium marine tourism tempo and marina congestion.",
    },
    {
      id: "fallback-patong-patrol",
      name: "West Beach Patrol",
      type: "patrol",
      lat: 7.898,
      lng: 98.286,
      speedKnots: 12.3,
      heading: 164,
      lastSeen: generatedAt,
      flag: "TH",
      destination: "Patong coast",
      source: provider,
      strategicNote:
        "Patrol presence supports beach-safety enforcement and visible reassurance during rough-sea periods.",
    },
    {
      id: "fallback-khaolak-fishing",
      name: "Unknown Fishing Contact",
      type: "fishing",
      lat: 8.611,
      lng: 98.198,
      speedKnots: 1.5,
      heading: 232,
      lastSeen: generatedAt,
      flag: null,
      destination: "Khao Lak coast",
      source: provider,
      strategicNote:
        "Slow movement near the northbound coast is worth checking for loitering or unplanned small-boat activity.",
    },
    {
      id: "fallback-ao-nang-passenger",
      name: "Ao Nang Passenger Run",
      type: "passenger",
      lat: 8.031,
      lng: 98.826,
      speedKnots: 6.4,
      heading: 95,
      lastSeen: generatedAt,
      flag: "TH",
      destination: "Ao Nang",
      source: provider,
      strategicNote:
        "Ao Nang movement is a useful proxy for Krabi-side tour tempo feeding Phuket's shared visitor ecosystem.",
    },
  ].map((vessel) => ({
    ...vessel,
    status: statusFromVessel(vessel),
  })) satisfies MaritimeVessel[];
}

async function fetchMaritimeVessels() {
  const marineTrafficUrl = process.env.MARINETRAFFIC_API_URL;
  const marineTrafficKey = process.env.MARINETRAFFIC_API_KEY;
  const aishubUrl = process.env.AISHUB_API_URL;
  const aishubKey = process.env.AISHUB_API_KEY;
  const provider = marineTrafficUrl
    ? "MarineTraffic AIS"
    : aishubUrl
      ? "AISHub"
      : "Fallback AIS pattern model";
  const url = marineTrafficUrl || aishubUrl;
  const apiKey = marineTrafficKey || aishubKey;

  if (!url) {
    return {
      provider,
      vessels: buildFallbackMaritimeVessels(provider, new Date().toISOString()),
    };
  }

  const payload = await fetchJsonWithTimeout<unknown>(
    url,
    apiKey
      ? {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "x-api-key": apiKey,
            apikey: apiKey,
          },
        }
      : undefined,
    10000,
  );
  const objects = extractObjectList(payload);
  const generatedAt = new Date().toISOString();
  const vessels = objects
    .flatMap((item, index): MaritimeVessel[] => {
      const position = extractFeatureCoordinates(item);

      if (!position) {
        return [];
      }

      const speedKnots =
        parseNumber(item.speedKnots) ??
        parseNumber(item.sog) ??
        parseNumber(item.speed) ??
        0;
      const name =
        typeof item.name === "string"
          ? item.name
          : typeof item.shipname === "string"
            ? item.shipname
            : `Tracked vessel ${index + 1}`;
      const type =
        typeof item.type === "string"
          ? item.type
          : typeof item.shiptype === "string"
            ? item.shiptype
            : "unknown";
      const destination =
        typeof item.destination === "string" ? item.destination : null;
      const strategicNote =
        typeof item.note === "string"
          ? item.note
          : /ferry|passenger/i.test(type)
            ? "Passenger and ferry movement is useful for scoring Phuket-linked marine access pressure."
            : /fishing|unknown/i.test(type)
              ? "Slow or unclear movement should be checked against harbor visibility and operator plans."
              : "Tracked vessel contributes to the governor's maritime picture.";

      const vessel = {
        id:
          typeof item.id === "string"
            ? item.id
            : typeof item.mmsi === "string"
              ? item.mmsi
              : `${provider.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
        name,
        type,
        lat: position.lat,
        lng: position.lng,
        speedKnots,
        heading:
          parseNumber(item.heading) ??
          parseNumber(item.course) ??
          parseNumber(item.cog),
        lastSeen:
          typeof item.lastSeen === "string"
            ? item.lastSeen
            : typeof item.timestamp === "string"
              ? item.timestamp
              : generatedAt,
        flag:
          typeof item.flag === "string"
            ? item.flag
            : typeof item.country === "string"
              ? item.country
              : null,
        destination,
        status: "stable" as const,
        source: provider,
        strategicNote,
      } satisfies MaritimeVessel;

      return [{ ...vessel, status: statusFromVessel(vessel) }];
    })
    .filter(
      (vessel) =>
        vessel.lat >= ANDAMAN_BOUNDS.minLat &&
        vessel.lat <= ANDAMAN_BOUNDS.maxLat &&
        vessel.lng >= ANDAMAN_BOUNDS.minLng &&
        vessel.lng <= ANDAMAN_BOUNDS.maxLng,
    )
    .slice(0, 18);

  return {
    provider,
    vessels:
      vessels.length > 0
        ? vessels
        : buildFallbackMaritimeVessels(`${provider} fallback`, generatedAt),
  };
}

export async function loadMaritimeSecurity(
  options: WarRoomOptions = {},
): Promise<MaritimeSecurityResponse> {
  const scenario = resolveScenario(options.scenario);

  if (scenario !== "live") {
    return buildScenarioMaritimeSecurity(scenario);
  }

  const { provider, vessels } = await fetchMaritimeVessels();
  const posture = topStatus(vessels.map((vessel) => vessel.status));

  return {
    generatedAt: new Date().toISOString(),
    posture,
    summary:
      posture === "intervene"
        ? "AIS posture shows at least one vessel pattern or pier cluster that merits a governor-level cross-check today."
        : posture === "watch"
          ? "AIS posture is elevated around Phuket-linked ferry lanes, anchorages, or slower contacts."
          : "Tracked maritime movement looks routine across the governor's core Andaman watchline.",
    provider,
    vessels,
    chokepoints: [
      "Rassada - Phi Phi lane",
      "Chalong departures",
      "Ao Po anchorage",
      "Ao Nang longtail apron",
      "Khao Lak coastal approaches",
    ],
    sources: [provider],
  };
}

function buildScenarioTourismHotspots(
  scenario: Exclude<GovernorScenarioId, "live">,
): TourismHotspotsResponse {
  const generatedAt = new Date().toISOString();
  const provider = "Scenario / TAT";

  const hotspots: TourismHotspot[] =
    scenario === "tourism-surge-weekend"
      ? [
          {
            id: "scenario-patong",
            label: "Patong Beachfront",
            kind: "beach",
            lat: 7.8964,
            lng: 98.2961,
            area: "Patong",
            summary:
              "Patong is the lead tourism-pressure zone with beach, nightlife, and transfer demand rising together.",
            status: "intervene",
            source: provider,
            strategicNote:
              "Coordinate beach, nightlife, and transfer operators before queueing or density turns into the story.",
          },
          {
            id: "scenario-airport",
            label: "Airport Transfer Forecourt",
            kind: "attraction",
            lat: 8.1132,
            lng: 98.3169,
            area: "Airport corridor",
            summary:
              "Arrival banks are strong enough to shape the governor's access-and-tourism narrative.",
            status: "intervene",
            source: provider,
            strategicNote:
              "Transfer reliability and visible queue discipline matter as much as raw arrival volume.",
          },
          {
            id: "scenario-ao-nang",
            label: "Ao Nang Beachfront",
            kind: "beach",
            lat: 8.0323,
            lng: 98.8237,
            area: "Ao Nang",
            summary:
              "Ao Nang visitor load is elevated and can spill into Phuket tour routing and return timing.",
            status: "watch",
            source: provider,
            strategicNote:
              "Coordinate with Krabi-side operators early to smooth beach and boat turnover.",
          },
        ]
      : scenario === "red-monsoon-day"
        ? [
            {
              id: "scenario-west-beach-safety",
              label: "Patong Safety Zone",
              kind: "beach",
              lat: 7.8964,
              lng: 98.2961,
              area: "Patong",
              summary:
                "Tourism posture is being shaped more by weather safety than by pure crowding.",
              status: "watch",
              source: provider,
              strategicNote:
                "Tourism operators need safety-first messaging that still keeps the island narrative calm.",
            },
          ]
        : [
            {
              id: "scenario-old-town-recovery",
              label: "Phuket Old Town",
              kind: "old-town",
              lat: 7.884,
              lng: 98.3923,
              area: "Phuket Old Town",
              summary:
                "City-vibe posture is calm enough for recovery messaging rather than active intervention.",
              status: "stable",
              source: provider,
              strategicNote:
                "Use steady downtown activity as proof that the island has normalized.",
            },
          ];

  return {
    generatedAt,
    provider,
    summary:
      scenario === "tourism-surge-weekend"
        ? "TAT-style tourism posture is running hot in Patong and arrival-linked zones."
        : scenario === "red-monsoon-day"
          ? "Tourism pressure is secondary to weather messaging, but flagship visitor zones still need active safety framing."
          : "Tourism hotspots have cooled into a manageable recovery posture.",
    hotspots,
    sources: [provider],
  };
}

function buildFallbackTourismHotspots(provider: string): TourismHotspot[] {
  return [
    {
      id: "fallback-patong",
      label: "Patong Beachfront",
      kind: "beach",
      lat: 7.8964,
      lng: 98.2961,
      area: "Patong",
      summary:
        "Patong remains the lead tourism temperature read for the island's public-facing visitor economy.",
      status: "watch",
      source: provider,
      strategicNote:
        "Cross-check beach density, nightlife optics, and surf safety before shaping the governor's visitor message.",
    },
    {
      id: "fallback-old-town",
      label: "Phuket Old Town",
      kind: "old-town",
      lat: 7.884,
      lng: 98.3923,
      area: "Phuket Old Town",
      summary:
        "Old Town is a reliable read on civic mood, market activity, and whether local narrative is calm.",
      status: "stable",
      source: provider,
      strategicNote:
        "Use downtown tempo to separate island-wide issues from localized beach or airport noise.",
    },
    {
      id: "fallback-rassada",
      label: "Rassada Pier",
      kind: "pier",
      lat: 7.8799,
      lng: 98.4215,
      area: "Chalong / Rassada / Ao Po",
      summary:
        "Rassada is the cleanest tourism-and-marine crossover hotspot for passenger density and schedule reliability.",
      status: "watch",
      source: provider,
      strategicNote:
        "If this node gets messy, both tourism flow and governor optics deteriorate quickly.",
    },
    {
      id: "fallback-ao-nang",
      label: "Ao Nang Waterfront",
      kind: "beach",
      lat: 8.0323,
      lng: 98.8237,
      area: "Ao Nang",
      summary:
        "Ao Nang gives the war room a direct line of sight into Krabi-side tourism pressure affecting Phuket-linked operators.",
      status: "watch",
      source: provider,
      strategicNote:
        "Useful for reading longtail, beachfront, and cross-Andaman excursion tempo.",
    },
    {
      id: "fallback-khao-lak",
      label: "Khao Lak Resort Strip",
      kind: "attraction",
      lat: 8.6367,
      lng: 98.2487,
      area: "Khao Lak",
      summary:
        "Khao Lak is a northbound tourism and coach-access proxy that matters when weather or road pressure rises.",
      status: "stable",
      source: provider,
      strategicNote:
        "When this strip turns noisy, it usually reflects broader Phang Nga access stress rather than isolated resort issues.",
    },
  ];
}

async function fetchTatHotspots() {
  const url = process.env.TAT_DATA_API_URL;
  const apiKey = process.env.TAT_DATA_API_KEY;
  const provider = url ? "TAT Data API" : "Curated TAT / governor fallback";

  if (!url) {
    return {
      provider,
      hotspots: buildFallbackTourismHotspots(provider),
    };
  }

  const payload = await fetchJsonWithTimeout<unknown>(
    url,
    apiKey
      ? {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "x-api-key": apiKey,
            apikey: apiKey,
          },
        }
      : undefined,
    10000,
  );
  const objects = extractObjectList(payload);

  const hotspots = objects
    .flatMap((item, index): TourismHotspot[] => {
      const position =
        extractFeatureCoordinates(item) ??
        (() => {
          const text = `${item.name ?? ""} ${item.area ?? ""} ${item.address ?? ""}`;
          const area = findAreaMatch(text);
          return { lat: area.center[1], lng: area.center[0] };
        })();
      const label =
        typeof item.name === "string"
          ? item.name
          : typeof item.title === "string"
            ? item.title
            : `Tourism hotspot ${index + 1}`;
      const area =
        typeof item.area === "string" ? item.area : findAreaMatch(label).label;
      const summary =
        typeof item.description === "string"
          ? stripHtml(item.description)
          : typeof item.summary === "string"
            ? stripHtml(item.summary)
            : `${label} is part of Phuket's active visitor economy and worth watching in the governor view.`;
      const kind = /pier|marina|harbour|harbor/i.test(`${label} ${area}`)
        ? "pier"
        : /old town|market|town/i.test(`${label} ${area}`)
          ? "old-town"
          : /festival|event/i.test(`${label} ${area}`)
            ? "event"
            : /beach|bay|waterfront/i.test(`${label} ${area}`)
              ? "beach"
              : "attraction";
      const status = /patong|airport|bangla|rassada|ao nang/i.test(
        `${label} ${area}`.toLowerCase(),
      )
        ? "watch"
        : "stable";

      return [
        {
          id:
            typeof item.id === "string"
              ? item.id
              : `tat-hotspot-${index + 1}`,
          label,
          kind,
          lat: position.lat,
          lng: position.lng,
          area,
          summary: summary.slice(0, 220),
          status,
          source: provider,
          url: typeof item.url === "string" ? item.url : undefined,
          strategicNote:
            typeof item.strategicNote === "string"
              ? item.strategicNote
              : `${label} is a useful tourism pressure proxy for governor briefing and corridor scoring.`,
        } satisfies TourismHotspot,
      ];
    })
    .slice(0, 12);

  return {
    provider,
    hotspots:
      hotspots.length > 0
        ? hotspots
        : buildFallbackTourismHotspots(`${provider} fallback`),
  };
}

export async function loadTourismHotspots(
  options: WarRoomOptions = {},
): Promise<TourismHotspotsResponse> {
  const scenario = resolveScenario(options.scenario);

  if (scenario !== "live") {
    return buildScenarioTourismHotspots(scenario);
  }

  const { provider, hotspots } = await fetchTatHotspots();
  const topHotspot =
    [...hotspots].sort((left, right) => STATUS_WEIGHT[right.status] - STATUS_WEIGHT[left.status])[0];

  return {
    generatedAt: new Date().toISOString(),
    provider,
    summary:
      topHotspot?.status === "intervene"
        ? `${topHotspot.label} is the lead tourism pressure zone and should shape today's tourism coordination.`
        : topHotspot?.status === "watch"
          ? `${topHotspot?.label ?? "Patong"} is the lead visitor-pressure zone, but conditions remain manageable with early operator coordination.`
          : "Tourism hotspots are active but broadly steady across Phuket and the near Andaman ring.",
    hotspots,
    sources: [provider],
  };
}

export function buildWarRoomSourceEntries({
  disaster,
  maritime,
  tourism,
}: {
  disaster: DisasterFeedResponse;
  maritime: MaritimeSecurityResponse;
  tourism: TourismHotspotsResponse;
}): ApiSourceEntry[] {
  const checkedAt = new Date().toISOString();
  const gistdaConfigured = disaster.layers.some(
    (layer) => layer.source.startsWith("GISTDA") && layer.configured,
  );
  const tatLive = tourism.provider.includes("TAT Data API");
  const maritimeLive =
    maritime.provider.includes("MarineTraffic") || maritime.provider.includes("AISHub");

  return [
    {
      id: "war-room-gistda",
      label: "GISTDA Disaster Platform",
      url: disaster.layers.find((layer) => layer.id === "gistda-disaster-api")?.url ??
        DEFAULT_GISTDA_PORTAL_URL,
      kind: "external",
      target: "GISTDA",
      health: gistdaConfigured ? "live" : "stale",
      checkedAt,
    },
    {
      id: "war-room-nsdc",
      label: "GISTDA NSDC / STAC",
      url: disaster.layers.find((layer) => layer.id === "gistda-nsdc-stac")?.url ??
        DEFAULT_GISTDA_NSDC_URL,
      kind: "external",
      target: "GISTDA NSDC",
      health: gistdaConfigured ? "live" : "offline",
      checkedAt,
    },
    {
      id: "war-room-tmd",
      label: "TMD / NDWC Alerts",
      url: disaster.layers.find((layer) => layer.id === "tmd-ndwc-cap")?.url ??
        TMD_WARNING_URL,
      kind: "external",
      target: "TMD / NDWC",
      health: disaster.alerts.length > 0 ? "live" : "stale",
      checkedAt,
    },
    {
      id: "war-room-maritime-ais",
      label: maritime.provider,
      url:
        process.env.MARINETRAFFIC_API_URL ||
        process.env.AISHUB_API_URL ||
        "https://www.aishub.net/api",
      kind: "external",
      target: maritime.provider,
      health: maritimeLive ? "live" : maritime.vessels.length > 0 ? "stale" : "offline",
      checkedAt,
    },
    {
      id: "war-room-tat",
      label: "TAT Data API",
      url: process.env.TAT_DATA_API_URL || DEFAULT_TAT_PORTAL_URL,
      kind: "external",
      target: "Tourism Authority of Thailand",
      health: tatLive ? "live" : tourism.hotspots.length > 0 ? "stale" : "offline",
      checkedAt,
    },
    {
      id: "war-room-gdelt",
      label: "GDELT DOC 2",
      url: DEFAULT_GDELT_URL,
      kind: "external",
      target: "GDELT",
      health: "live",
      checkedAt,
    },
    {
      id: "war-room-google-trends",
      label: "Google Trends RSS TH",
      url: DEFAULT_GOOGLE_TRENDS_URL,
      kind: "external",
      target: "Google Trends",
      health: "live",
      checkedAt,
    },
    {
      id: "war-room-data-go-th",
      label: "data.go.th CKAN",
      url: process.env.DATA_GO_TH_CKAN_URL || DEFAULT_DATA_GO_TH_URL,
      kind: "external",
      target: "Thailand Open Data",
      health: process.env.DATA_GO_TH_CKAN_URL ? "live" : "stale",
      checkedAt,
    },
  ];
}

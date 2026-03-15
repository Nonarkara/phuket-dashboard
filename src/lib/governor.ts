import { LIVE_TV_CHANNELS } from "./live-tv-channels";
import {
  CITY_ZONES,
  GOVERNOR_CORRIDORS,
  MARINE_POINTS,
  textMatchesAliases,
} from "./governor-config";
import { fallbackIncidents } from "./mock-data";
import { phuketPublicCameras } from "./public-cameras";
import { loadThailandIncidents } from "./thailand-monitor";
import {
  loadDisasterFeed,
  loadMaritimeSecurity,
  loadTourismHotspots,
} from "./war-room-integrations";
import type {
  CityVibeCard,
  CityVibesResponse,
  DisasterAlert,
  DisasterFeedResponse,
  ExecutiveStatus,
  GovernorBrief,
  GovernorConcern,
  GovernorCorridorPriority,
  GovernorScenarioId,
  MaritimeSecurityResponse,
  MarineCorridorStatus,
  MarineStatusResponse,
  MediaWatchResponse,
  NarrativeSignal,
  PublicCamera,
  TourismHotspot,
  TourismHotspotsResponse,
} from "../types/dashboard";

const GOOGLE_TRENDS_RSS_TH = "https://trends.google.com/trending/rss?geo=TH";
const GDELT_QUERY =
  '("Phuket" OR "Patong" OR "Kata" OR "Karon" OR "Krabi" OR "Phang Nga" OR "Khao Lak" OR "Andaman")';
const TMD_WARNING_URL =
  "https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=api&ukey=api12345";
const OPENSKY_PHUKET_URL =
  "https://opensky-network.org/api/states/all?lamin=7.45&lomin=98.05&lamax=8.28&lomax=98.58";

interface GovernorDataOptions {
  scenario?: GovernorScenarioId | null;
}

interface AirspacePressure {
  count: number;
  status: ExecutiveStatus;
  summary: string;
  updatedAt: string;
  sources: string[];
}

type MediaWatchOptions = GovernorDataOptions;

interface CityVibeOptions extends GovernorDataOptions {
  marine?: MarineStatusResponse;
  mediaWatch?: MediaWatchResponse;
  airspace?: AirspacePressure;
  incidents?: typeof fallbackIncidents;
}

const STATUS_PRIORITY: Record<ExecutiveStatus, number> = {
  intervene: 3,
  watch: 2,
  stable: 1,
};

function resolveScenario(value?: string | null): GovernorScenarioId {
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

function statusLabel(status: ExecutiveStatus) {
  if (status === "intervene") return "intervene";
  if (status === "watch") return "watch";
  return "stable";
}

function statusFromScore(score: number): ExecutiveStatus {
  if (score >= 72) return "intervene";
  if (score >= 44) return "watch";
  return "stable";
}

function compareByStatus<T extends { status: ExecutiveStatus }>(left: T, right: T) {
  return STATUS_PRIORITY[right.status] - STATUS_PRIORITY[left.status];
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMetric(value: number | null, suffix = "", digits = 1) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value.toFixed(digits)}${suffix}`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function matchAny(value: string, candidates: string[]) {
  return textMatchesAliases(value, candidates);
}

function getZoneLabel(text: string) {
  const zone =
    CITY_ZONES.find((item) => matchAny(text, item.aliases))?.label ?? "Island-wide";

  return zone;
}

function parseTrafficVolume(value: string) {
  const normalized = value.trim().toUpperCase();
  const amount = Number.parseFloat(normalized.replace(/[^0-9.]/g, "")) || 0;

  if (normalized.includes("M")) return amount * 1_000_000;
  if (normalized.includes("K")) return amount * 1_000;
  return amount;
}

function statusFromNarrativeVolume(value: string) {
  const parsed = parseTrafficVolume(value);
  if (parsed >= 120_000) return "intervene";
  if (parsed >= 30_000) return "watch";
  return "stable";
}

function narrativeWeight(status: ExecutiveStatus) {
  return STATUS_PRIORITY[status] * 10;
}

function inferMarineStatus({
  waveHeightMeters,
  windSpeedKph,
  gustSpeedKph,
  alerts,
}: Pick<
  MarineCorridorStatus,
  "waveHeightMeters" | "windSpeedKph" | "gustSpeedKph" | "alerts"
>): ExecutiveStatus {
  if (
    alerts.length > 0 ||
    (waveHeightMeters ?? 0) >= 2.6 ||
    (windSpeedKph ?? 0) >= 30 ||
    (gustSpeedKph ?? 0) >= 40
  ) {
    return "intervene";
  }

  if (
    (waveHeightMeters ?? 0) >= 1.6 ||
    (windSpeedKph ?? 0) >= 22 ||
    (gustSpeedKph ?? 0) >= 30
  ) {
    return "watch";
  }

  return "stable";
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "PhuketGovernorWarRoom/1.0",
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
        Accept: "application/json, text/xml, application/xml, text/plain, */*",
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

function flattenWarningEntries(value: unknown): string[] {
  if (typeof value === "string") {
    const text = stripHtml(value);
    return text.length >= 24 ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenWarningEntries);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(flattenWarningEntries);
}

async function fetchTmdWarnings() {
  const payloadText = await fetchTextWithTimeout(TMD_WARNING_URL);

  if (!payloadText) {
    return {
      entries: [
        "TMD monsoon watch remains in effect for Phuket, Phang Nga, and Krabi coastal waters.",
        "TMD rain advisory highlights short-burst runoff and rough-sea risk along the Andaman side.",
      ],
      source: "TMD Open Data fallback",
    };
  }

  const jsonPayload = safeJsonParse(payloadText);
  const entries = uniqueStrings(
    flattenWarningEntries(jsonPayload ?? payloadText)
      .filter((entry) =>
        /phuket|krabi|phang nga|andaman|ranong|ao nang|khao lak|ทะเลอันดามัน|ภูเก็ต|กระบี่|พังงา/i.test(
          entry,
        ),
      )
      .map((entry) => entry.slice(0, 220)),
  ).slice(0, 8);

  return {
    entries:
      entries.length > 0
        ? entries
        : [
            "TMD warning parsing fell back to baseline Andaman watch wording for Phuket-linked corridors.",
          ],
    source: "TMD Open Data",
  };
}

function buildDefaultMarineCorridors(updatedAt = new Date().toISOString()) {
  const baseValues: Record<
    string,
    { wave: number; swell: number; wind: number; gust: number; rain: number }
  > = {
    "patong-coast": { wave: 1.8, swell: 1.1, wind: 24, gust: 31, rain: 0.8 },
    "karon-beachfront": { wave: 1.9, swell: 1.2, wind: 25, gust: 32, rain: 1.1 },
    "kata-coast": { wave: 2.1, swell: 1.4, wind: 26, gust: 34, rain: 1.2 },
    "chalong-pier": { wave: 1.2, swell: 0.7, wind: 18, gust: 24, rain: 0.4 },
    "rassada-pier": { wave: 1.1, swell: 0.6, wind: 17, gust: 23, rain: 0.4 },
    "ao-po-marina": { wave: 1.0, swell: 0.6, wind: 16, gust: 22, rain: 0.4 },
    "phi-phi-corridor": { wave: 2.2, swell: 1.5, wind: 27, gust: 35, rain: 1.0 },
    "ao-nang-waterfront": { wave: 1.7, swell: 1.1, wind: 22, gust: 29, rain: 0.6 },
    "khao-lak-coast": { wave: 1.9, swell: 1.2, wind: 23, gust: 31, rain: 1.4 },
  };

  return MARINE_POINTS.map((point) => {
    const metrics = baseValues[point.id];
    const status = inferMarineStatus({
      waveHeightMeters: metrics.wave,
      windSpeedKph: metrics.wind,
      gustSpeedKph: metrics.gust,
      alerts: [],
    });

    return {
      id: point.id,
      label: point.label,
      locationLabel: point.locationLabel,
      focusArea: point.focusArea,
      center: point.center,
      status,
      summary:
        status === "intervene"
          ? `${point.label} is carrying rougher-than-baseline sea conditions for Phuket-linked operations.`
          : `${point.label} is inside routine monitoring bounds with manageable sea-state pressure.`,
      alertPosture:
        status === "intervene" ? "Rough sea and small-craft caution" : "Routine marine watch",
      waveHeightMeters: metrics.wave,
      swellHeightMeters: metrics.swell,
      windSpeedKph: metrics.wind,
      gustSpeedKph: metrics.gust,
      rainfallMm: metrics.rain,
      alerts: [],
      recommendedAction: point.defaultAction,
      sources: ["Open-Meteo Marine fallback", "Open-Meteo forecast fallback"],
      updatedAt,
    } satisfies MarineCorridorStatus;
  });
}

function applyMarineScenario(
  corridors: MarineCorridorStatus[],
  scenario: GovernorScenarioId,
) {
  if (scenario === "live") {
    return corridors;
  }

  return corridors.map((corridor) => {
    if (scenario === "red-monsoon-day") {
      if (
        [
          "patong-coast",
          "karon-beachfront",
          "kata-coast",
          "phi-phi-corridor",
          "ao-nang-waterfront",
          "khao-lak-coast",
        ].includes(corridor.id)
      ) {
        return {
          ...corridor,
          status: "intervene" as const,
          summary: `${corridor.label} is in red-monsoon posture with rough seas driving the lead executive risk.`,
          alertPosture: "Intervene now on small-craft and beach safety",
          waveHeightMeters: 3.1,
          swellHeightMeters: 2.2,
          windSpeedKph: 34,
          gustSpeedKph: 44,
          rainfallMm: 4.8,
          alerts: ["TMD rain-and-sea warning aligned to west coast and open-water exposure."],
        };
      }

      if (["chalong-pier", "rassada-pier", "ao-po-marina"].includes(corridor.id)) {
        return {
          ...corridor,
          status: "watch" as const,
          summary: `${corridor.label} stays operational but needs tighter pier discipline and departure timing.`,
          alertPosture: "Pier caution",
          waveHeightMeters: 1.7,
          swellHeightMeters: 1.1,
          windSpeedKph: 24,
          gustSpeedKph: 31,
          rainfallMm: 2.1,
        };
      }
    }

    if (scenario === "tourism-surge-weekend") {
      if (["chalong-pier", "rassada-pier", "ao-po-marina", "phi-phi-corridor"].includes(corridor.id)) {
        return {
          ...corridor,
          status: "watch" as const,
          summary: `${corridor.label} is weather-manageable, but ferry density and queue pressure are climbing.`,
          alertPosture: "High ferry density",
          waveHeightMeters: 1.3,
          swellHeightMeters: 0.8,
          windSpeedKph: 18,
          gustSpeedKph: 23,
          rainfallMm: 0.3,
        };
      }
    }

    if (scenario === "stable-recovery-day") {
      return {
        ...corridor,
        status: "stable" as const,
        summary: `${corridor.label} is back inside a manageable operating envelope with only light marine pressure.`,
        alertPosture: "Recovery watch",
        waveHeightMeters: 0.9,
        swellHeightMeters: 0.6,
        windSpeedKph: 14,
        gustSpeedKph: 19,
        rainfallMm: 0.1,
        alerts: [],
      };
    }

    return corridor;
  });
}

async function fetchLiveMarineCorridors() {
  const tmd = await fetchTmdWarnings();
  const tmdWarnings = tmd.entries;

  const liveCorridors = await Promise.all(
    MARINE_POINTS.map(async (point) => {
      const [marinePayload, weatherPayload] = await Promise.all([
        fetchJsonWithTimeout<{
          current?: {
            wave_height?: number;
            swell_wave_height?: number;
            wind_wave_height?: number;
          };
        }>(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${point.center[1]}&longitude=${point.center[0]}&current=wave_height,swell_wave_height,wind_wave_height&forecast_days=1&timezone=Asia%2FBangkok`,
        ),
        fetchJsonWithTimeout<{
          current?: {
            wind_speed_10m?: number;
            wind_gusts_10m?: number;
            precipitation?: number;
          };
        }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${point.center[1]}&longitude=${point.center[0]}&current=wind_speed_10m,wind_gusts_10m,precipitation&forecast_days=1&timezone=Asia%2FBangkok`,
        ),
      ]);

      const waveHeightMeters =
        marinePayload?.current?.wave_height ??
        marinePayload?.current?.wind_wave_height ??
        null;
      const swellHeightMeters = marinePayload?.current?.swell_wave_height ?? null;
      const windSpeedKph = weatherPayload?.current?.wind_speed_10m ?? null;
      const gustSpeedKph = weatherPayload?.current?.wind_gusts_10m ?? null;
      const rainfallMm = weatherPayload?.current?.precipitation ?? null;
      const alerts = tmdWarnings.filter((warning) =>
        matchAny(warning, point.aliases),
      );

      if (
        waveHeightMeters === null &&
        swellHeightMeters === null &&
        windSpeedKph === null &&
        gustSpeedKph === null
      ) {
        return null;
      }

      const status = inferMarineStatus({
        waveHeightMeters,
        windSpeedKph,
        gustSpeedKph,
        alerts,
      });

      return {
        id: point.id,
        label: point.label,
        locationLabel: point.locationLabel,
        focusArea: point.focusArea,
        center: point.center,
        status,
        summary:
          status === "intervene"
            ? `${point.label} is pushing rough-sea or warning-driven pressure into Phuket's operating day.`
            : status === "watch"
              ? `${point.label} needs active watch for sea-state, swell, or launch-window discipline.`
              : `${point.label} is broadly manageable with light watchstanding only.`,
        alertPosture:
          status === "intervene"
            ? "High caution"
            : status === "watch"
              ? "Heightened watch"
              : "Routine watch",
        waveHeightMeters,
        swellHeightMeters,
        windSpeedKph,
        gustSpeedKph,
        rainfallMm,
        alerts,
        recommendedAction: point.defaultAction,
        sources: uniqueStrings(["Open-Meteo Marine", "Open-Meteo forecast", tmd.source]),
        updatedAt: new Date().toISOString(),
      } satisfies MarineCorridorStatus;
    }),
  );

  return liveCorridors.filter((corridor): corridor is MarineCorridorStatus => Boolean(corridor));
}

export async function loadMarineStatus(
  options: GovernorDataOptions = {},
): Promise<MarineStatusResponse> {
  const scenario = resolveScenario(options.scenario);
  const liveCorridors = await fetchLiveMarineCorridors();
  const baseCorridors =
    liveCorridors.length > 0
      ? liveCorridors
      : buildDefaultMarineCorridors(new Date().toISOString());
  const corridors = applyMarineScenario(baseCorridors, scenario).sort(compareByStatus);

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    corridors,
    sources: uniqueStrings(corridors.flatMap((corridor) => corridor.sources)),
    upgrades: [
      "Add AISHub or MarineTraffic to score Phuket ferry lanes and anchorage pressure.",
      "Keep premium AIS and scheduled-arrivals feeds optional until the governor wants SLA-grade depth.",
    ],
  };
}

function buildFallbackTalkSignals(observedAt = new Date().toISOString()) {
  return [
    {
      id: "talk-phuket-weather",
      kind: "talk" as const,
      title: "Phuket weather and surf safety",
      zone: "Patong",
      status: "watch" as const,
      summary: "Search attention is leaning toward waves, rain, and practical beach safety.",
      volumeLabel: "120K+",
      source: "Google Trends TH fallback",
      observedAt,
    },
    {
      id: "talk-airport-arrivals",
      kind: "talk" as const,
      title: "Phuket airport arrivals",
      zone: "Airport corridor",
      status: "watch" as const,
      summary: "Transfer logistics and arrival timing remain a visible public topic.",
      volumeLabel: "60K+",
      source: "Google Trends TH fallback",
      observedAt,
    },
    {
      id: "talk-bangla-crowds",
      kind: "talk" as const,
      title: "Patong crowd vibe",
      zone: "Patong",
      status: "stable" as const,
      summary: "Patong's crowd temperature is active but not yet narrative-dominant.",
      volumeLabel: "18K+",
      source: "Google Trends TH fallback",
      observedAt,
    },
  ];
}

async function fetchGoogleTrendSignals() {
  const xml = await fetchTextWithTimeout(GOOGLE_TRENDS_RSS_TH);
  if (!xml) {
    return buildFallbackTalkSignals();
  }

  const itemRegex = /<item>[\s\S]*?<\/item>/g;
  const observedAt = new Date().toISOString();
  const items: NarrativeSignal[] = [];
  let match: RegExpExecArray | null;

  match = itemRegex.exec(xml);

  while (match) {
    const itemXml = match[0];
    const title =
      itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      itemXml.match(/<title>(.*?)<\/title>/)?.[1] ??
      "";
    const traffic =
      itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] ??
      "10K+";

    if (
      !title ||
      !/phuket|patong|kata|karon|krabi|ao nang|phang nga|khao lak|airport|pier|ferry|monsoon|storm|beach|ทะเล|ภูเก็ต|กระบี่|พังงา/i.test(
        title,
      )
    ) {
      match = itemRegex.exec(xml);
      continue;
    }

    items.push({
      id: `talk-${items.length + 1}`,
      kind: "talk",
      title,
      zone: getZoneLabel(title),
      status: statusFromNarrativeVolume(traffic),
      summary: "This topic is actively surfacing in Thailand's public search conversation.",
      volumeLabel: traffic,
      source: "Google Trends TH",
      observedAt,
    });

    match = itemRegex.exec(xml);
  }

  return items.length > 0 ? items.slice(0, 8) : buildFallbackTalkSignals(observedAt);
}

function buildFallbackShareSignals(observedAt = new Date().toISOString()) {
  return [
    {
      id: "share-marine-warning",
      kind: "share" as const,
      title: "Andaman surf warnings lead Phuket-linked sharing",
      zone: "Patong",
      status: "watch" as const,
      summary: "Shared headlines are leaning toward practical weather and sea access guidance.",
      volumeLabel: "Regional share",
      source: "GDELT fallback",
      observedAt,
      url: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    },
    {
      id: "share-tourism-weekend",
      kind: "share" as const,
      title: "Visitor flow stories keep Patong and airport traffic visible",
      zone: "Airport corridor",
      status: "stable" as const,
      summary: "Tourism demand is present in shared coverage without overt panic framing.",
      volumeLabel: "Cross-platform share",
      source: "GDELT fallback",
      observedAt,
      url: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    },
  ];
}

async function fetchGdeltSignals() {
  const payload = await fetchJsonWithTimeout<{
    articles?: Array<{
      title?: string;
      url?: string;
      domain?: string;
      seendate?: string;
      sourcecountry?: string;
    }>;
  }>(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
      GDELT_QUERY,
    )}&mode=ArtList&format=json&maxrecords=10&sort=datedesc&timespan=7days`,
  );

  if (!payload?.articles?.length) {
    return buildFallbackShareSignals();
  }

  const signals = payload.articles
    .flatMap((article, index): NarrativeSignal[] => {
      if (!article.title || !article.url) {
        return [];
      }

      const title = stripHtml(article.title);
      const source =
        article.domain || article.sourcecountry || "GDELT article signal";
      const status = /warning|storm|flood|rough|closure|alert|accident|crash/i.test(title)
        ? "watch"
        : "stable";

      return [
        {
          id: `share-${index + 1}`,
          kind: "share",
          title,
          zone: getZoneLabel(title),
          status,
          summary: `Shared coverage is clustering around ${source}.`,
          volumeLabel: article.sourcecountry
            ? `Shared via ${article.sourcecountry}`
            : "Shared article",
          source: source.toUpperCase(),
          observedAt: article.seendate
            ? new Date(article.seendate).toISOString()
            : new Date().toISOString(),
          url: article.url,
        },
      ];
    })
    .slice(0, 6);

  return signals.length > 0 ? signals : buildFallbackShareSignals();
}

function buildBroadcastSignals(
  talkSignals: NarrativeSignal[],
  shareSignals: NarrativeSignal[],
  scenario: GovernorScenarioId,
) {
  const topZone =
    talkSignals[0]?.zone ?? shareSignals[0]?.zone ?? "Island-wide";
  const strongestStatus =
    [...talkSignals, ...shareSignals].sort(compareByStatus)[0]?.status ?? "stable";
  const observedAt = new Date().toISOString();

  if (scenario === "red-monsoon-day") {
    return [
      {
        id: "broadcast-weather-wall",
        kind: "broadcast" as const,
        title: "TV wall should verify marine-warning framing before governor messaging",
        zone: "Patong",
        status: "watch" as const,
        summary: "Live channels can quickly confirm whether rough-sea clips are overtaking the public narrative.",
        volumeLabel: "6 live channels",
        source: "Thailand TV wall",
        observedAt,
      },
    ];
  }

  return LIVE_TV_CHANNELS.slice(0, 3).map((channel, index) => ({
    id: `broadcast-${channel.code.toLowerCase()}`,
    kind: "broadcast" as const,
    title:
      index === 0
        ? `TV wall focus: ${topZone}`
        : `${channel.name} is ready to validate Phuket-linked share spikes`,
    zone: topZone,
    status: strongestStatus,
    summary: channel.watchFocus,
    volumeLabel: "Live wall",
    source: channel.name,
    observedAt,
  }));
}

function scenarioMediaWatch(scenario: GovernorScenarioId): MediaWatchResponse | null {
  const generatedAt = new Date().toISOString();

  if (scenario === "red-monsoon-day") {
    const talk = [
      {
        id: "scenario-talk-1",
        kind: "talk" as const,
        title: "Phuket red-monsoon waves",
        zone: "Patong",
        status: "intervene" as const,
        summary: "Search attention is concentrated on rough seas, beach flags, and whether departures should be delayed.",
        volumeLabel: "220K+",
        source: "Scenario / Google Trends TH",
        observedAt: generatedAt,
      },
      {
        id: "scenario-talk-2",
        kind: "talk" as const,
        title: "Phuket airport road flooding",
        zone: "Airport corridor",
        status: "watch" as const,
        summary: "Runoff and transfer reliability are rising into the public conversation.",
        volumeLabel: "80K+",
        source: "Scenario / Google Trends TH",
        observedAt: generatedAt,
      },
    ];

    const share = [
      {
        id: "scenario-share-1",
        kind: "share" as const,
        title: "Shared clips of rough surf are spreading faster than official context",
        zone: "Patong",
        status: "watch" as const,
        summary: "Shared video is outrunning the official explanation unless the governor message lands quickly.",
        volumeLabel: "Fast share velocity",
        source: "Scenario / GDELT",
        observedAt: generatedAt,
      },
    ];

    return {
      generatedAt,
      scenario,
      postureSummary:
        "Public conversation is leaning hard into waves, beach risk, and travel reliability. Lead with practical safety instructions.",
      peopleTalkAbout: talk,
      peopleShare: share,
      broadcastWatch: buildBroadcastSignals(talk, share, scenario),
      sources: ["Scenario / Google Trends TH", "Scenario / GDELT", "Thailand TV wall"],
    };
  }

  if (scenario === "tourism-surge-weekend") {
    const talk = [
      {
        id: "scenario-weekend-talk-1",
        kind: "talk" as const,
        title: "Phuket airport arrivals",
        zone: "Airport corridor",
        status: "intervene" as const,
        summary: "Arrival timing, transfers, and queue stress dominate the island's public chatter.",
        volumeLabel: "250K+",
        source: "Scenario / Google Trends TH",
        observedAt: generatedAt,
      },
      {
        id: "scenario-weekend-talk-2",
        kind: "talk" as const,
        title: "Bangla Road crowd vibe",
        zone: "Patong",
        status: "watch" as const,
        summary: "Patong's city vibe is running hot with nightlife and crowd-share interest rising together.",
        volumeLabel: "95K+",
        source: "Scenario / Google Trends TH",
        observedAt: generatedAt,
      },
    ];

    const share = [
      {
        id: "scenario-weekend-share-1",
        kind: "share" as const,
        title: "Weekend Phuket crowd clips are outpacing official tourism framing",
        zone: "Patong",
        status: "watch" as const,
        summary: "Shared posts highlight density, queueing, and 'packed island' framing.",
        volumeLabel: "High social share",
        source: "Scenario / GDELT",
        observedAt: generatedAt,
      },
    ];

    return {
      generatedAt,
      scenario,
      postureSummary:
        "Conversation is upbeat but crowded. Focus the governor line on smooth access, crowd management, and operator coordination.",
      peopleTalkAbout: talk,
      peopleShare: share,
      broadcastWatch: buildBroadcastSignals(talk, share, scenario),
      sources: ["Scenario / Google Trends TH", "Scenario / GDELT", "Thailand TV wall"],
    };
  }

  if (scenario === "stable-recovery-day") {
    const talk = [
      {
        id: "scenario-recovery-talk-1",
        kind: "talk" as const,
        title: "Phuket beach reopening and calm seas",
        zone: "Patong",
        status: "stable" as const,
        summary: "Public attention has shifted from disruption into reassurance and routine travel planning.",
        volumeLabel: "28K+",
        source: "Scenario / Google Trends TH",
        observedAt: generatedAt,
      },
    ];

    const share = [
      {
        id: "scenario-recovery-share-1",
        kind: "share" as const,
        title: "Shared coverage is moving back toward recovery and normal city vibe",
        zone: "Phuket Old Town",
        status: "stable" as const,
        summary: "The dominant share pattern is calmer and easier for the governor to reinforce.",
        volumeLabel: "Routine share",
        source: "Scenario / GDELT",
        observedAt: generatedAt,
      },
    ];

    return {
      generatedAt,
      scenario,
      postureSummary:
        "Narrative pressure is manageable. The governor can pivot from warning posture into confidence-and-safety reinforcement.",
      peopleTalkAbout: talk,
      peopleShare: share,
      broadcastWatch: buildBroadcastSignals(talk, share, scenario),
      sources: ["Scenario / Google Trends TH", "Scenario / GDELT", "Thailand TV wall"],
    };
  }

  return null;
}

export async function loadMediaWatch(
  options: MediaWatchOptions = {},
): Promise<MediaWatchResponse> {
  const scenario = resolveScenario(options.scenario);
  const scenarioPayload = scenarioMediaWatch(scenario);

  if (scenarioPayload) {
    return scenarioPayload;
  }

  const [talkSignals, shareSignals] = await Promise.all([
    fetchGoogleTrendSignals(),
    fetchGdeltSignals(),
  ]);
  const broadcastWatch = buildBroadcastSignals(talkSignals, shareSignals, scenario);
  const strongestStatus =
    [...talkSignals, ...shareSignals].sort(compareByStatus)[0]?.status ?? "stable";

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    postureSummary:
      strongestStatus === "intervene"
        ? "Narrative heat is high enough to justify a governor line today."
        : strongestStatus === "watch"
          ? "Narrative heat is elevated but still manageable with targeted messaging."
          : "Narrative heat is broadly calm and useful as confirmation, not a crisis lead.",
    peopleTalkAbout: talkSignals,
    peopleShare: shareSignals,
    broadcastWatch,
    sources: uniqueStrings([
      ...talkSignals.map((signal) => signal.source),
      ...shareSignals.map((signal) => signal.source),
      "Thailand TV wall",
    ]),
  };
}

async function loadAirspacePressure(
  options: GovernorDataOptions = {},
): Promise<AirspacePressure> {
  const scenario = resolveScenario(options.scenario);
  const generatedAt = new Date().toISOString();

  if (scenario === "tourism-surge-weekend") {
    return {
      count: 34,
      status: "intervene",
      summary: "The live sky posture suggests Phuket is entering a dense arrival bank.",
      updatedAt: generatedAt,
      sources: ["OpenSky scenario"],
    };
  }

  if (scenario === "red-monsoon-day") {
    return {
      count: 18,
      status: "watch",
      summary: "Arrivals are still active, but weather-driven transfer reliability matters more than raw volume.",
      updatedAt: generatedAt,
      sources: ["OpenSky scenario"],
    };
  }

  if (scenario === "stable-recovery-day") {
    return {
      count: 12,
      status: "stable",
      summary: "Airspace posture is steady and should not dominate the governor day.",
      updatedAt: generatedAt,
      sources: ["OpenSky scenario"],
    };
  }

  const payload = await fetchJsonWithTimeout<{ states?: unknown[] }>(OPENSKY_PHUKET_URL);
  const count = payload?.states?.length ?? 0;

  if (count === 0) {
    return {
      count: 16,
      status: "watch",
      summary: "Fallback sky posture keeps airport pressure on watch, not yet on intervene.",
      updatedAt: generatedAt,
      sources: ["OpenSky fallback"],
    };
  }

  return {
    count,
    status: count >= 28 ? "intervene" : count >= 14 ? "watch" : "stable",
    summary:
      count >= 28
        ? "Flight density suggests the airport-transfer corridor could tighten quickly."
        : count >= 14
          ? "The sky posture points to a busier-than-routine airport corridor."
          : "Flight density is modest and should stay manageable.",
    updatedAt: generatedAt,
    sources: ["OpenSky live"],
  };
}

function cameraCoverageSummary(cameras: PublicCamera[]) {
  const verified = cameras.filter((camera) => camera.validationState === "verified").length;
  const candidates = cameras.filter((camera) => camera.validationState === "candidate").length;
  return { verified, candidates };
}

export async function loadCityVibes(
  options: CityVibeOptions = {},
): Promise<CityVibesResponse> {
  const scenario = resolveScenario(options.scenario);
  const [marine, mediaWatch, airspace, incidents] = await Promise.all([
    options.marine ? Promise.resolve(options.marine) : loadMarineStatus({ scenario }),
    options.mediaWatch
      ? Promise.resolve(options.mediaWatch)
      : loadMediaWatch({ scenario }),
    options.airspace ? Promise.resolve(options.airspace) : loadAirspacePressure({ scenario }),
    options.incidents
      ? Promise.resolve(options.incidents)
      : loadThailandIncidents().catch(() => fallbackIncidents),
  ]);

  const allSignals = [
    ...mediaWatch.peopleTalkAbout,
    ...mediaWatch.peopleShare,
    ...mediaWatch.broadcastWatch,
  ];

  const zones = CITY_ZONES.map((zone) => {
    const zoneCameras = phuketPublicCameras.filter(
      (camera) =>
        zone.focusAreas.includes(camera.focusArea) ||
        zone.aliases.some((alias) => camera.focusArea.toLowerCase().includes(alias.toLowerCase())),
    );
    const zoneMarine = marine.corridors.filter(
      (corridor) =>
        zone.focusAreas.includes(corridor.focusArea) ||
        zone.aliases.some((alias) =>
          corridor.focusArea.toLowerCase().includes(alias.toLowerCase()),
        ),
    );
    const zoneSignals = allSignals.filter(
      (signal) =>
        signal.zone === zone.label ||
        matchAny(`${signal.title} ${signal.summary} ${signal.zone}`, zone.aliases),
    );
    const zoneIncidents = incidents.filter((incident) =>
      matchAny(
        `${incident.properties.location} ${incident.properties.notes} ${incident.properties.title}`,
        zone.aliases,
      ),
    );
    const trendTrafficTotal = zoneSignals
      .filter((signal) => signal.kind === "talk")
      .reduce((sum, signal) => sum + parseTrafficVolume(signal.volumeLabel), 0);
    const marineScore = zoneMarine.reduce(
      (sum, corridor) => sum + STATUS_PRIORITY[corridor.status] * 8,
      0,
    );
    const signalScore = zoneSignals.reduce(
      (sum, signal) => sum + narrativeWeight(signal.status),
      0,
    );
    const incidentScore = zoneIncidents.reduce(
      (sum, incident) => sum + 8 + incident.properties.fatalities * 6,
      0,
    );
    const cameraSummary = cameraCoverageSummary(zoneCameras);
    const airportBoost = zone.id === "airport-corridor" ? airspace.count * 1.2 : 0;
    const tourismBoost = ["patong", "ao-nang", "khao-lak"].includes(zone.id) ? 12 : 0;
    const score = Math.min(
      100,
      cameraSummary.verified * 14 +
        cameraSummary.candidates * 5 +
        signalScore +
        marineScore +
        incidentScore +
        Math.min(18, trendTrafficTotal / 12_000) +
        airportBoost +
        tourismBoost,
    );
    const status = statusFromScore(score);
    const broadcastCount = zoneSignals.filter((signal) => signal.kind === "broadcast").length;

    return {
      id: zone.id,
      label: zone.label,
      status,
      summary:
        status === "intervene"
          ? `${zone.label} is running hot enough to affect the governor story today.`
          : status === "watch"
            ? `${zone.label} is active and worth a closer read before the next field round.`
            : `${zone.label} feels broadly manageable with low narrative friction.`,
      whyNow:
        zone.id === "airport-corridor"
          ? airspace.summary
          : zoneMarine[0]?.summary ??
            zoneSignals[0]?.summary ??
            "No single signal dominates; this is a blended city-vibe read.",
      score: Math.round(score),
      cameraFreshness: `${cameraSummary.verified} verified / ${cameraSummary.candidates} scout`,
      trendTraffic:
        trendTrafficTotal > 0
          ? `${formatCompact(trendTrafficTotal)} search load`
          : "Quiet search load",
      tvCoverage: `${Math.max(1, broadcastCount)} channels in watch rotation`,
      mobilityPressure:
        zone.id === "airport-corridor"
          ? `${airspace.count} aircraft in Phuket sky posture`
          : zoneMarine[0]
            ? `${statusLabel(zoneMarine[0].status)} marine effect`
            : `${zoneSignals.length} narrative signals`,
      recommendedAction: zone.defaultAction,
      sources: uniqueStrings([
        ...zoneCameras.map((camera) => camera.provider),
        ...zoneMarine.flatMap((corridor) => corridor.sources),
        ...zoneSignals.map((signal) => signal.source),
        ...(zone.id === "airport-corridor" ? airspace.sources : []),
      ]),
      updatedAt: new Date().toISOString(),
    } satisfies CityVibeCard;
  }).sort((left, right) => right.score - left.score);

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    zones,
    sources: uniqueStrings(zones.flatMap((zone) => zone.sources)),
  };
}

function describeCorridorLead(
  disasterAlerts: DisasterAlert[],
  maritimeContacts: MaritimeSecurityResponse["vessels"],
  marineCorridors: MarineCorridorStatus[],
  tourismHotspots: TourismHotspotsResponse["hotspots"],
  vibeCards: CityVibeCard[],
  signals: NarrativeSignal[],
) {
  const disasterLead = disasterAlerts.sort(
    (left, right) => STATUS_PRIORITY[right.severity] - STATUS_PRIORITY[left.severity],
  )[0];
  const maritimeLead = maritimeContacts.sort(compareByStatus)[0];
  const marineLead = marineCorridors.sort(compareByStatus)[0];
  const tourismLead = tourismHotspots.sort(compareByStatus)[0];
  const vibeLead = vibeCards.sort(compareByStatus)[0];
  const narrativeLead = signals.sort(compareByStatus)[0];

  return disasterLead?.severity === "intervene"
    ? disasterLead.summary
    : maritimeLead?.status === "intervene"
      ? maritimeLead.strategicNote
      : marineLead?.status === "intervene"
    ? marineLead.summary
      : tourismLead?.status === "intervene"
        ? tourismLead.summary
        : vibeLead?.status === "intervene"
          ? vibeLead.summary
          : narrativeLead?.summary ??
            disasterLead?.summary ??
            maritimeLead?.strategicNote ??
            marineLead?.summary ??
            tourismLead?.summary ??
            vibeLead?.summary ??
            "No single signal dominates this corridor.";
}

function buildCorridorPriorities({
  disaster,
  maritimeSecurity,
  marine,
  tourismHotspots,
  cityVibes,
  mediaWatch,
  airspace,
  incidents,
}: {
  disaster: DisasterFeedResponse;
  maritimeSecurity: MaritimeSecurityResponse;
  marine: MarineStatusResponse;
  tourismHotspots: TourismHotspotsResponse;
  cityVibes: CityVibesResponse;
  mediaWatch: MediaWatchResponse;
  airspace: AirspacePressure;
  incidents: typeof fallbackIncidents;
}) {
  const allSignals = [
    ...mediaWatch.peopleTalkAbout,
    ...mediaWatch.peopleShare,
    ...mediaWatch.broadcastWatch,
  ];

  return GOVERNOR_CORRIDORS.map((corridor) => {
    const disasterAlerts = disaster.alerts.filter(
      (alert) =>
        corridor.focusAreas.includes(alert.area) ||
        matchAny(`${alert.title} ${alert.summary} ${alert.area}`, corridor.aliases),
    );
    const maritimeContacts = maritimeSecurity.vessels.filter(
      (vessel) =>
        matchAny(
          `${vessel.name} ${vessel.type} ${vessel.destination ?? ""} ${vessel.strategicNote}`,
          corridor.aliases,
        ) ||
        corridor.focusAreas.some((focusArea) =>
          `${vessel.destination ?? ""} ${vessel.strategicNote}`
            .toLowerCase()
            .includes(focusArea.toLowerCase()),
        ),
    );
    const marineCorridors = marine.corridors.filter(
      (item) =>
        corridor.focusAreas.includes(item.focusArea) ||
        matchAny(`${item.label} ${item.locationLabel} ${item.focusArea}`, corridor.aliases),
    );
    const vibeCards = cityVibes.zones.filter(
      (zone) =>
        corridor.focusAreas.some((focusArea) => zone.label.includes(focusArea)) ||
        matchAny(`${zone.label} ${zone.summary} ${zone.whyNow}`, corridor.aliases),
    );
    const tourismNodes = tourismHotspots.hotspots.filter(
      (hotspot) =>
        corridor.focusAreas.includes(hotspot.area) ||
        matchAny(
          `${hotspot.label} ${hotspot.area} ${hotspot.summary} ${hotspot.strategicNote}`,
          corridor.aliases,
        ),
    );
    const signals = allSignals.filter(
      (signal) =>
        matchAny(`${signal.title} ${signal.summary} ${signal.zone}`, corridor.aliases) ||
        corridor.focusAreas.includes(signal.zone),
    );
    const corridorIncidents = incidents.filter((incident) =>
      matchAny(
        `${incident.properties.location} ${incident.properties.notes} ${incident.properties.title}`,
        corridor.aliases,
      ),
    );
    const corridorScore =
      disasterAlerts.reduce(
        (sum, alert) => sum + STATUS_PRIORITY[alert.severity] * 16,
        0,
      ) +
      maritimeContacts.reduce(
        (sum, vessel) => sum + STATUS_PRIORITY[vessel.status] * 12,
        0,
      ) +
      marineCorridors.reduce((sum, item) => sum + STATUS_PRIORITY[item.status] * 18, 0) +
      tourismNodes.reduce((sum, hotspot) => sum + STATUS_PRIORITY[hotspot.status] * 10, 0) +
      vibeCards.reduce((sum, item) => sum + STATUS_PRIORITY[item.status] * 14, 0) +
      signals.reduce((sum, item) => sum + narrativeWeight(item.status), 0) +
      corridorIncidents.reduce(
        (sum, incident) => sum + 10 + incident.properties.fatalities * 6,
        0,
      ) +
      (corridor.id === "airport-patong" ? airspace.count * 1.4 : 0);
    const status =
      disasterAlerts.some((item) => item.severity === "intervene") ||
      maritimeContacts.some((item) => item.status === "intervene") ||
      marineCorridors.some((item) => item.status === "intervene") ||
      tourismNodes.some((item) => item.status === "intervene") ||
      vibeCards.some((item) => item.status === "intervene") ||
      corridorScore >= 78
        ? "intervene"
        : corridorScore >= 42
          ? "watch"
          : "stable";
    const corridorAction =
      actionFromDisasterAlert(disasterAlerts[0]) ??
      actionFromMaritimeContact(maritimeContacts[0]) ??
      actionFromTourismHotspot(tourismNodes[0]) ??
      marineCorridors[0]?.recommendedAction ??
      vibeCards[0]?.recommendedAction ??
      corridor.defaultAction;

    return {
      id: corridor.id,
      label: corridor.label,
      status,
      summary:
        status === "intervene"
          ? `${corridor.label} needs executive attention today.`
          : status === "watch"
            ? `${corridor.label} is elevated and worth a governor glance.`
          : `${corridor.label} is operating inside a stable envelope.`,
      whyNow: describeCorridorLead(
        disasterAlerts,
        maritimeContacts,
        marineCorridors,
        tourismNodes,
        vibeCards,
        signals,
      ),
      action: corridorAction,
      reasonTags: uniqueStrings([
        ...disasterAlerts.map((item) => item.area),
        ...maritimeContacts.map((item) => item.type),
        ...marineCorridors.map((item) => item.alertPosture),
        ...tourismNodes.map((item) => item.kind),
        ...vibeCards.map((item) => item.mobilityPressure),
        ...signals.map((item) => item.kind),
      ]).slice(0, 3),
      focusAreas: corridor.focusAreas,
    } satisfies GovernorCorridorPriority;
  });
}

function concernMetric(label: string, value: string) {
  return { label, value };
}

function actionFromDisasterAlert(alert?: DisasterAlert) {
  if (!alert) {
    return null;
  }

  const text = `${alert.title} ${alert.summary} ${alert.area}`.toLowerCase();

  if (/airport|road|runoff|flood|old town|town/i.test(text)) {
    return "Clear road access, inspect flood points, and keep transfer messaging practical.";
  }

  if (/pier|ferry|port|marina/i.test(text)) {
    return "Inspect piers, confirm operator readiness, and hold unsafe departures.";
  }

  if (/beach|surf|rough sea|west coast|patong|karon|kata/i.test(text)) {
    return "Message weather safety early and keep beach flag discipline visible.";
  }

  return "Reinforce the warning line and clear the affected corridor before the next briefing cycle.";
}

function actionFromMaritimeContact(
  vessel?: MaritimeSecurityResponse["vessels"][number],
) {
  if (!vessel) {
    return null;
  }

  const type = vessel.type.toLowerCase();

  if (/ferry|passenger/.test(type)) {
    return "Inspect ferry lanes, pier density, and passenger holding before queues spill over.";
  }

  if (/fishing|unknown/.test(type)) {
    return "Cross-check the contact with marine patrol and port operators before it becomes a wider watch item.";
  }

  return "Keep marine operators synchronized and verify the contact through the harbor picture.";
}

function actionFromTourismHotspot(hotspot?: TourismHotspot) {
  if (!hotspot) {
    return null;
  }

  const text = `${hotspot.label} ${hotspot.area} ${hotspot.summary}`.toLowerCase();

  if (/airport|transfer|arrivals/.test(text)) {
    return "Coordinate transfers early and keep the arrival corridor smooth before flight banks tighten.";
  }

  if (/pier|marina|rassada|chalong|ao po/.test(text)) {
    return "Coordinate tourism operators and pier dispatch before density starts shaping the public story.";
  }

  if (/patong|beach|ao nang|khao lak|old town/.test(text)) {
    return hotspot.strategicNote;
  }

  return "Coordinate tourism operators before visitor pressure compounds.";
}

export async function buildGovernorBrief(
  options: GovernorDataOptions = {},
): Promise<GovernorBrief> {
  const scenario = resolveScenario(options.scenario);
  const [disaster, maritimeSecurity, marine, tourismHotspots, mediaWatch, airspace, incidents] = await Promise.all([
    loadDisasterFeed({ scenario }),
    loadMaritimeSecurity({ scenario }),
    loadMarineStatus({ scenario }),
    loadTourismHotspots({ scenario }),
    loadMediaWatch({ scenario }),
    loadAirspacePressure({ scenario }),
    loadThailandIncidents().catch(() => fallbackIncidents),
  ]);
  const cityVibes = await loadCityVibes({
    scenario,
    marine,
    mediaWatch,
    airspace,
    incidents,
  });

  const corridorPriorities = buildCorridorPriorities({
    disaster,
    maritimeSecurity,
    marine,
    tourismHotspots,
    cityVibes,
    mediaWatch,
    airspace,
    incidents,
  });
  const topMarine = marine.corridors.sort(compareByStatus)[0];
  const topDisaster = [...disaster.alerts].sort(
    (left, right) => STATUS_PRIORITY[right.severity] - STATUS_PRIORITY[left.severity],
  )[0];
  const topMaritimeContact = [...maritimeSecurity.vessels].sort(compareByStatus)[0];
  const portCorridors = marine.corridors.filter((corridor) =>
    ["Chalong / Rassada / Ao Po", "Phi Phi corridor", "Ao Nang", "Khao Lak"].includes(
      corridor.focusArea,
    ),
  );
  const roadCorridors = corridorPriorities.filter((corridor) =>
    ["airport-patong", "old-town"].includes(corridor.id),
  );
  const tourismZones = cityVibes.zones.filter((zone) =>
    ["Patong", "Ao Nang", "Khao Lak"].includes(zone.label),
  );
  const activeTourismHotspots = tourismHotspots.hotspots.filter(
    (hotspot) => hotspot.status !== "stable",
  );
  const topTourismHotspot = [...tourismHotspots.hotspots].sort(compareByStatus)[0];
  const publicMoodLead = [
    ...mediaWatch.peopleTalkAbout,
    ...mediaWatch.peopleShare,
  ].sort(compareByStatus)[0];
  const roadLead = roadCorridors.sort(compareByStatus)[0] ?? corridorPriorities[0];
  const roadDisasterLead =
    disaster.alerts.find((alert) =>
      /airport|old town|town|road|runoff|flood|khao lak|takua pa/i.test(
        `${alert.title} ${alert.summary} ${alert.area}`,
      ),
    ) ?? topDisaster;
  const monsoonStatus =
    topDisaster && STATUS_PRIORITY[topDisaster.severity] >= STATUS_PRIORITY[topMarine.status]
      ? topDisaster.severity
      : topMarine.status;

  const concernSpecs: Array<{
    id: string;
    label: string;
    status: ExecutiveStatus;
    summary: string;
    whyNow: string;
    metric: { label: string; value: string };
    action: string;
    sources: string[];
  }> = [
    {
      id: "monsoon-risk",
      label: "Monsoon risk",
      status: monsoonStatus,
      summary:
        monsoonStatus === topDisaster?.severity
          ? disaster.summary
          : topMarine.summary,
      whyNow:
        topDisaster?.summary ??
        `${topMarine.label} is the current marine-weather lead.`,
      metric: concernMetric(
        "Wave / alerts",
        `${formatMetric(topMarine.waveHeightMeters, "m")} / ${disaster.alerts.filter((alert) => alert.severity !== "stable").length}`,
      ),
      action: actionFromDisasterAlert(topDisaster) ?? topMarine.recommendedAction,
      sources: uniqueStrings([...topMarine.sources, ...disaster.sources]),
    },
    {
      id: "marine-route-status",
      label: "Marine route status",
      status:
        maritimeSecurity.posture === "intervene" ||
        portCorridors.some((item) => item.status === "intervene")
          ? "intervene"
          : maritimeSecurity.posture === "watch" ||
              portCorridors.some((item) => item.status === "watch")
            ? "watch"
            : "stable",
      summary:
        maritimeSecurity.posture === "intervene"
          ? maritimeSecurity.summary
          : `${portCorridors.filter((item) => item.status !== "stable").length} Phuket-linked marine corridors are above baseline watch.`,
      whyNow:
        topMaritimeContact?.strategicNote ??
        portCorridors[0]?.summary ??
        "East coast and open-water corridors are inside normal watch.",
      metric: concernMetric(
        "Corridors / vessels",
        `${portCorridors.filter((item) => item.status !== "stable").length}/${portCorridors.length} • ${maritimeSecurity.vessels.length}`,
      ),
      action:
        actionFromMaritimeContact(topMaritimeContact) ??
        corridorPriorities.find((item) => item.id === "east-coast-ports")?.action ??
        "Inspect piers and ferry departures.",
      sources: uniqueStrings([
        ...portCorridors.flatMap((item) => item.sources),
        ...maritimeSecurity.sources,
      ]),
    },
    {
      id: "airport-arrivals-pressure",
      label: "Airport arrivals pressure",
      status: airspace.status,
      summary: airspace.summary,
      whyNow:
        corridorPriorities.find((item) => item.id === "airport-patong")?.whyNow ??
        airspace.summary,
      metric: concernMetric("Aircraft", `${airspace.count}`),
      action:
        corridorPriorities.find((item) => item.id === "airport-patong")?.action ??
        "Clear airport road access and watch transfer queues.",
      sources: airspace.sources,
    },
    {
      id: "road-bottlenecks",
      label: "Road bottlenecks",
      status:
        roadDisasterLead &&
        STATUS_PRIORITY[roadDisasterLead.severity] > STATUS_PRIORITY[roadLead.status]
          ? roadDisasterLead.severity
          : roadLead.status,
      summary:
        roadDisasterLead &&
        STATUS_PRIORITY[roadDisasterLead.severity] > STATUS_PRIORITY[roadLead.status]
          ? roadDisasterLead.summary
          : roadLead.summary,
      whyNow: roadDisasterLead?.summary ?? roadLead.whyNow,
      metric: concernMetric(
        "Road corridors",
        `${roadCorridors.filter((item) => item.status !== "stable").length}/${roadCorridors.length}`,
      ),
      action: actionFromDisasterAlert(roadDisasterLead) ?? roadLead.action,
      sources: uniqueStrings([
        "Camera proxy",
        "Local incidents",
        "Governor corridor model",
        ...disaster.sources,
      ]),
    },
    {
      id: "tourism-pulse",
      label: "Tourism pulse",
      status:
        activeTourismHotspots.some((hotspot) => hotspot.status === "intervene") ||
        tourismZones.some((zone) => zone.status === "intervene")
          ? "intervene"
          : activeTourismHotspots.some((hotspot) => hotspot.status === "watch") ||
              tourismZones.some((zone) => zone.status === "watch")
            ? "watch"
            : "stable",
      summary:
        topTourismHotspot?.summary ??
        `${tourismZones[0]?.label ?? "Patong"} is currently the lead visitor-pressure zone.`,
      whyNow:
        topTourismHotspot?.strategicNote ??
        tourismZones[0]?.whyNow ??
        "Tourism demand is present, but not yet dislocating operations.",
      metric: concernMetric(
        "Active hotspots",
        `${activeTourismHotspots.length}/${tourismHotspots.hotspots.length}`,
      ),
      action:
        actionFromTourismHotspot(topTourismHotspot) ??
        tourismZones[0]?.recommendedAction ??
        "Coordinate tourism operators before crowding compounds.",
      sources: uniqueStrings([
        ...tourismZones.flatMap((zone) => zone.sources),
        ...tourismHotspots.sources,
      ]),
    },
    {
      id: "public-mood",
      label: "Public mood",
      status: publicMoodLead?.status ?? "stable",
      summary:
        publicMoodLead?.title ??
        "Public mood is calm and not dominating the governor story.",
      whyNow: mediaWatch.postureSummary,
      metric: concernMetric(
        "Narrative heat",
        `${mediaWatch.peopleTalkAbout.length + mediaWatch.peopleShare.length}`,
      ),
      action:
        publicMoodLead?.status === "intervene" || publicMoodLead?.status === "watch"
          ? "Calm misinformation early and keep the public line practical."
          : "Reinforce calm, factual messaging and let field conditions do the talking.",
      sources: mediaWatch.sources,
    },
  ];

  const topConcerns = concernSpecs.map(
    (concern): GovernorConcern => ({
      id: concern.id,
      label: concern.label,
      status: concern.status,
      summary: concern.summary,
      whyNow: concern.whyNow,
      metricLabel: concern.metric.label,
      metricValue: concern.metric.value,
      action: concern.action,
      sources: concern.sources,
    }),
  );

  const postureLevel =
    topConcerns.some((concern) => concern.status === "intervene")
      ? "intervene"
      : topConcerns.some((concern) => concern.status === "watch")
        ? "watch"
        : "stable";
  const nextActions = uniqueStrings(
    [
      corridorPriorities.find((corridor) => corridor.status === "intervene")?.action,
      topConcerns.find((concern) => concern.id === "road-bottlenecks")?.action,
      topConcerns.find((concern) => concern.id === "monsoon-risk")?.action,
      topConcerns.find((concern) => concern.id === "tourism-pulse")?.action,
      topConcerns.find((concern) => concern.id === "public-mood")?.action,
    ].filter((value): value is string => Boolean(value)),
  ).slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    posture: {
      level: postureLevel,
      label:
        postureLevel === "intervene"
          ? "Executive attention needed"
          : postureLevel === "watch"
            ? "Watch with focused interventions"
            : "Stable island posture",
      summary:
        postureLevel === "intervene"
          ? `Marine risk, access pressure, or narrative heat is strong enough that the governor should clear issues today rather than simply monitor them.`
          : postureLevel === "watch"
            ? `The island is manageable, but one or more corridors need a tighter watch cycle and visible executive intent.`
            : `The island is broadly stable; use the war room to confirm, not chase, isolated noise.`,
      updatedAt: new Date().toISOString(),
    },
    topConcerns,
    corridorPriorities,
    nextActions,
    sources: uniqueStrings([
      ...disaster.sources,
      ...maritimeSecurity.sources,
      ...marine.sources,
      ...tourismHotspots.sources,
      ...cityVibes.sources,
      ...mediaWatch.sources,
      ...airspace.sources,
    ]),
  };
}

export { resolveScenario };

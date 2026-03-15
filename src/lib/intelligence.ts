import axios from "axios";
import { query } from "./db";
import { getErrorMessage } from "./errors";
import {
  loadCachedIntelligencePayload,
  storeCachedIntelligencePayload,
  synthesizeStalePayload,
} from "./intelligence-cache";
import {
  fallbackEconomicIndicators,
  fallbackFires,
  fallbackIncidents,
  fallbackNews,
  fallbackRainfall,
  fallbackRefugees,
  fallbackTicker,
} from "./mock-data";
import { fetchReferenceApiCatalog } from "./reference-data";
import {
  loadThailandEconomics,
  loadThailandIncidents,
} from "./thailand-monitor";
import {
  buildWarRoomSourceEntries,
  loadDisasterFeed,
  loadMaritimeSecurity,
  loadTourismHotspots,
} from "./war-room-integrations";
import type {
  ApiSourceResponse,
  BriefingPayload,
  EconomicIndicator,
  FireEvent,
  IncidentFeature,
  IntelligenceItem,
  IntelligencePackage,
  IntelligencePackageResponse,
  NewsItem,
  NewsResponse,
  RainfallPoint,
  RefugeeMovement,
  SourceHealth,
  TickerItem,
  TickerResponse,
} from "../types/dashboard";

const FEED_JSON_FALLBACK = "https://api.rss2json.com/v1/api.json?rss_url=";
const INTELLIGENCE_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 min — keeps news/pulsation fresh
const REQUEST_TIMEOUT_MS = 12_000;
const FEED_LOOKBACK_DAYS = 45;
const FEED_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

type SeedKind = IntelligenceItem["kind"];

interface SeedItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  url: string;
  tags: string[];
  score: number;
  severity: IntelligenceItem["severity"];
  kind: SeedKind;
}

interface FeedSource {
  id: string;
  label: string;
  url: string;
  group: "thailand" | "asia" | "global" | "internal";
  trustScore: number;
  kind: "rss" | "json";
}

interface PackageDefinition {
  id: string;
  title: string;
  description: string;
  sourceIds: string[];
  queries: string[];
  focusTags: string[];
  anchorTags: string[];
  matcher: (item: SeedItem) => boolean;
}

interface FeedItem {
  title: string;
  link: string;
  summary?: string;
  pubDate: Date;
  source: string;
}

interface FxItemCandidate {
  value: number | string;
  change: number | string;
  label: string;
  unit?: string | null;
}

interface RainfallRow {
  location: string;
  value: number;
}

const SEVERITY_PRIORITY: Record<IntelligenceItem["severity"], number> = {
  alert: 3,
  watch: 2,
  stable: 1,
};

const NEWS_KIND_PRIORITY: Record<IntelligenceItem["kind"], number> = {
  news: 6,
  incident: 5,
  movement: 4,
  market: 3,
  weather: 2,
  thermal: 1,
};

const KEYWORD_GROUPS = [
  {
    tag: "tourism",
    weight: 18,
    terms: [
      "tourism",
      "tourist",
      "visitor",
      "hotel",
      "phuket",
      "patong",
      "airport",
      "arrivals",
      "occupancy",
      "old town",
    ],
  },
  {
    tag: "weather",
    weight: 16,
    terms: ["rain", "storm", "monsoon", "flood", "weather", "runoff", "landslide"],
  },
  {
    tag: "traffic",
    weight: 18,
    terms: [
      "traffic",
      "road",
      "crash",
      "transfer",
      "vehicle",
      "motorbike",
      "airport road",
      "patong hill",
    ],
  },
  {
    tag: "economy",
    weight: 14,
    terms: [
      "economy",
      "diesel",
      "price",
      "cost",
      "supply",
      "market",
      "business",
      "tourism revenue",
    ],
  },
  {
    tag: "mobility",
    weight: 12,
    terms: ["airport", "flight", "ferry", "boat", "pier", "transfer", "mobility"],
  },
  {
    tag: "marine",
    weight: 12,
    terms: ["marine", "sea", "beach", "wave", "swell", "boat", "pier", "west coast"],
  },
  {
    tag: "air",
    weight: 10,
    terms: ["aqi", "pm2.5", "pm25", "smoke", "air quality", "haze"],
  },
] as const;

const FEED_SOURCES: FeedSource[] = [
  {
    id: "bangkok-post",
    label: "Bangkok Post",
    url: "https://www.bangkokpost.com/rss/data/news.xml",
    group: "thailand",
    trustScore: 13,
    kind: "rss",
  },
  {
    id: "the-thaiger",
    label: "The Thaiger",
    url: "https://thethaiger.com/feed",
    group: "thailand",
    trustScore: 12,
    kind: "rss",
  },
  {
    id: "tat-newsroom",
    label: "TAT Newsroom",
    url: "https://www.tatnews.org/feed/",
    group: "thailand",
    trustScore: 12,
    kind: "rss",
  },
  {
    id: "thaipbs-world",
    label: "Thai PBS World",
    url: "https://www.thaipbsworld.com/feed/",
    group: "thailand",
    trustScore: 12,
    kind: "rss",
  },
  {
    id: "phuket-express",
    label: "The Phuket Express",
    url: "https://thephuketexpress.com/feed/",
    group: "thailand",
    trustScore: 11,
    kind: "rss",
  },
  {
    id: "nikkei-asia",
    label: "Nikkei Asia",
    url: "https://info.asia.nikkei.com/rss",
    group: "asia",
    trustScore: 11,
    kind: "rss",
  },
  {
    id: "cna",
    label: "Channel NewsAsia",
    url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
    group: "asia",
    trustScore: 10,
    kind: "rss",
  },
];

const PACKAGE_DEFINITIONS: PackageDefinition[] = [
  {
    id: "marine-weather",
    title: "Marine and Monsoon Conditions",
    description:
      "West coast sea-state, rainfall, pier access, and monsoon-linked operating pressure around Phuket and nearby Andaman provinces.",
    sourceIds: [
      "bangkok-post",
      "the-thaiger",
      "tat-newsroom",
      "thaipbs-world",
      "phuket-express",
    ],
    queries: [
      "Phuket weather monsoon waves beach ferry pier",
      "Phuket beach warning surf monsoon swell",
      "site:thephuketnews.com Phuket weather ferry marine",
    ],
    focusTags: ["marine", "weather", "mobility"],
    anchorTags: ["marine", "weather"],
    matcher: (item) =>
      /phuket|patong|kamala|kata|andaman|krabi|phang nga|wave|pier|ferry|rain|storm|monsoon/i.test(
        `${item.title} ${item.summary}`,
      ),
  },
  {
    id: "tourism-demand",
    title: "Tourism Demand and Transfers",
    description:
      "Arrivals, hotel occupancy, airport transfers, and destination demand around Phuket, Krabi, and the upper south.",
    sourceIds: [
      "bangkok-post",
      "the-thaiger",
      "tat-newsroom",
      "thaipbs-world",
      "phuket-express",
      "nikkei-asia",
    ],
    queries: [
      "Phuket arrivals airport hotel tourism demand",
      "Phuket hotel occupancy flight demand Patong",
      "site:thephuketnews.com Phuket tourism hotel arrivals",
    ],
    focusTags: ["tourism", "economy", "mobility"],
    anchorTags: ["tourism", "mobility"],
    matcher: (item) =>
      /phuket|krabi|airport|hotel|tourism|visitor|arrivals|occupancy|transfer/i.test(
        `${item.title} ${item.summary}`,
      ),
  },
  {
    id: "road-safety",
    title: "Road Safety and Mobility",
    description:
      "Rain-linked road safety, access reliability, and transport pressure across Phuket and nearby provinces.",
    sourceIds: [
      "bangkok-post",
      "the-thaiger",
      "thaipbs-world",
      "phuket-express",
      "cna",
    ],
    queries: [
      "Patong traffic crash rain Phuket road safety",
      "Phuket airport road flooding transfer delays",
      "site:thephuketnews.com Phuket crash rain Patong Hill",
    ],
    focusTags: ["traffic", "weather", "mobility"],
    anchorTags: ["traffic", "weather"],
    matcher: (item) => {
      const text = `${item.title} ${item.summary}`;
      return /phuket|patong|kathu|krabi|airport|transfer|road|traffic|crash|flood/i.test(text);
    },
  },
  {
    id: "cost-logistics",
    title: "Costs and Local Operating Economics",
    description:
      "Diesel, FX, supply costs, and demand-side economic signals affecting Phuket's operating picture.",
    sourceIds: [
      "bangkok-post",
      "nikkei-asia",
      "tat-newsroom",
      "thaipbs-world",
      "phuket-express",
    ],
    queries: [
      "Phuket diesel prices baht tourism economy",
      "Southern Thailand logistics Phuket cost pressure",
      "Phuket hotel rates airline capacity tourism revenue",
    ],
    focusTags: ["economy", "tourism", "traffic"],
    anchorTags: ["economy", "tourism"],
    matcher: (item) => {
      const text = `${item.title} ${item.summary}`;
      return /phuket|krabi|diesel|usd\/thb|hotel|arrivals|cost|price|supply|economy/i.test(text);
    },
  },
];

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  Phuket: { lat: 7.8804, lng: 98.3923 },
  "Phuket Town": { lat: 7.8804, lng: 98.3923 },
  Patong: { lat: 7.8964, lng: 98.2965 },
  Kamala: { lat: 7.9479, lng: 98.2803 },
  "Khao Lak": { lat: 8.6367, lng: 98.2487 },
  "Phang Nga": { lat: 8.4501, lng: 98.5311 },
  Krabi: { lat: 8.0863, lng: 98.9126 },
  "Surat Thani": { lat: 9.1397, lng: 99.3331 },
  Trang: { lat: 7.5594, lng: 99.6114 },
  Ranong: { lat: 9.9626, lng: 98.6388 },
};

function buildGoogleNewsSearchUrl(queryText: string, locale = "en-TH") {
  const [language = "en", country = "US"] = locale.split("-");
  return `https://news.google.com/rss/search?q=${encodeURIComponent(queryText)}&hl=${language}&gl=${country}&ceid=${country}:${language}`;
}

function normalizeTitle(value = "") {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function getLatestTimestamp(values: (string | null | undefined)[]) {
  const latest = values.reduce<string | null>((currentLatest, value) => {
    const nextTimestamp = toTimestamp(value);

    if (!Number.isFinite(nextTimestamp)) {
      return currentLatest;
    }

    if (!currentLatest) {
      return value ?? null;
    }

    return nextTimestamp > toTimestamp(currentLatest) ? value ?? null : currentLatest;
  }, null);

  return latest ?? new Date().toISOString();
}

function buildItemDedupKey(item: Pick<SeedItem, "title" | "summary">) {
  return `${normalizeTitle(item.title)}|${normalizeTitle(item.summary).slice(0, 120)}`;
}

function compareImportantItems(left: SeedItem, right: SeedItem) {
  const severityDiff =
    SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];

  if (severityDiff !== 0) {
    return severityDiff;
  }

  const publishedDiff = toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt);

  if (publishedDiff !== 0) {
    return publishedDiff;
  }

  const kindDiff = NEWS_KIND_PRIORITY[right.kind] - NEWS_KIND_PRIORITY[left.kind];

  if (kindDiff !== 0) {
    return kindDiff;
  }

  return right.score - left.score;
}

function rankImportantItems(items: SeedItem[], limit: number) {
  const seen = new Set<string>();

  return items
    .slice()
    .sort(compareImportantItems)
    .filter((item) => {
      const dedupKey = buildItemDedupKey(item);

      if (!dedupKey || seen.has(dedupKey)) {
        return false;
      }

      seen.add(dedupKey);
      return true;
    })
    .slice(0, limit);
}

function isEditorialNewsKind(item: SeedItem) {
  return item.kind === "news" || item.kind === "incident";
}

function selectLeadItem(items: SeedItem[]) {
  return (
    rankImportantItems(items.filter(isEditorialNewsKind), 1)[0] ??
    rankImportantItems(items, 1)[0]
  );
}

function isPriorityNewsRelevant(item: SeedItem) {
  if (item.kind !== "news") {
    return true;
  }

  if (
    /phuket express|phuket news|thaiger|bangkok post|thai pbs|tat newsroom|channel newsasia|nikkei/i.test(
      item.source,
    )
  ) {
    return true;
  }

  return /phuket|phang nga|krabi|patong|kathu|kamala|kata|rawai|andaman|tourism|hotel|airport|arrivals|occupancy|ferry|pier|marine|monsoon|rain|flood|road|traffic|crash|aqi|pm2\.?5|diesel|baht/i.test(
    `${item.title} ${item.summary} ${item.source}`,
  );
}

function formatIndicatorValue({ label, value, unit }: FxItemCandidate) {
  const numeric =
    typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : value;

  return `${label} ${numeric}${unit ?? ""}`.trim();
}

function formatIndicatorChange(change: number | string) {
  if (typeof change === "number") {
    if (change === 0) {
      return "flat";
    }

    return `${change > 0 ? "+" : ""}${change.toFixed(2)}`;
  }

  return String(change);
}

function toIsoDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function resolveDate(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readKeywordSignals(text: string, focusTags: string[] = []) {
  const lowerText = text.toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  for (const group of KEYWORD_GROUPS) {
    const hits = group.terms.filter((term) => lowerText.includes(term));

    if (hits.length === 0) {
      continue;
    }

    matched.add(group.tag);
    score += group.weight + hits.length + (focusTags.includes(group.tag) ? 8 : 0);
  }

  return {
    tags: Array.from(matched).slice(0, 4),
    score,
  };
}

function classifySeverity(score: number): IntelligenceItem["severity"] {
  if (score >= 34) {
    return "alert";
  }

  if (score >= 22) {
    return "watch";
  }

  return "stable";
}

function parseJsonFallback(payload: unknown, source: FeedSource): FeedItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  const feedTitle =
    isRecord(payload.feed) && typeof payload.feed.title === "string"
      ? payload.feed.title
      : source.label;

  return payload.items
    .flatMap((item): FeedItem[] => {
      if (!isRecord(item)) {
        return [];
      }

      if (typeof item.title !== "string" || typeof item.link !== "string") {
        return [];
      }

      const normalizedItemTitle = normalizeTitle(item.title);
      const normalizedFeedTitle = normalizeTitle(feedTitle);

      if (!normalizedItemTitle || normalizedItemTitle === normalizedFeedTitle) {
        return [];
      }

      return [
        {
          title: item.title,
          link: item.link,
          summary:
            typeof item.description === "string"
              ? item.description
              : typeof item.content === "string"
                ? item.content
                : "",
          pubDate: resolveDate(
            typeof item.pubDate === "string" ? item.pubDate : undefined,
          ),
          source:
            typeof item.author === "string" && item.author.trim().length > 0
              ? item.author
              : feedTitle,
        },
      ];
    })
    .slice(0, 20);
}

function parseXmlFeed(xml: string, source: FeedSource): FeedItem[] {
  const items: FeedItem[] = [];
  const feedTitleMatch = xml.match(
    /<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/,
  );
  const feedTitle = feedTitleMatch?.[1]?.trim() || source.label;

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null = itemRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title =
      block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]
        ?.trim() || "";
    const link =
      block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1]
        ?.trim() || "";
    const pubDate =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
    const description =
      block.match(
        /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/,
      )?.[1]?.trim() || "";
    const sourceLabel =
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ||
      block.match(/<author>([\s\S]*?)<\/author>/)?.[1]?.trim() ||
      feedTitle;

    if (title && link && normalizeTitle(title) !== normalizeTitle(feedTitle)) {
      items.push({
        title,
        link,
        summary: description,
        pubDate: resolveDate(pubDate),
        source: sourceLabel,
      });
    }

    match = itemRegex.exec(xml);
  }

  if (items.length > 0) {
    return items.slice(0, 20);
  }

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  match = entryRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title =
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]
        ?.trim() || "";
    const link =
      block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/)?.[1]?.trim() || "";
    const pubDate =
      block.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() ||
      block.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ||
      "";
    const summary =
      block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/)?.[1]
        ?.trim() || "";

    if (title && link) {
      items.push({
        title,
        link,
        summary,
        pubDate: resolveDate(pubDate),
        source: feedTitle,
      });
    }

    match = entryRegex.exec(xml);
  }

  return items.slice(0, 20);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFeedItemInWindow(item: FeedItem) {
  const publishedAtMs = item.pubDate.getTime();
  const oldestAllowedMs = Date.now() - FEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  return (
    Number.isFinite(publishedAtMs) &&
    publishedAtMs >= oldestAllowedMs &&
    publishedAtMs <= Date.now() + FEED_FUTURE_SKEW_MS
  );
}

async function withTimeout<T>(callback: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRssSource(source: FeedSource): Promise<FeedItem[]> {
  try {
    const response = await withTimeout((signal) =>
      axios.get<string>(source.url, {
        timeout: REQUEST_TIMEOUT_MS,
        signal,
        responseType: "text",
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
      }),
    );

    if (typeof response.data === "string" && response.data.includes("<")) {
      const parsed = parseXmlFeed(response.data, source);

      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fall through to JSON fallback.
  }

  try {
    const fallbackResponse = await withTimeout((signal) =>
      axios.get<unknown>(`${FEED_JSON_FALLBACK}${encodeURIComponent(source.url)}`, {
        timeout: REQUEST_TIMEOUT_MS,
        signal,
      }),
    );

    return parseJsonFallback(fallbackResponse.data, source);
  } catch {
    return [];
  }
}

async function fetchJsonSource(source: FeedSource): Promise<FeedItem[]> {
  try {
    const response = await withTimeout((signal) =>
      axios.get<unknown>(source.url, {
        timeout: REQUEST_TIMEOUT_MS,
        signal,
        headers: { Accept: "application/json" },
      }),
    );

    const payload = response.data;

    if (!isRecord(payload)) {
      return [];
    }

    if (Array.isArray(payload.news)) {
      const generatedAt =
        typeof payload.generatedAt === "string"
          ? payload.generatedAt
          : new Date().toISOString();

      return payload.news.flatMap((entry, index): FeedItem[] => {
        if (!isRecord(entry) || typeof entry.title !== "string") {
          return [];
        }

        return [
          {
            title: entry.title,
            link:
              typeof entry.url === "string"
                ? entry.url
                : `${source.url}#item-${index + 1}`,
            summary: typeof entry.summary === "string" ? entry.summary : "",
            pubDate: resolveDate(generatedAt),
            source: source.label,
          },
        ];
      });
    }

    return [];
  } catch {
    return [];
  }
}

function buildSearchSources(definition: PackageDefinition): FeedSource[] {
  return definition.queries.map((queryText, index) => ({
    id: `${definition.id}-query-${index + 1}`,
    label: `Search: ${definition.title}`,
    url: buildGoogleNewsSearchUrl(queryText),
    group: "global",
    trustScore: 10,
    kind: "rss",
  }));
}

function buildSeedFromFeedItem(
  item: FeedItem,
  source: FeedSource,
  focusTags: string[],
): SeedItem {
  const combinedText = `${item.title} ${item.summary ?? ""}`;
  const keywordSignals = readKeywordSignals(combinedText, focusTags);
  const freshnessHours = Math.max(
    0,
    (Date.now() - item.pubDate.getTime()) / 3_600_000,
  );
  const freshnessScore = Math.max(0, 24 - freshnessHours) * 1.1;
  const score = source.trustScore + freshnessScore + keywordSignals.score;

  return {
    id: `${source.id}-${normalizeTitle(item.title).slice(0, 48)}`,
    title: item.title,
    summary: stripHtml(item.summary ?? ""),
    source: item.source || source.label,
    sourceUrl: source.url,
    publishedAt: item.pubDate.toISOString(),
    url: item.link,
    tags: keywordSignals.tags,
    score,
    severity: classifySeverity(score),
    kind: "news",
  };
}

function dedupeAndSortSeeds(items: SeedItem[], limit: number) {
  const seen = new Set<string>();

  return items
    .sort((left, right) => {
      if (right.score === left.score) {
        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      }

      return right.score - left.score;
    })
    .filter((item) => {
      const normalized = normalizeTitle(item.title);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .slice(0, limit);
}

function matchesPackage(item: SeedItem, definition: PackageDefinition) {
  if (definition.matcher(item)) {
    return true;
  }

  const focusOverlap = item.tags.filter((tag) =>
    definition.focusTags.includes(tag),
  );

  return (
    focusOverlap.length >= 2 &&
    item.tags.some((tag) => definition.anchorTags.includes(tag))
  );
}

async function fetchSourceSeeds(
  source: FeedSource,
  focusTags: string[],
  sourceCache: Map<string, { items: SeedItem[]; health: SourceHealth }>,
): Promise<{ items: SeedItem[]; health: SourceHealth }> {
  const cached = sourceCache.get(source.id);

  if (cached) {
    return cached;
  }

  const startedAt = Date.now();

  try {
    const feedItems =
      source.kind === "json"
        ? await fetchJsonSource(source)
        : await fetchRssSource(source);
    const currentFeedItems = feedItems.filter(isFeedItemInWindow);
    const seeds = currentFeedItems.map((item) =>
      buildSeedFromFeedItem(item, source, focusTags),
    );
    const health: SourceHealth = {
      id: source.id,
      label: source.label,
      url: source.url,
      status:
        seeds.length > 0 ? "live" : feedItems.length > 0 ? "stale" : "offline",
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      message:
        seeds.length > 0
          ? null
          : feedItems.length > 0
            ? `No items inside ${FEED_LOOKBACK_DAYS}-day window`
            : "No usable items returned",
    };

    const result = { items: seeds, health };
    sourceCache.set(source.id, result);
    return result;
  } catch (error: unknown) {
    const result = {
      items: [],
      health: {
        id: source.id,
        label: source.label,
        url: source.url,
        status: "offline" as const,
        checkedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt,
        message: getErrorMessage(error),
      },
    };

    sourceCache.set(source.id, result);
    return result;
  }
}

function buildRankedNewsItems(items: SeedItem[], limit: number) {
  const candidatePool = (() => {
    const relevantItems = items.filter(isPriorityNewsRelevant);
    return relevantItems.length > 0 ? relevantItems : items;
  })();
  const primary = rankImportantItems(
    candidatePool.filter(isEditorialNewsKind),
    limit,
  );

  if (primary.length >= limit) {
    return primary;
  }

  const seen = new Set(primary.map(buildItemDedupKey));
  const backfill = rankImportantItems(candidatePool, limit).filter((item) => {
    const dedupKey = buildItemDedupKey(item);

    if (!dedupKey || seen.has(dedupKey)) {
      return false;
    }

    seen.add(dedupKey);
    return true;
  });

  return [...primary, ...backfill].slice(0, limit);
}

export async function loadFires(): Promise<FireEvent[]> {
  try {
    const res = await query<FireEvent>(`
      SELECT latitude, longitude, brightness, confidence, acq_date
      FROM fire_events
      WHERE acq_date >= NOW() - INTERVAL '7 days'
      ORDER BY acq_date DESC
      LIMIT 80
    `);

    return res.rows.length > 0 ? res.rows : fallbackFires;
  } catch {
    return fallbackFires;
  }
}

export async function loadRainfall(): Promise<RainfallPoint[]> {
  try {
    const res = await query<RainfallRow>(`
      SELECT location, value
      FROM rainfall_data
      ORDER BY ref_date DESC
      LIMIT 40
    `);

    const rows = res.rows.map((row) => {
      const coords = LOCATION_COORDS[row.location] || { lat: 15, lng: 100 };

      return {
        lat: coords.lat,
        lng: coords.lng,
        value: row.value,
        label: row.location,
      };
    });

    return rows.length > 0 ? rows : fallbackRainfall;
  } catch {
    return fallbackRainfall;
  }
}

export async function loadRefugeeMovements(): Promise<RefugeeMovement[]> {
  return fallbackRefugees;
}

function buildIncidentSeeds(incidents: IncidentFeature[]): SeedItem[] {
  return incidents.slice(0, 20).map((incident, index) => {
    const combinedText = `${incident.properties.title} ${incident.properties.notes} ${incident.properties.location}`;
    const keywordSignals = readKeywordSignals(combinedText, ["traffic", "weather"]);
    const baseScore = 18 + incident.properties.fatalities * 6 + keywordSignals.score;

    return {
      id: `incident-${incident.id}-${index + 1}`,
      title: `${incident.properties.type} / ${incident.properties.location}`,
      summary: incident.properties.notes,
      source: "Phuket monitor",
      sourceUrl: "/api/incidents",
      publishedAt: incident.properties.eventDate || new Date().toISOString(),
      url: "/api/incidents",
      tags: keywordSignals.tags,
      score: baseScore,
      severity:
        incident.properties.fatalities >= 2
          ? "alert"
          : incident.properties.fatalities >= 1
            ? "watch"
            : "stable",
      kind: "incident",
    };
  });
}

function buildMarketSeeds(indicators: EconomicIndicator[]): SeedItem[] {
  return indicators.slice(0, 8).map((indicator, index) => {
    const combinedText = `${indicator.label} ${indicator.category ?? ""}`;
    const keywordSignals = readKeywordSignals(combinedText, ["economy", "tourism"]);
    const magnitude =
      typeof indicator.change === "number" ? Math.abs(indicator.change) : 0;
    const score = 12 + magnitude * 4 + keywordSignals.score;

    return {
      id: `market-${index + 1}-${normalizeTitle(indicator.label)}`,
      title: `${indicator.label} market pressure`,
      summary: `${formatIndicatorValue({
        label: indicator.label,
        value: indicator.value,
        unit: indicator.unit,
        change: indicator.change,
      })} (${formatIndicatorChange(indicator.change)}).`,
      source: indicator.source ?? "Market cache",
      sourceUrl: "/api/markets",
      publishedAt: new Date().toISOString(),
      url: "/api/markets",
      tags: Array.from(new Set([...keywordSignals.tags, "economy", "tourism"])).slice(0, 4),
      score,
      severity: magnitude >= 1.5 ? "watch" : "stable",
      kind: "market",
    };
  });
}

function buildRainfallSeeds(rainfall: RainfallPoint[]): SeedItem[] {
  return rainfall.slice(0, 8).map((point, index) => {
    const score = 10 + Math.abs(point.value) * 2.2;

    return {
      id: `rainfall-${index + 1}-${normalizeTitle(point.label)}`,
      title: `${point.label} rain load`,
      summary: `${point.label} is reading a rain-load signal of ${point.value.toFixed(1)}.`,
      source: "Rainfall cache",
      sourceUrl: "/api/rainfall",
      publishedAt: new Date().toISOString(),
      url: "/api/rainfall",
      tags: ["weather", "marine"],
      score,
      severity:
        Math.abs(point.value) >= 45
          ? "alert"
          : Math.abs(point.value) >= 25
            ? "watch"
            : "stable",
      kind: "weather",
    };
  });
}

function buildFireSeeds(fires: FireEvent[]): SeedItem[] {
  return fires.slice(0, 8).map((fire, index) => {
    const brightness = fire.brightness ?? 0;

    return {
      id: `fire-${index + 1}-${fire.latitude}-${fire.longitude}`,
      title: "Thermal hotspot cluster",
      summary: `Thermal anomaly detected at ${fire.latitude.toFixed(2)}, ${fire.longitude.toFixed(2)} with brightness ${brightness.toFixed(0)}.`,
      source: "NASA FIRMS",
      sourceUrl: "/api/fires",
      publishedAt: toIsoDate(fire.acq_date),
      url: "/api/fires",
      tags: ["thermal", "weather"],
      score: 12 + brightness / 20,
      severity: brightness >= 320 ? "watch" : "stable",
      kind: "thermal",
    };
  });
}

function buildMovementSeeds(movements: RefugeeMovement[]): SeedItem[] {
  return movements.slice(0, 6).map((movement, index) => ({
    id: `movement-${index + 1}-${movement.count}`,
    title: "Visitor movement pressure",
    summary: movement.label,
    source: "Mobility cache",
    sourceUrl: "/api/movements",
    publishedAt: new Date().toISOString(),
    url: "/api/movements",
    tags: ["tourism", "mobility", "traffic"],
    score: 14 + Math.log10(movement.count + 1) * 8,
    severity: movement.count >= 20000 ? "alert" : movement.count >= 10000 ? "watch" : "stable",
    kind: "movement",
  }));
}

function scoreSeedForPackage(item: SeedItem, definition: PackageDefinition) {
  const text = `${item.title} ${item.summary}`;
  const keywordSignals = readKeywordSignals(text, definition.focusTags);
  const focusBoost = definition.focusTags.reduce(
    (sum, tag) => sum + (item.tags.includes(tag) ? 6 : 0),
    0,
  );

  return item.score + keywordSignals.score + focusBoost;
}

function buildHeuristicPackageCopy(
  definition: PackageDefinition,
  items: SeedItem[],
): Pick<IntelligencePackage, "headline" | "summary" | "priorities"> {
  const lead = selectLeadItem(items);
  const dominantTags = Array.from(
    items
      .flatMap((item) => item.tags)
      .reduce((counts, tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())
      .entries(),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  if (!lead) {
    return {
      headline: `${definition.title} remains active.`,
      summary: definition.description,
      priorities: [
        "Refresh live feeds and package sources on the next cycle.",
        "Keep the map overlays aligned with current weather and incident context.",
        "Use market and field cards together before escalating posture.",
      ],
    };
  }

  return {
    headline: `${definition.title}: ${lead.title}`,
    summary: `${items.length} ranked signals are active, with ${lead.source} currently leading the package. Dominant themes: ${dominantTags.join(", ") || "general conditions"}.`,
    priorities: [
      `Validate ${lead.source} against the current map overlays before escalating.`,
      `Keep ${definition.title.toLowerCase()} in the next analyst review cycle.`,
      dominantTags.length > 0
        ? `Check for convergence between ${dominantTags.join(", ")} signals and market stress.`
        : "Check for convergence between field signals and market stress.",
    ],
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as {
      headline?: unknown;
      summary?: unknown;
      priorities?: unknown;
    };
  } catch {
    return null;
  }
}

function extractResponseText(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry.content)) {
        return [];
      }

      return entry.content.flatMap((content) => {
        if (!isRecord(content)) {
          return [];
        }

        if (typeof content.text === "string") {
          return [content.text];
        }

        return [];
      });
    })
    .join("\n");
}

async function summarizeWithAi(
  definition: PackageDefinition,
  items: SeedItem[],
): Promise<Pick<IntelligencePackage, "headline" | "summary" | "priorities"> | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey || items.length === 0) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You summarize intelligence packages for an operator dashboard. Return JSON only with headline, summary, priorities.",
          },
          {
            role: "user",
            content: JSON.stringify({
              package: definition.title,
              description: definition.description,
              items: items.slice(0, 6).map((item) => ({
                title: item.title,
                summary: item.summary,
                source: item.source,
                tags: item.tags,
                severity: item.severity,
                publishedAt: item.publishedAt,
              })),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    const parsed = extractJsonObject(extractResponseText(payload));

    if (
      parsed &&
      typeof parsed.headline === "string" &&
      typeof parsed.summary === "string" &&
      Array.isArray(parsed.priorities) &&
      parsed.priorities.every((value) => typeof value === "string")
    ) {
      return {
        headline: parsed.headline,
        summary: parsed.summary,
        priorities: parsed.priorities.slice(0, 3),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function buildPackageStats(items: SeedItem[]) {
  const dominantTags = Array.from(
    items
      .flatMap((item) => item.tags)
      .reduce((counts, tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())
      .entries(),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return {
    total: items.length,
    elevated: items.filter((item) => item.severity !== "stable").length,
    dominantTags,
    incidents: items.filter((item) => item.kind === "incident").length,
    markets: items.filter((item) => item.kind === "market").length,
    weather: items.filter((item) =>
      ["weather", "thermal", "movement"].includes(item.kind),
    ).length,
  };
}

async function buildPackage(
  definition: PackageDefinition,
  sourceCache: Map<string, { items: SeedItem[]; health: SourceHealth }>,
  syntheticItems: SeedItem[],
): Promise<{ pkg: IntelligencePackage; sources: SourceHealth[] }> {
  const sources = FEED_SOURCES.filter((source) =>
    definition.sourceIds.includes(source.id),
  );
  const querySources = buildSearchSources(definition);
  const sourceResults = await Promise.all(
    [...sources, ...querySources].map((source) =>
      fetchSourceSeeds(source, definition.focusTags, sourceCache),
    ),
  );

  const matchedFeedItems = sourceResults
    .flatMap((result) => result.items)
    .filter((item) => definition.matcher(item));
  const matchedSynthetic = syntheticItems.filter((item) =>
    matchesPackage(item, definition),
  );

  const scoredItems = [...matchedFeedItems, ...matchedSynthetic].map((item) => ({
    ...item,
    score: scoreSeedForPackage(item, definition),
  }));

  const ranked = dedupeAndSortSeeds(
    scoredItems.filter(
      (item) =>
        definition.matcher(item) ||
        item.tags.some((tag) => definition.focusTags.includes(tag)),
    ),
    6,
  );
  const packageCopy =
    (await summarizeWithAi(definition, ranked)) ??
    buildHeuristicPackageCopy(definition, ranked);
  const stats = buildPackageStats(ranked);
  const updatedAt = getLatestTimestamp(ranked.map((item) => item.publishedAt));

  const pkg: IntelligencePackage = {
    id: definition.id,
    title: definition.title,
    headline: packageCopy.headline,
    summary: packageCopy.summary,
    description: definition.description,
    priorities: packageCopy.priorities,
    dominantTags: stats.dominantTags,
    sourceLabels: Array.from(
      new Set(
        ranked
          .map((item) => item.source)
          .concat(sourceResults.map((result) => result.health.label)),
      ),
    ).slice(0, 6),
    updatedAt,
    status: ranked.length > 0 ? "live" : "offline",
    items: ranked.map((item, index) => ({
      ...item,
      id: `${definition.id}-${index + 1}-${normalizeTitle(item.title).slice(0, 36)}`,
      packageId: definition.id,
    })),
    stats,
  };

  return {
    pkg,
    sources: sourceResults.map((result) => result.health),
  };
}

async function buildLivePackagePayload(): Promise<IntelligencePackageResponse> {
  const [incidents, indicators, fires, rainfall, movements] = await Promise.all([
    loadThailandIncidents(),
    loadThailandEconomics(),
    loadFires(),
    loadRainfall(),
    loadRefugeeMovements(),
  ]);
  const sourceCache = new Map<string, { items: SeedItem[]; health: SourceHealth }>();
  const syntheticItems = [
    ...buildIncidentSeeds(incidents),
    ...buildMarketSeeds(indicators),
    ...buildRainfallSeeds(rainfall),
    ...buildFireSeeds(fires),
    ...buildMovementSeeds(movements),
  ];

  const packageResults = await Promise.all(
    PACKAGE_DEFINITIONS.map((definition) =>
      buildPackage(definition, sourceCache, syntheticItems),
    ),
  );

  const packages = packageResults.map((result) => result.pkg);
  const sources = Array.from(
    packageResults
      .flatMap((result) => result.sources)
      .reduce((map, source) => map.set(source.id, source), new Map<string, SourceHealth>())
      .values(),
  ).sort((left, right) => left.label.localeCompare(right.label));

  return {
    generatedAt:
      packages
        .map((pkg) => pkg.updatedAt)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ??
      new Date().toISOString(),
    mode: "live",
    packages,
    sources,
  };
}

export async function loadIntelligencePackages(): Promise<IntelligencePackageResponse> {
  const cached = await loadCachedIntelligencePayload(INTELLIGENCE_CACHE_MAX_AGE_MS);

  if (cached?.fresh) {
    return cached.payload;
  }

  try {
    const livePayload = await buildLivePackagePayload();
    await storeCachedIntelligencePayload(livePayload);
    return livePayload;
  } catch {
    if (cached?.payload) {
      return synthesizeStalePayload(cached.payload);
    }

    return {
      generatedAt: new Date().toISOString(),
      mode: "offline",
      packages: [
        {
          id: "marine-weather",
          title: "Marine and Monsoon Conditions",
          headline: "West coast marine conditions remain the lead operating signal.",
          summary:
            "Fallback intelligence package focused on sea state, rainfall, and access reliability until live sources recover.",
          description:
            "Marine access, rain bursts, pier operations, and west coast weather pressure around Phuket and nearby Andaman provinces.",
          priorities: [
            "Keep west coast marine advisories and pier conditions in the active review loop.",
            "Refresh rainfall, true-color, and thermal overlays in the next cycle.",
            "Cross-check mobility and road access before escalating a weather-led signal.",
          ],
          dominantTags: ["marine", "weather", "mobility"],
          sourceLabels: ["Fallback intelligence"],
          updatedAt: fallbackNews.generatedAt,
          status: "offline",
          items: [
            ...buildIncidentSeeds(fallbackIncidents).slice(1, 2),
            ...buildRainfallSeeds(fallbackRainfall).slice(0, 1),
            ...buildFireSeeds(fallbackFires).slice(0, 1),
          ]
            .map((item, index) => ({
              ...item,
              id: `marine-weather-fallback-${index + 1}`,
              packageId: "marine-weather",
            })),
          stats: {
            total: 3,
            elevated: 2,
            dominantTags: ["marine", "weather", "mobility"],
            incidents: 1,
            markets: 0,
            weather: 2,
          },
        },
        {
          id: "tourism-demand",
          title: "Tourism Demand and Transfers",
          headline: "Arrivals and hotel demand remain firm into the current cycle.",
          summary:
            "Fallback package focused on arrivals, occupancy, and transfer demand until live feeds resume.",
          description:
            "Visitor arrivals, airport transfers, hotel occupancy, and destination pull across Phuket and Krabi.",
          priorities: [
            "Track airport arrivals, hotel occupancy, and transfer demand together.",
            "Use movement traces and flight paths to validate demand spikes.",
            "Check whether weather pressure is beginning to suppress visitor mobility.",
          ],
          dominantTags: ["tourism", "economy", "mobility"],
          sourceLabels: ["Fallback intelligence"],
          updatedAt: fallbackNews.generatedAt,
          status: "offline",
          items: [
            ...buildMarketSeeds(fallbackEconomicIndicators).slice(0, 2),
            ...buildMovementSeeds(fallbackRefugees).slice(0, 1),
          ].map((item, index) => ({
            ...item,
            id: `tourism-demand-fallback-${index + 1}`,
            packageId: "tourism-demand",
          })),
          stats: {
            total: 3,
            elevated: 1,
            dominantTags: ["tourism", "economy", "mobility"],
            incidents: 0,
            markets: 2,
            weather: 1,
          },
        },
        {
          id: "road-safety",
          title: "Road Safety and Mobility",
          headline: "Rain-linked road risk remains concentrated on Phuket access routes.",
          summary:
            "Fallback package focused on roadway friction, transfer reliability, and local mobility pressure.",
          description:
            "Road safety, airport access, rain-driven disruption, and transport risk on Phuket and nearby provincial routes.",
          priorities: [
            "Check Patong Hill, airport access roads, and transfer routes after heavy rain.",
            "Cross-read incident points with rainfall and movement overlays.",
            "Escalate only when road risk and weather pressure reinforce each other.",
          ],
          dominantTags: ["traffic", "weather", "mobility"],
          sourceLabels: ["Fallback intelligence"],
          updatedAt: fallbackNews.generatedAt,
          status: "offline",
          items: [
            ...buildIncidentSeeds(fallbackIncidents).slice(0, 1),
            ...buildIncidentSeeds(fallbackIncidents).slice(2, 3),
            ...buildRainfallSeeds(fallbackRainfall).slice(0, 1),
          ].map((item, index) => ({
            ...item,
            id: `road-safety-fallback-${index + 1}`,
            packageId: "road-safety",
          })),
          stats: {
            total: 3,
            elevated: 2,
            dominantTags: ["traffic", "weather", "mobility"],
            incidents: 2,
            markets: 0,
            weather: 1,
          },
        },
        {
          id: "cost-logistics",
          title: "Costs and Local Operating Economics",
          headline: "Diesel and FX remain the main second-order cost signals.",
          summary:
            "Fallback package using available cost, demand, and operating indicators.",
          description:
            "Diesel, FX, tourism demand, and operating cost signals shaping the local Phuket picture.",
          priorities: [
            "Track diesel, FX, and occupancy together rather than reading them in isolation.",
            "Use the market radar as the lead operating-cost readout.",
            "Escalate cost pressure only when it starts to affect mobility or demand.",
          ],
          dominantTags: ["economy", "tourism"],
          sourceLabels: ["Fallback economics"],
          updatedAt: fallbackTicker.generatedAt,
          status: "offline",
          items: buildMarketSeeds(fallbackEconomicIndicators)
            .slice(0, 3)
            .map((item, index) => ({
              ...item,
              id: `cost-logistics-fallback-${index + 1}`,
              packageId: "cost-logistics",
            })),
          stats: {
            total: 3,
            elevated: 2,
            dominantTags: ["economy", "tourism"],
            incidents: 0,
            markets: 3,
            weather: 0,
          },
        },
      ],
      sources: [],
    };
  }
}

export async function buildNewsFromPackages(): Promise<NewsResponse> {
  const payload = await loadIntelligencePackages();
  const allItems = payload.packages.flatMap((pkg) => pkg.items);
  const rankedItems = buildRankedNewsItems(allItems, 6);
  const items = rankedItems.map<NewsItem>((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      tag: item.tags[0] ?? item.kind,
      publishedAt: item.publishedAt,
      severity: item.severity,
    }));

  return {
    generatedAt: getLatestTimestamp(rankedItems.map((item) => item.publishedAt)),
    news: items.length > 0 ? items : fallbackNews.news,
  };
}

export async function buildTickerFromPackages(): Promise<TickerResponse> {
  const [payload, indicators, incidents] = await Promise.all([
    loadIntelligencePackages(),
    loadThailandEconomics().catch(() => fallbackEconomicIndicators),
    loadThailandIncidents().catch(() => fallbackIncidents),
  ]);
  const topPackage = payload.packages[0];
  const leadIndicator = indicators[0] ?? fallbackEconomicIndicators[0];
  const dominantTheme = topPackage?.dominantTags[0] ?? "conditions";

  const items: TickerItem[] = [
    {
      id: "package-load",
      label: "Packages",
      value: `${payload.packages.length} live`,
      delta: topPackage?.status ?? payload.mode,
      tone: payload.mode === "live" ? "up" : "neutral",
    },
    {
      id: "field-signals",
      label: "Field signals",
      value: `${incidents.length} active`,
      delta: topPackage?.title ?? "Thailand",
      tone: incidents.length >= 4 ? "up" : "neutral",
    },
    {
      id: "market-lead",
      label: leadIndicator.label,
      value:
        typeof leadIndicator.value === "number"
          ? leadIndicator.value.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })
          : leadIndicator.value,
      delta: formatIndicatorChange(leadIndicator.change),
      tone:
        typeof leadIndicator.change === "number"
          ? leadIndicator.change > 0
            ? "up"
            : leadIndicator.change < 0
              ? "down"
              : "neutral"
          : "neutral",
    },
    {
      id: "dominant-theme",
      label: "Theme",
      value: dominantTheme,
      delta: `${topPackage?.stats.elevated ?? 0} elevated`,
      tone: (topPackage?.stats.elevated ?? 0) > 0 ? "up" : "neutral",
    },
  ];

  return {
    generatedAt: payload.generatedAt,
    items: items.length > 0 ? items : fallbackTicker.items,
  };
}

export async function buildLatestBriefing(): Promise<BriefingPayload> {
  const [payload, indicators] = await Promise.all([
    loadIntelligencePackages(),
    loadThailandEconomics().catch(() => fallbackEconomicIndicators),
  ]);
  const leadPackage =
    payload.packages
      .slice()
      .sort((left, right) => right.stats.elevated - left.stats.elevated)[0] ??
    payload.packages[0];

  if (!leadPackage) {
    throw new Error("No intelligence packages available");
  }

  return {
    title: leadPackage.title,
    summary: leadPackage.headline,
    updatedAt: leadPackage.updatedAt,
    priorities: leadPackage.priorities,
    marketSignals: indicators
      .slice(0, 3)
      .map(
        (indicator) =>
          `${indicator.label}: ${formatIndicatorValue({
            label: indicator.label,
            value: indicator.value,
            unit: indicator.unit,
            change: indicator.change,
          })} (${formatIndicatorChange(indicator.change)}).`,
      ),
    outlook:
      leadPackage.status === "live"
        ? `${leadPackage.summary} ${leadPackage.stats.elevated} elevated signals are currently active.`
        : `${leadPackage.summary} Live feeds are degraded, so cross-check against the map overlays before actioning.`,
  };
}

export async function buildEnhancedSourceCatalog(): Promise<ApiSourceResponse> {
  const [referenceCatalog, packages, disaster, maritime, tourism] = await Promise.all([
    fetchReferenceApiCatalog().catch(() => ({ generatedAt: new Date().toISOString(), sources: [] })),
    loadIntelligencePackages(),
    loadDisasterFeed().catch(() => ({
      generatedAt: new Date().toISOString(),
      posture: "watch" as const,
      summary: "Fallback disaster posture",
      alerts: [],
      layers: [],
      rainfallNodes: 0,
      sources: ["Disaster fallback"],
    })),
    loadMaritimeSecurity().catch(() => ({
      generatedAt: new Date().toISOString(),
      posture: "watch" as const,
      summary: "Fallback maritime posture",
      provider: "AIS fallback",
      vessels: [],
      chokepoints: [],
      sources: ["AIS fallback"],
    })),
    loadTourismHotspots().catch(() => ({
      generatedAt: new Date().toISOString(),
      summary: "Fallback tourism posture",
      provider: "Tourism fallback",
      hotspots: [],
      sources: ["Tourism fallback"],
    })),
  ]);

  const healthById = new Map(packages.sources.map((source) => [source.id, source]));
  const derivedFeedSources = FEED_SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    url: source.url,
    kind: source.kind,
    target: "Phuket Intelligence",
    health: healthById.get(source.id)?.status,
    checkedAt: healthById.get(source.id)?.checkedAt,
  }));
  const warRoomSources = buildWarRoomSourceEntries({
    disaster,
    maritime,
    tourism,
  });

  return {
    generatedAt: packages.generatedAt || referenceCatalog.generatedAt,
    sources: [...derivedFeedSources, ...warRoomSources, ...referenceCatalog.sources],
  };
}

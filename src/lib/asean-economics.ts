import axios from "axios";
import { getAseanCountry, type AseanCountryCode } from "./asean-country-registry";
import {
  loadLatestStoredCountryEconomicIndicators,
  persistCountryEconomicIndicators,
} from "./history-store";
import type {
  AseanCountryProfileResponse,
  AseanProfileMetric,
  AseanProfileNewsItem,
  CountryEconomicIndicatorSnapshot,
} from "../types/dashboard";

const DEFAULT_WORLD_BANK_API_URL = "https://api.worldbank.org/v2";
const FEED_JSON_FALLBACK = "https://api.rss2json.com/v1/api.json?rss_url=";
const REQUEST_TIMEOUT_MS = 12_000;
const NEWS_LOOKBACK_DAYS = 14;

const ECONOMIC_NEWS_TERMS = [
  "economy",
  "inflation",
  "budget",
  "trade",
  "central bank",
  "growth",
  "debt",
  "currency",
  "exports",
  "imports",
  "banking",
  "gdp",
] as const;

interface WorldBankMetadata {
  page: number | string;
  pages: number | string;
  per_page: number | string;
  total: number | string;
}

interface WorldBankIndicatorRow {
  indicator: {
    id: string;
    value: string;
  };
  country: {
    id: string;
    value: string;
  };
  countryiso3code: string;
  date: string;
  value: number | null;
}

interface FeedSource {
  id: string;
  label: string;
  url: string;
  trustScore: number;
}

interface FeedItem {
  title: string;
  link: string;
  summary: string;
  pubDate: Date;
  source: string;
  trustScore: number;
}

interface CountryMetricDefinition {
  id: AseanProfileMetric["id"];
  label: string;
  indicatorCode: string;
  unit: string | null;
  secondaryIndicatorCode?: string;
  secondaryUnit?: string | null;
}

const PROFILE_METRICS: CountryMetricDefinition[] = [
  {
    id: "gdp-growth",
    label: "GDP growth",
    indicatorCode: "NY.GDP.MKTP.KD.ZG",
    unit: "%",
  },
  {
    id: "gdp-per-person",
    label: "GDP per person",
    indicatorCode: "NY.GDP.PCAP.CD",
    unit: "USD",
    secondaryIndicatorCode: "NY.GDP.PCAP.PP.CD",
    secondaryUnit: "int$",
  },
  {
    id: "inflation",
    label: "Inflation",
    indicatorCode: "FP.CPI.TOTL.ZG",
    unit: "%",
  },
  {
    id: "budget-balance",
    label: "Budget balance",
    indicatorCode: "GC.BAL.CASH.GD.ZS",
    unit: "% of GDP",
  },
  {
    id: "population",
    label: "Population",
    indicatorCode: "SP.POP.TOTL",
    unit: "people",
  },
];

const REQUIRED_INDICATOR_CODES = Array.from(
  new Set(
    PROFILE_METRICS.flatMap((metric) =>
      metric.secondaryIndicatorCode
        ? [metric.indicatorCode, metric.secondaryIndicatorCode]
        : [metric.indicatorCode],
    ),
  ),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberLike(value: unknown) {
  return typeof value === "number" || typeof value === "string";
}

function isWorldBankIndicatorRow(value: unknown): value is WorldBankIndicatorRow {
  return (
    isRecord(value) &&
    isRecord(value.indicator) &&
    typeof value.indicator.id === "string" &&
    typeof value.indicator.value === "string" &&
    isRecord(value.country) &&
    typeof value.country.id === "string" &&
    typeof value.country.value === "string" &&
    typeof value.countryiso3code === "string" &&
    typeof value.date === "string" &&
    (typeof value.value === "number" || value.value === null)
  );
}

function isWorldBankIndicatorResponse(
  value: unknown,
): value is [WorldBankMetadata, WorldBankIndicatorRow[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isRecord(value[0]) &&
    isNumberLike(value[0].page) &&
    isNumberLike(value[0].pages) &&
    isNumberLike(value[0].per_page) &&
    isNumberLike(value[0].total) &&
    Array.isArray(value[1]) &&
    value[1].every(isWorldBankIndicatorRow)
  );
}

function buildWorldBankIndicatorUrl(
  countryCode: string,
  indicatorCode: string,
) {
  const params = new URLSearchParams({
    format: "json",
    mrnev: "6",
    per_page: "50",
    source: "2",
  });

  return `${DEFAULT_WORLD_BANK_API_URL}/country/${countryCode}/indicator/${indicatorCode}?${params.toString()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await axios.get<T>(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });

  return response.data;
}

async function fetchWorldBankIndicator(
  countryCode: AseanCountryCode,
  indicatorCode: string,
  indicatorLabel: string,
  unit: string | null,
  countryLabel: string,
) {
  const payload = await fetchJson<unknown>(
    buildWorldBankIndicatorUrl(countryCode, indicatorCode),
  );

  if (!isWorldBankIndicatorResponse(payload)) {
    throw new Error("World Bank payload was not recognized");
  }

  const latest = payload[1].find(
    (row): row is WorldBankIndicatorRow & { value: number } =>
      row.countryiso3code === countryCode &&
      row.indicator.id === indicatorCode &&
      typeof row.value === "number" &&
      Number.isFinite(row.value),
  );

  if (!latest) {
    return null;
  }

  return {
    countryCode,
    country: countryLabel,
    indicatorCode,
    indicatorLabel,
    value: latest.value,
    unit,
    refYear: Number(latest.date),
    source: "World Bank WDI",
  } satisfies CountryEconomicIndicatorSnapshot;
}

function buildGoogleNewsSearchUrl(queryText: string, locale = "en-US") {
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

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDate(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
          trustScore: source.trustScore,
        },
      ];
    })
    .slice(0, 24);
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
        trustScore: source.trustScore,
      });
    }

    match = itemRegex.exec(xml);
  }

  if (items.length > 0) {
    return items.slice(0, 24);
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
        trustScore: source.trustScore,
      });
    }

    match = entryRegex.exec(xml);
  }

  return items.slice(0, 24);
}

async function fetchFeedItems(source: FeedSource): Promise<FeedItem[]> {
  try {
    const response = await axios.get<string>(source.url, {
      timeout: REQUEST_TIMEOUT_MS,
      responseType: "text",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (typeof response.data === "string" && response.data.includes("<")) {
      const parsed = parseXmlFeed(response.data, source);

      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fall through to rss2json.
  }

  try {
    const fallback = await axios.get<unknown>(
      `${FEED_JSON_FALLBACK}${encodeURIComponent(source.url)}`,
      {
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    return parseJsonFallback(fallback.data, source);
  } catch {
    return [];
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAliasPattern(aliases: string[]) {
  const normalized = aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0)
    .map(escapeRegex);

  return new RegExp(`\\b(?:${normalized.join("|")})\\b`, "i");
}

function buildEconomicsPattern() {
  return new RegExp(
    `\\b(?:${ECONOMIC_NEWS_TERMS.map(escapeRegex).join("|")})\\b`,
    "i",
  );
}

function isFeedItemInWindow(item: FeedItem) {
  const publishedAtMs = item.pubDate.getTime();
  const oldestAllowedMs = Date.now() - NEWS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  return (
    Number.isFinite(publishedAtMs) &&
    publishedAtMs >= oldestAllowedMs &&
    publishedAtMs <= Date.now() + 24 * 60 * 60 * 1000
  );
}

function dedupeNewsItems(items: FeedItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeTitle(item.title);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildNewsSources(countryCode: AseanCountryCode) {
  const country = getAseanCountry(countryCode);

  if (!country) {
    return [];
  }

  return [
    {
      id: `${countryCode}-search`,
      label: "Google News RSS",
      url: buildGoogleNewsSearchUrl(country.newsQuery),
      trustScore: 5,
    },
    {
      id: "bbc-world",
      label: "BBC World",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      trustScore: 9,
    },
    {
      id: "cna",
      label: "Channel NewsAsia",
      url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
      trustScore: 8,
    },
    {
      id: "nikkei-asia",
      label: "Nikkei Asia",
      url: "https://info.asia.nikkei.com/rss",
      trustScore: 10,
    },
    {
      id: "guardian-world",
      label: "Guardian World",
      url: "https://www.theguardian.com/world/rss",
      trustScore: 8,
    },
  ] satisfies FeedSource[];
}

async function fetchCountryEconomicNews(
  countryCode: AseanCountryCode,
): Promise<AseanProfileNewsItem[]> {
  const country = getAseanCountry(countryCode);

  if (!country) {
    return [];
  }

  const aliasPattern = buildAliasPattern(country.aliases);
  const economicsPattern = buildEconomicsPattern();
  const sources = buildNewsSources(countryCode);

  const items = (
    await Promise.all(sources.map((source) => fetchFeedItems(source)))
  )
    .flat()
    .filter(isFeedItemInWindow)
    .filter((item) => {
      const text = `${item.title} ${stripHtml(item.summary)}`;
      return aliasPattern.test(text) && economicsPattern.test(text);
    });

  const rankedItems = items.sort((left, right) => {
      const timeDiff = right.pubDate.getTime() - left.pubDate.getTime();

      if (timeDiff !== 0) {
        return timeDiff;
      }

      return right.trustScore - left.trustScore;
    });

  return dedupeNewsItems(rankedItems)
    .slice(0, 3)
    .map(
      (item, index): AseanProfileNewsItem => ({
        id: `${countryCode.toLowerCase()}-news-${index + 1}`,
        title: item.title,
        source: item.source,
        publishedAt: item.pubDate.toISOString(),
        url: item.link,
      }),
    );
}

async function loadIndicatorMap(
  countryCode: AseanCountryCode,
) {
  const country = getAseanCountry(countryCode);

  if (!country) {
    return {
      indicators: new Map<string, CountryEconomicIndicatorSnapshot>(),
      sources: new Set<string>(),
    };
  }

  const indicatorRequests = PROFILE_METRICS.flatMap((metric) => {
    const requests = [
      fetchWorldBankIndicator(
        countryCode,
        metric.indicatorCode,
        metric.label,
        metric.unit,
        country.label,
      ),
    ];

    if (metric.secondaryIndicatorCode) {
      requests.push(
        fetchWorldBankIndicator(
          countryCode,
          metric.secondaryIndicatorCode,
          `${metric.label} PPP`,
          metric.secondaryUnit ?? null,
          country.label,
        ),
      );
    }

    return requests;
  });

  const liveResults = await Promise.allSettled(indicatorRequests);
  const liveIndicators = liveResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
  const indicators = new Map<string, CountryEconomicIndicatorSnapshot>(
    liveIndicators.map((entry) => [entry.indicatorCode, entry]),
  );
  const sources = new Set<string>();

  if (liveIndicators.length > 0) {
    sources.add("World Bank WDI");

    try {
      await persistCountryEconomicIndicators(liveIndicators);
    } catch {
      // Best-effort persistence only.
    }
  }

  const missingCodes = REQUIRED_INDICATOR_CODES.filter(
    (indicatorCode) => !indicators.has(indicatorCode),
  );

  if (missingCodes.length > 0) {
    const storedIndicators =
      await loadLatestStoredCountryEconomicIndicators(countryCode);

    if (storedIndicators && storedIndicators.length > 0) {
      for (const entry of storedIndicators) {
        if (!indicators.has(entry.indicatorCode)) {
          indicators.set(entry.indicatorCode, entry);
        }
      }

      sources.add("Postgres country economic history");
    }
  }

  return { indicators, sources };
}

function buildMetric(
  definition: CountryMetricDefinition,
  indicators: Map<string, CountryEconomicIndicatorSnapshot>,
) {
  const primary = indicators.get(definition.indicatorCode);
  const secondary = definition.secondaryIndicatorCode
    ? indicators.get(definition.secondaryIndicatorCode)
    : null;

  return {
    id: definition.id,
    label: definition.label,
    value: primary?.value ?? null,
    unit: primary?.unit ?? definition.unit,
    year: primary?.refYear ?? null,
    source: primary?.source ?? "World Bank WDI",
    note: primary ? undefined : "No recent public value",
    secondaryValue: secondary?.value ?? null,
    secondaryUnit: secondary?.unit ?? definition.secondaryUnit ?? null,
    secondaryYear: secondary?.refYear ?? null,
  } satisfies AseanProfileMetric;
}

export async function loadAseanCountryProfile(
  countryCode: AseanCountryCode,
): Promise<AseanCountryProfileResponse> {
  const country = getAseanCountry(countryCode);

  if (!country) {
    throw new Error("Unsupported ASEAN country code");
  }

  const generatedAt = new Date().toISOString();
  const [indicatorState, news] = await Promise.all([
    loadIndicatorMap(countryCode),
    fetchCountryEconomicNews(countryCode).catch(() => []),
  ]);

  const metrics = PROFILE_METRICS.map((metric) =>
    buildMetric(metric, indicatorState.indicators),
  );
  const sources = Array.from(indicatorState.sources);

  if (news.length > 0) {
    sources.push("Country news feed");
  }

  return {
    generatedAt,
    country: {
      code: country.code,
      label: country.label,
      aliases: country.aliases,
    },
    metrics,
    news,
    sources: sources.length > 0 ? Array.from(new Set(sources)) : ["World Bank WDI"],
  };
}

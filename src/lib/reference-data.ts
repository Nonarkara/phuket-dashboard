import type {
  AseanGdpDatum,
  ApiSourceResponse,
  CopernicusPreviewResponse,
  EconomicIndicator,
} from "../types/dashboard";
import { ASEAN_COUNTRIES } from "./asean-country-registry";
import { buildMapOverlayCatalog } from "./map-overlays";

const DEFAULT_REFERENCE_DASHBOARD_URL =
  "https://dr-non-operating-systems.onrender.com/api/dashboard";
const DEFAULT_FX_RATES_URL = "https://open.er-api.com/v6/latest/USD";
const DEFAULT_BINANCE_TICKER_URL =
  "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const DEFAULT_WORLD_BANK_API_URL = "https://api.worldbank.org/v2";
const REQUEST_TIMEOUT_MS = 12_000;
const GDP_INDICATOR_ID = "NY.GDP.MKTP.CD";
const GDP_PER_CAPITA_INDICATOR_ID = "NY.GDP.PCAP.CD";

const ASEAN_WORLD_BANK_COUNTRIES = ASEAN_COUNTRIES.map((country) => ({
  code: country.code,
  name: country.label,
}));

interface ReferenceSummary {
  apiCount: number;
  activeCount: number;
  appsWithApis: number;
  liveCount: number;
  medianResponseMs: number;
  fastest?: {
    label: string;
    responseTimeMs: number;
  };
}

interface ReferenceApi {
  label: string;
  url: string;
  kind?: string;
}

interface ReferenceTarget {
  id: string;
  label: string;
  responseTimeMs: number;
  apis: ReferenceApi[];
}

interface ReferenceDashboardPayload {
  generatedAt: string;
  summary: ReferenceSummary;
  targets: ReferenceTarget[];
}

interface FxRatesResponse {
  result: string;
  rates: Record<string, number>;
}

interface BinanceTickerResponse {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

interface WorldBankMetadata {
  page: number;
  pages: number;
  per_page: string;
  total: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Reference request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function isReferenceApi(value: unknown): value is ReferenceApi {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.url === "string" &&
    (typeof value.kind === "undefined" || typeof value.kind === "string")
  );
}

function isReferenceTarget(value: unknown): value is ReferenceTarget {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.responseTimeMs === "number" &&
    Array.isArray(value.apis) &&
    value.apis.every(isReferenceApi)
  );
}

function isReferenceDashboardPayload(
  value: unknown,
): value is ReferenceDashboardPayload {
  return (
    isRecord(value) &&
    typeof value.generatedAt === "string" &&
    isRecord(value.summary) &&
    typeof value.summary.apiCount === "number" &&
    typeof value.summary.activeCount === "number" &&
    typeof value.summary.appsWithApis === "number" &&
    typeof value.summary.liveCount === "number" &&
    typeof value.summary.medianResponseMs === "number" &&
    Array.isArray(value.targets) &&
    value.targets.every(isReferenceTarget)
  );
}

function isBinanceTickerResponse(value: unknown): value is BinanceTickerResponse {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.lastPrice === "string" &&
    typeof value.priceChangePercent === "string"
  );
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
    typeof value[0].page === "number" &&
    typeof value[0].pages === "number" &&
    typeof value[0].per_page === "string" &&
    typeof value[0].total === "number" &&
    Array.isArray(value[1]) &&
    value[1].every(isWorldBankIndicatorRow)
  );
}

function findTargetApiUrl(
  dashboard: ReferenceDashboardPayload,
  targetId: string,
  label: string,
) {
  return dashboard.targets
    .find((target) => target.id === targetId)
    ?.apis.find((api) => api.label === label)?.url;
}

function findTarget(
  dashboard: ReferenceDashboardPayload,
  targetId: string,
) {
  return dashboard.targets.find((target) => target.id === targetId) ?? null;
}

export async function fetchReferenceDashboard() {
  const dashboardUrl =
    process.env.REFERENCE_DASHBOARD_URL ?? DEFAULT_REFERENCE_DASHBOARD_URL;
  const payload = await fetchJson<unknown>(dashboardUrl);

  if (!isReferenceDashboardPayload(payload)) {
    throw new Error("Reference dashboard payload was not recognized");
  }

  return payload;
}

export async function fetchReferenceEconomicIndicators() {
  const dashboard = await fetchReferenceDashboard();
  const fxUrl =
    findTargetApiUrl(dashboard, "tech-monitor", "FX rates") ??
    DEFAULT_FX_RATES_URL;
  const discoveredTickerUrl =
    findTargetApiUrl(dashboard, "tech-monitor", "Binance ticker") ??
    DEFAULT_BINANCE_TICKER_URL;
  const tickerUrl = discoveredTickerUrl.includes("symbol=")
    ? discoveredTickerUrl
    : `${discoveredTickerUrl}?symbol=BTCUSDT`;

  const [fxPayload, btcPayload] = await Promise.all([
    fetchJson<FxRatesResponse>(fxUrl),
    fetchJson<unknown>(tickerUrl),
  ]);

  if (
    fxPayload.result !== "success" ||
    typeof fxPayload.rates.THB !== "number" ||
    typeof fxPayload.rates.SGD !== "number" ||
    typeof fxPayload.rates.MYR !== "number"
  ) {
    throw new Error("Reference FX payload was incomplete");
  }

  const ticker =
    isBinanceTickerResponse(btcPayload)
      ? btcPayload
      : Array.isArray(btcPayload)
        ? btcPayload.find(
            (value): value is BinanceTickerResponse =>
              isBinanceTickerResponse(value) && value.symbol === "BTCUSDT",
          ) ?? null
        : null;

  if (!ticker) {
    throw new Error("Reference Binance payload was incomplete");
  }

  const btcPrice = Number(ticker.lastPrice);
  const btcChange = Number(ticker.priceChangePercent);

  if (!Number.isFinite(btcPrice) || !Number.isFinite(btcChange)) {
    throw new Error("Reference Binance payload was incomplete");
  }

  const thbPerUsd = fxPayload.rates.THB;
  const sgdPerUsd = fxPayload.rates.SGD;
  const myrPerUsd = fxPayload.rates.MYR;

  return [
    {
      label: "USD/THB",
      value: Number(thbPerUsd.toFixed(2)),
      change: 0,
      up: true,
      category: "FX",
      source: "dr-non-operating-systems",
    },
    {
      label: "SGD/THB",
      value: Number((thbPerUsd / sgdPerUsd).toFixed(2)),
      change: 0,
      up: true,
      category: "FX",
      source: "dr-non-operating-systems",
    },
    {
      label: "MYR/THB",
      value: Number((thbPerUsd / myrPerUsd).toFixed(2)),
      change: 0,
      up: true,
      category: "FX",
      source: "dr-non-operating-systems",
    },
    {
      label: "BTC/USD",
      value: Number(btcPrice.toFixed(0)),
      change: Number(btcChange.toFixed(2)),
      up: btcChange >= 0,
      category: "Crypto",
      source: "dr-non-operating-systems",
    },
  ] satisfies EconomicIndicator[];
}

function buildWorldBankIndicatorUrl(indicatorId: string) {
  const countries = ASEAN_WORLD_BANK_COUNTRIES.map((country) => country.code).join(";");
  const params = new URLSearchParams({
    format: "json",
    mrnev: "1",
    per_page: "100",
    source: "2",
  });

  return `${DEFAULT_WORLD_BANK_API_URL}/country/${countries}/indicator/${indicatorId}?${params.toString()}`;
}

function toWorldBankSeries(
  payload: unknown,
  indicatorId: string,
) {
  if (!isWorldBankIndicatorResponse(payload)) {
    throw new Error("World Bank payload was not recognized");
  }

  return payload[1]
    .filter(
      (row) =>
        row.indicator.id === indicatorId &&
        row.value !== null &&
        row.countryiso3code &&
        Number.isFinite(row.value),
    )
    .map((row) => ({
      countryCode: row.countryiso3code,
      year: Number(row.date),
      value: row.value as number,
    }))
    .filter((row) => Number.isFinite(row.year));
}

export async function fetchAseanGdpSnapshot(): Promise<AseanGdpDatum[]> {
  const [gdpPayload, gdpPerCapitaPayload] = await Promise.all([
    fetchJson<unknown>(buildWorldBankIndicatorUrl(GDP_INDICATOR_ID)),
    fetchJson<unknown>(buildWorldBankIndicatorUrl(GDP_PER_CAPITA_INDICATOR_ID)),
  ]);

  const gdpSeries = new Map(
    toWorldBankSeries(gdpPayload, GDP_INDICATOR_ID).map((row) => [
      row.countryCode,
      row,
    ]),
  );
  const gdpPerCapitaSeries = new Map(
    toWorldBankSeries(gdpPerCapitaPayload, GDP_PER_CAPITA_INDICATOR_ID).map((row) => [
      row.countryCode,
      row,
    ]),
  );

  const snapshot: Array<AseanGdpDatum | null> = ASEAN_WORLD_BANK_COUNTRIES.map((country) => {
    const gdp = gdpSeries.get(country.code);
    const gdpPerCapita = gdpPerCapitaSeries.get(country.code);

    if (!gdp || !gdpPerCapita) {
      return null;
    }

    return {
      countryCode: country.code,
      country: country.name,
      gdpUsd: gdp.value,
      gdpPerCapitaUsd: gdpPerCapita.value,
      gdpYear: gdp.year,
      gdpPerCapitaYear: gdpPerCapita.year,
      source: "World Bank WDI",
    };
  });

  return snapshot
    .filter((row): row is AseanGdpDatum => row !== null)
    .sort((left, right) => right.gdpUsd - left.gdpUsd);
}

export async function fetchReferenceApiCatalog(): Promise<ApiSourceResponse> {
  const dashboard = await fetchReferenceDashboard();
  const sources = [
    "middle-east-monitor",
    "tech-monitor",
  ].flatMap((targetId) => {
    const target = findTarget(dashboard, targetId);

    if (!target) {
      return [];
    }

    return target.apis.map((api, index) => ({
      id: `${target.id}-${index + 1}`,
      label: api.label,
      url: api.url,
      kind: api.kind ?? "internal",
      target: target.label,
    }));
  });

  return {
    generatedAt: dashboard.generatedAt,
    sources,
  };
}

export function buildCopernicusPreview(focusDate: string): CopernicusPreviewResponse {
  const catalog = buildMapOverlayCatalog(focusDate);

  return {
    updatedAt: catalog.updatedAt,
    focusDate,
    imagerySources: catalog.overlays
      .filter((overlay) => overlay.role === "base-option")
      .map((overlay) => ({
        id: overlay.id,
        label: overlay.label,
        description: overlay.description,
      })),
  };
}

export async function fetchReferenceStatusSummary() {
  const dashboard = await fetchReferenceDashboard();

  return {
    generatedAt: dashboard.generatedAt,
    liveCount: dashboard.summary.liveCount,
    activeCount: dashboard.summary.activeCount,
    apiCount: dashboard.summary.apiCount,
    appsWithApis: dashboard.summary.appsWithApis,
    medianResponseMs: dashboard.summary.medianResponseMs,
    fastestLabel: dashboard.summary.fastest?.label ?? null,
    fastestResponseMs: dashboard.summary.fastest?.responseTimeMs ?? null,
  };
}

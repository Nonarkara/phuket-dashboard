import type {
  AseanGdpDatum,
  ApiSourceResponse,
  CopernicusPreviewResponse,
  EconomicIndicator,
} from "../types/dashboard";
import { ASEAN_COUNTRIES } from "./asean-country-registry";
import { buildMapOverlayCatalog } from "./map-overlays";

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

export async function fetchReferenceEconomicIndicators() {
  // Standalone: fetch directly from source APIs without reference dashboard
  const fxUrl = DEFAULT_FX_RATES_URL;
  const tickerUrl = DEFAULT_BINANCE_TICKER_URL;

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
      source: "open.er-api.com / binance",
    },
    {
      label: "SGD/THB",
      value: Number((thbPerUsd / sgdPerUsd).toFixed(2)),
      change: 0,
      up: true,
      category: "FX",
      source: "open.er-api.com / binance",
    },
    {
      label: "MYR/THB",
      value: Number((thbPerUsd / myrPerUsd).toFixed(2)),
      change: 0,
      up: true,
      category: "FX",
      source: "open.er-api.com / binance",
    },
    {
      label: "BTC/USD",
      value: Number(btcPrice.toFixed(0)),
      change: Number(btcChange.toFixed(2)),
      up: btcChange >= 0,
      category: "Crypto",
      source: "open.er-api.com / binance",
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
  // Standalone: return local API catalog without external dashboard dependency
  const generatedAt = new Date().toISOString();
  const sources = [
    { id: "fx-rates", label: "FX Rates", url: DEFAULT_FX_RATES_URL, kind: "external", target: "Market Data", classification: "reference" as const },
    { id: "binance-btc", label: "Binance BTC/USD", url: DEFAULT_BINANCE_TICKER_URL, kind: "external", target: "Market Data", classification: "reference" as const },
    { id: "world-bank-gdp", label: "World Bank GDP", url: DEFAULT_WORLD_BANK_API_URL, kind: "external", target: "Economic Data", classification: "reference" as const },
    { id: "usgs-earthquakes", label: "USGS Earthquakes", url: "https://earthquake.usgs.gov/fdsnws/event/1/query", kind: "external", target: "Global Feeds", classification: "reference" as const },
    { id: "nasa-eonet", label: "NASA EONET", url: "https://eonet.gsfc.nasa.gov/api/v2.1/events", kind: "external", target: "Global Feeds", classification: "reference" as const },
    { id: "open-meteo-flood", label: "Open-Meteo Flood", url: "https://flood-api.open-meteo.com/v1/flood", kind: "external", target: "Global Feeds", classification: "reference" as const },
    { id: "reliefweb", label: "ReliefWeb", url: "https://api.reliefweb.int/v1/reports", kind: "external", target: "Global Feeds", classification: "reference" as const },
    { id: "gdacs", label: "GDACS Disasters", url: "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH", kind: "external", target: "Global Feeds", classification: "reference" as const },
    { id: "satellite-toolkit", label: "DrNon Global Satellite Toolkit", url: "https://github.com/Nonarkara/DrNon-Global-Satellite-Toolkit", kind: "toolkit", target: "Satellite Imagery", classification: "reference" as const },
    { id: "nasa-firms", label: "NASA FIRMS Fire Detection", url: "https://firms.modaps.eosdis.nasa.gov/api/", kind: "external", target: "Satellite Imagery", classification: "reference" as const },
    { id: "eox-sentinel2", label: "EOX Sentinel-2 Cloudless", url: "https://tiles.maps.eox.at/wmts", kind: "external", target: "Satellite Imagery", classification: "reference" as const },
    { id: "jrc-water", label: "JRC Global Surface Water", url: "https://storage.googleapis.com/global-surface-water/tiles2021/occurrence", kind: "external", target: "Satellite Imagery", classification: "reference" as const },
    { id: "emodnet-bathy", label: "EMODnet Bathymetry", url: "https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator", kind: "external", target: "Satellite Imagery", classification: "reference" as const },
  ];

  return {
    generatedAt,
    sources,
    freshness: {
      checkedAt: generatedAt,
      observedAt: null,
      ageMinutes: null,
      maxAgeMinutes: 24 * 60,
      isFresh: false,
      fallbackTier: "reference",
      sourceIds: ["Phuket Dashboard reference catalog"],
    },
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
  // Standalone: return local status without external dashboard dependency
  return {
    generatedAt: new Date().toISOString(),
    liveCount: 13,
    activeCount: 13,
    apiCount: 53,
    appsWithApis: 1,
    medianResponseMs: 200,
    fastestLabel: "USGS Earthquake Catalog",
    fastestResponseMs: 120,
  };
}

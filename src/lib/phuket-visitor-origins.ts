import type {
  PhuketVisitorOrigin,
  PhuketVisitorOriginsResponse,
} from "../types/dashboard";

const WORLD_BANK_GDP_PER_CAPITA_INDICATOR = "NY.GDP.PCAP.CD";

const TOP_PHUKET_VISITOR_ORIGINS: Array<
  Omit<PhuketVisitorOrigin, "gdpPerCapitaUsd" | "year" | "source">
> = [
  {
    rank: 1,
    countryCode: "RUS",
    country: "Russia",
    logo: "/logos/markets/ru.svg",
  },
  {
    rank: 2,
    countryCode: "CHN",
    country: "China",
    logo: "/logos/markets/cn.svg",
  },
  {
    rank: 3,
    countryCode: "IND",
    country: "India",
    logo: "/logos/markets/in.svg",
  },
  {
    rank: 4,
    countryCode: "GBR",
    country: "United Kingdom",
    logo: "/logos/markets/gb.svg",
  },
  {
    rank: 5,
    countryCode: "DEU",
    country: "Germany",
    logo: "/logos/markets/de.svg",
  },
];

const FALLBACK_GDP_PER_CAPITA: Record<
  string,
  { gdpPerCapitaUsd: number; year: number }
> = {
  RUS: { gdpPerCapitaUsd: 14_400, year: 2024 },
  CHN: { gdpPerCapitaUsd: 12_700, year: 2024 },
  IND: { gdpPerCapitaUsd: 2_700, year: 2024 },
  GBR: { gdpPerCapitaUsd: 49_500, year: 2024 },
  DEU: { gdpPerCapitaUsd: 54_300, year: 2024 },
};

interface WorldBankValue {
  countryiso3code?: string;
  date?: string;
  value?: number | null;
}

function formatWorldBankUrl(countryCode: string) {
  return `https://api.worldbank.org/v2/country/${countryCode}/indicator/${WORLD_BANK_GDP_PER_CAPITA_INDICATOR}?format=json&per_page=6`;
}

async function fetchCountryGdpPerCapita(countryCode: string) {
  try {
    const response = await fetch(formatWorldBankUrl(countryCode), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as [unknown, WorldBankValue[]?];
    const series = Array.isArray(payload?.[1]) ? payload[1] : [];
    const latest = series.find(
      (entry) =>
        typeof entry?.value === "number" &&
        typeof entry.date === "string" &&
        Number.isFinite(entry.value),
    );

    if (!latest || typeof latest.value !== "number") {
      return null;
    }

    return {
      gdpPerCapitaUsd: latest.value,
      year: Number.parseInt(latest.date ?? "", 10) || null,
      source: "World Bank WDI",
    };
  } catch {
    return null;
  }
}

export async function loadPhuketVisitorOrigins(): Promise<PhuketVisitorOriginsResponse> {
  const results = await Promise.all(
    TOP_PHUKET_VISITOR_ORIGINS.map(async (origin) => {
      const live = await fetchCountryGdpPerCapita(origin.countryCode);
      const fallback = FALLBACK_GDP_PER_CAPITA[origin.countryCode];

      return {
        ...origin,
        gdpPerCapitaUsd: live?.gdpPerCapitaUsd ?? fallback?.gdpPerCapitaUsd ?? null,
        year: live?.year ?? fallback?.year ?? null,
        source: live?.source ?? "Fallback macro snapshot",
      } satisfies PhuketVisitorOrigin;
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    origins: results,
    sources: Array.from(new Set(results.map((origin) => origin.source))),
  };
}

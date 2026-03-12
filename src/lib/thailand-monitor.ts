import { query } from "./db";
import {
  fallbackBriefing,
  fallbackEconomicIndicators,
  fallbackIncidents,
  fallbackNews,
  fallbackTicker,
} from "./mock-data";
import { fetchReferenceEconomicIndicators } from "./reference-data";
import type {
  BriefingPayload,
  Coordinates,
  EconomicIndicator,
  IncidentFeature,
  NewsItem,
  NewsResponse,
  TickerItem,
  TickerResponse,
} from "../types/dashboard";

interface IncidentRow {
  id: string;
  type: string | null;
  notes: string | null;
  fatalities: number | null;
  lng: number | null;
  lat: number | null;
  location: string | null;
  event_date: string | null;
}

interface MarketIndicatorRow {
  label: string;
  value: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  province: string | null;
  previous_value: number | null;
}

function formatIndicatorValue(value: number | string, unit?: string | null) {
  const text =
    typeof value === "number"
      ? Number.isInteger(value)
        ? value.toString()
        : value.toFixed(2)
      : value;

  return unit ? `${text}${unit}` : text;
}

function formatDelta(change: number | string) {
  if (typeof change === "number") {
    if (change === 0) {
      return "flat";
    }

    return `${change > 0 ? "+" : ""}${change}`;
  }

  return String(change);
}

function getSeverity(fatalities: number) {
  if (fatalities >= 2) {
    return "alert" as const;
  }

  if (fatalities >= 1) {
    return "watch" as const;
  }

  return "stable" as const;
}

export async function loadThailandIncidents(): Promise<IncidentFeature[]> {
  try {
    const res = await query<IncidentRow>(`
      SELECT
        external_id as id,
        event_type as type,
        notes,
        fatalities,
        ST_X(geom) as lng,
        ST_Y(geom) as lat,
        location,
        event_date
      FROM events
      WHERE geom IS NOT NULL
      ORDER BY event_date DESC
      LIMIT 100
    `);

    const incidents = res.rows
      .filter((row) => row.lng !== null && row.lat !== null)
      .map((row): IncidentFeature => {
        const coordinates: Coordinates = [row.lng ?? 0, row.lat ?? 0];

        return {
          id: row.id,
          geometry: { coordinates },
          properties: {
            title: row.type ?? "Unclassified incident",
            type: row.type ?? "Unclassified incident",
            fatalities: row.fatalities ?? 0,
            notes: row.notes ?? "No incident narrative available.",
            location: row.location ?? "Unspecified location",
            eventDate: row.event_date ?? "",
          },
        };
      });

    return incidents.length > 0 ? incidents : fallbackIncidents;
  } catch {
    return fallbackIncidents;
  }
}

export async function loadThailandEconomics(): Promise<EconomicIndicator[]> {
  try {
    const indicators = await fetchReferenceEconomicIndicators();

    if (indicators.length > 0) {
      return indicators;
    }
  } catch {
    // Fall through to DB-backed and mock values.
  }

  try {
    const res = await query<MarketIndicatorRow>(`
      WITH ranked_market_data AS (
        SELECT
          indicator as label,
          value,
          unit,
          category,
          source,
          province,
          LAG(value) OVER (
            PARTITION BY indicator, COALESCE(province, '')
            ORDER BY ref_date, created_at
          ) as previous_value,
          ROW_NUMBER() OVER (
            PARTITION BY indicator, COALESCE(province, '')
            ORDER BY ref_date DESC, created_at DESC
          ) as latest_rank
        FROM market_data
      )
      SELECT
        label,
        value,
        unit,
        category,
        source,
        province,
        previous_value
      FROM ranked_market_data
      WHERE latest_rank = 1
      ORDER BY category NULLS LAST, label
      LIMIT 10
    `);

    const indicators = res.rows.map((row) => {
      const change =
        row.previous_value === null
          ? 0
          : Number((row.value - row.previous_value).toFixed(2));

      return {
        label: row.label,
        value: row.value,
        unit: row.unit,
        category: row.category,
        source: row.source,
        province: row.province,
        change,
        up: change >= 0,
      };
    });

    return indicators.length > 0 ? indicators : fallbackEconomicIndicators;
  } catch {
    return fallbackEconomicIndicators;
  }
}

export function buildThailandNews(
  incidents: IncidentFeature[],
  indicators: EconomicIndicator[],
): NewsResponse {
  if (incidents.length === 0) {
    return fallbackNews;
  }

  const fieldItems = incidents.slice(0, 4).map<NewsItem>((incident) => ({
    id: incident.id,
    title: `${incident.properties.type} / ${incident.properties.location}`,
    summary: incident.properties.notes,
    source: "Thailand monitor",
    tag: "Field",
    publishedAt: incident.properties.eventDate || new Date().toISOString(),
    severity: getSeverity(incident.properties.fatalities),
  }));

  const marketItems = indicators.slice(0, 2).map<NewsItem>((indicator, index) => ({
    id: `market-${index + 1}`,
    title: `${indicator.label} in focus`,
    summary: `${indicator.label} is currently ${formatIndicatorValue(
      indicator.value,
      indicator.unit,
    )} with a move of ${formatDelta(indicator.change)}.`,
    source: "Market radar",
    tag: "Markets",
    publishedAt: new Date().toISOString(),
    severity:
      typeof indicator.change === "number" && Math.abs(indicator.change) >= 1
        ? "watch"
        : "stable",
  }));

  return {
    generatedAt: new Date().toISOString(),
    news: [...fieldItems, ...marketItems].slice(0, 6),
  };
}

export function buildThailandTicker(
  incidents: IncidentFeature[],
  indicators: EconomicIndicator[],
): TickerResponse {
  if (incidents.length === 0 && indicators.length === 0) {
    return fallbackTicker;
  }

  const latestIncident = incidents[0];
  const marketItems = indicators.slice(0, 2).map<TickerItem>((indicator, index) => ({
    id: `market-${index + 1}`,
    label: indicator.label,
    value: formatIndicatorValue(indicator.value, indicator.unit),
    delta: formatDelta(indicator.change),
    tone:
      typeof indicator.change === "number"
        ? indicator.change > 0
          ? "up"
          : indicator.change < 0
            ? "down"
            : "neutral"
        : "neutral",
  }));

  return {
    generatedAt: latestIncident?.properties.eventDate ?? new Date().toISOString(),
    items: [
      {
        id: "field-signals",
        label: "Field signals",
        value: `${incidents.length} active`,
        delta:
          latestIncident?.properties.location ??
          fallbackTicker.items[0]?.delta ??
          "monitor",
        tone: incidents.length >= 4 ? "up" : "neutral",
      },
      {
        id: "primary-sector",
        label: "Primary sector",
        value: latestIncident?.properties.type ?? "Standby",
        delta: latestIncident?.properties.location ?? "Thailand",
        tone:
          latestIncident && latestIncident.properties.fatalities > 0
            ? "up"
            : "neutral",
      },
      ...marketItems,
    ],
  };
}

export function buildThailandBriefing(
  incidents: IncidentFeature[],
  indicators: EconomicIndicator[],
): BriefingPayload {
  if (incidents.length === 0) {
    return fallbackBriefing;
  }

  const lead = incidents[0];
  const locations = Array.from(
    new Set(incidents.slice(0, 6).map((incident) => incident.properties.location)),
  ).slice(0, 3);
  const totalFatalities = incidents.reduce(
    (sum, incident) => sum + incident.properties.fatalities,
    0,
  );

  return {
    title: "Phuket regional briefing",
    summary: `${incidents.length} Phuket-linked signals are in the current operating picture, led by ${lead.properties.type.toLowerCase()} activity around ${lead.properties.location}.`,
    updatedAt: lead.properties.eventDate || new Date().toISOString(),
    priorities: [
      `Keep ${locations.join(", ")} in the active review loop.`,
      indicators[0]
        ? `Use ${indicators[0].label} as the lead market stress signal.`
        : "Use tourism demand and cost indicators as the lead market stress signal.",
      "Refresh true-color, nightlights, rainfall, and thermal layers each cycle.",
    ],
    marketSignals: indicators.slice(0, 2).map(
      (indicator) =>
        `${indicator.label}: ${formatIndicatorValue(
          indicator.value,
          indicator.unit,
        )} (${formatDelta(indicator.change)}).`,
    ),
    outlook:
      totalFatalities >= 5
        ? "The current picture supports a heightened operating posture with field and market signals reinforcing each other."
        : "The current picture supports a controlled operating posture, with risk concentrated around weather, transport, and visitor-pressure nodes.",
  };
}

import { isDatabaseConfigured, query } from "./db";
import type {
  DatabaseCatalogResponse,
  DatabaseTablePreviewResponse,
  DatabaseTableSummary,
} from "../types/dashboard";

type DatabaseTableDescriptor = Omit<
  DatabaseTableSummary,
  "rowCount" | "latestValue"
> & {
  tableName: string;
  selectList: string[];
  orderBy: string;
  latestExpression: string;
};

interface CountRow {
  count: string | number;
}

interface LatestRow {
  latest_value: string | null;
}

const MAX_PREVIEW_LIMIT = 200;

export const databaseTableCatalog: DatabaseTableDescriptor[] = [
  {
    id: "events",
    label: "Conflict Events",
    description: "Normalized incident rows used by the map, sidebar, and conflict trend views.",
    category: "Operations",
    columns: [
      "external_id",
      "event_date",
      "event_type",
      "sub_event_type",
      "actor1",
      "actor2",
      "location",
      "fatalities",
      "severity_score",
      "longitude",
      "latitude",
      "created_at",
    ],
    tableName: "events",
    selectList: [
      "external_id",
      "event_date",
      "event_type",
      "sub_event_type",
      "actor1",
      "actor2",
      "location",
      "fatalities",
      "severity_score",
      "ROUND(ST_X(geom)::numeric, 4) AS longitude",
      "ROUND(ST_Y(geom)::numeric, 4) AS latitude",
      "created_at",
    ],
    orderBy: "event_date DESC, created_at DESC",
    latestExpression: "MAX(event_date)::text",
  },
  {
    id: "market_data",
    label: "Market Data",
    description: "Reference and ingested market indicators used for radar cards and economic fallback paths.",
    category: "Analytics",
    columns: [
      "category",
      "indicator",
      "value",
      "unit",
      "province",
      "source",
      "ref_date",
      "created_at",
    ],
    tableName: "market_data",
    selectList: [
      "category",
      "indicator",
      "value",
      "unit",
      "province",
      "source",
      "ref_date",
      "created_at",
    ],
    orderBy: "ref_date DESC, created_at DESC",
    latestExpression: "MAX(ref_date)::text",
  },
  {
    id: "fire_events",
    label: "Fire Events",
    description: "NASA FIRMS hotspot observations used for thermal layers and local evidence.",
    category: "Environment",
    columns: [
      "latitude",
      "longitude",
      "brightness",
      "confidence",
      "acq_date",
      "created_at",
    ],
    tableName: "fire_events",
    selectList: [
      "latitude",
      "longitude",
      "brightness",
      "confidence",
      "acq_date",
      "created_at",
    ],
    orderBy: "acq_date DESC, created_at DESC",
    latestExpression: "MAX(acq_date)::text",
  },
  {
    id: "rainfall_data",
    label: "Rainfall Data",
    description: "Stored rainfall anomaly points for Phuket- and Andaman-relevant locations.",
    category: "Environment",
    columns: ["location", "value", "unit", "ref_date", "created_at"],
    tableName: "rainfall_data",
    selectList: ["location", "value", "unit", "ref_date", "created_at"],
    orderBy: "ref_date DESC, created_at DESC",
    latestExpression: "MAX(ref_date)::text",
  },
  {
    id: "population_movements",
    label: "Movement Cache",
    description: "Legacy movement rows currently repurposed as a stand-in cache for visitor-flow overlays.",
    category: "Operations",
    columns: [
      "origin_country",
      "asylum_country",
      "population_type",
      "count",
      "ref_year",
      "created_at",
    ],
    tableName: "population_movements",
    selectList: [
      "origin_country",
      "asylum_country",
      "population_type",
      "count",
      "ref_year",
      "created_at",
    ],
    orderBy: "ref_year DESC, created_at DESC",
    latestExpression: "MAX(ref_year)::text",
  },
  {
    id: "air_quality_snapshots",
    label: "Air Quality Snapshots",
    description: "Stored AQI and PM2.5 station observations for heatmaps and longitudinal air-quality tracking.",
    category: "Environment",
    columns: [
      "location",
      "latitude",
      "longitude",
      "aqi",
      "pm25",
      "category",
      "observed_at",
      "source",
      "created_at",
    ],
    tableName: "air_quality_snapshots",
    selectList: [
      "location",
      "latitude",
      "longitude",
      "aqi",
      "pm25",
      "category",
      "observed_at",
      "source",
      "created_at",
    ],
    orderBy: "observed_at DESC, created_at DESC",
    latestExpression: "MAX(observed_at)::text",
  },
  {
    id: "macro_country_snapshots",
    label: "Macro Country Snapshots",
    description: "ASEAN GDP and GDP-per-capita yearly snapshots used by the market radar.",
    category: "Analytics",
    columns: [
      "country_code",
      "country",
      "gdp_usd",
      "gdp_per_capita_usd",
      "gdp_year",
      "gdp_per_capita_year",
      "source",
      "captured_at",
    ],
    tableName: "macro_country_snapshots",
    selectList: [
      "country_code",
      "country",
      "gdp_usd",
      "gdp_per_capita_usd",
      "gdp_year",
      "gdp_per_capita_year",
      "source",
      "captured_at",
    ],
    orderBy: "GREATEST(gdp_year, gdp_per_capita_year) DESC, captured_at DESC",
    latestExpression: "MAX(captured_at)::text",
  },
  {
    id: "country_economic_indicators",
    label: "Country Economic Indicators",
    description: "Stored ASEAN sidebar profile metrics with one row per country, indicator, and reference year.",
    category: "Analytics",
    columns: [
      "country_code",
      "country",
      "indicator_code",
      "indicator_label",
      "value",
      "unit",
      "ref_year",
      "source",
      "captured_at",
    ],
    tableName: "country_economic_indicators",
    selectList: [
      "country_code",
      "country",
      "indicator_code",
      "indicator_label",
      "value",
      "unit",
      "ref_year",
      "source",
      "captured_at",
    ],
    orderBy: "ref_year DESC, captured_at DESC",
    latestExpression: "MAX(captured_at)::text",
  },
  {
    id: "intelligence_items_cache",
    label: "Intelligence Items",
    description: "Normalized cross-source intelligence items retained for package building and audits.",
    category: "Intelligence",
    columns: [
      "item_id",
      "package_id",
      "source_label",
      "title",
      "published_at",
      "severity",
      "score",
      "kind",
      "tags",
      "updated_at",
    ],
    tableName: "intelligence_items_cache",
    selectList: [
      "item_id",
      "package_id",
      "source_label",
      "title",
      "published_at",
      "severity",
      "score",
      "kind",
      "tags",
      "updated_at",
    ],
    orderBy: "published_at DESC, updated_at DESC",
    latestExpression: "MAX(published_at)::text",
  },
  {
    id: "intelligence_source_health",
    label: "Source Health",
    description: "Latest upstream feed and provider health checks cached for intelligence resilience.",
    category: "System",
    columns: [
      "source_id",
      "source_label",
      "url",
      "status",
      "checked_at",
      "response_time_ms",
      "message",
    ],
    tableName: "intelligence_source_health",
    selectList: [
      "source_id",
      "source_label",
      "url",
      "status",
      "checked_at",
      "response_time_ms",
      "message",
    ],
    orderBy: "checked_at DESC",
    latestExpression: "MAX(checked_at)::text",
  },
  {
    id: "intelligence_package_snapshots",
    label: "Package Snapshots",
    description: "Stored package-level snapshot state for briefings and stale-safe recovery.",
    category: "Intelligence",
    columns: ["package_id", "status", "updated_at"],
    tableName: "intelligence_package_snapshots",
    selectList: ["package_id", "status", "updated_at"],
    orderBy: "updated_at DESC",
    latestExpression: "MAX(updated_at)::text",
  },
];

function getDescriptor(tableId: string) {
  return databaseTableCatalog.find((table) => table.id === tableId) ?? null;
}

function sanitizeLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_PREVIEW_LIMIT);
}

function toSerializableRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }

      return [key, value];
    }),
  );
}

async function buildTableSummary(
  descriptor: DatabaseTableDescriptor,
): Promise<DatabaseTableSummary> {
  if (!isDatabaseConfigured) {
    return {
      id: descriptor.id,
      label: descriptor.label,
      description: descriptor.description,
      category: descriptor.category,
      columns: descriptor.columns,
      rowCount: null,
      latestValue: null,
    };
  }

  try {
    const [countRes, latestRes] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*)::text AS count FROM ${descriptor.tableName}`),
      query<LatestRow>(
        `SELECT ${descriptor.latestExpression} AS latest_value FROM ${descriptor.tableName}`,
      ),
    ]);

    return {
      id: descriptor.id,
      label: descriptor.label,
      description: descriptor.description,
      category: descriptor.category,
      columns: descriptor.columns,
      rowCount: Number(countRes.rows[0]?.count ?? 0),
      latestValue: latestRes.rows[0]?.latest_value ?? null,
    };
  } catch {
    return {
      id: descriptor.id,
      label: descriptor.label,
      description: descriptor.description,
      category: descriptor.category,
      columns: descriptor.columns,
      rowCount: null,
      latestValue: null,
    };
  }
}

export async function buildDatabaseCatalog(): Promise<DatabaseCatalogResponse> {
  const tables = await Promise.all(databaseTableCatalog.map(buildTableSummary));
  const totalRows = tables.reduce(
    (sum, table) => sum + (table.rowCount ?? 0),
    0,
  );

  return {
    databaseConfigured: isDatabaseConfigured,
    generatedAt: new Date().toISOString(),
    totalRows,
    tables,
  };
}

export async function buildDatabaseTablePreview(
  tableId: string,
  limit = 50,
): Promise<DatabaseTablePreviewResponse | null> {
  const descriptor = getDescriptor(tableId);

  if (!descriptor) {
    return null;
  }

  const tableSummary = await buildTableSummary(descriptor);
  const sanitizedLimit = sanitizeLimit(limit);

  if (!isDatabaseConfigured) {
    return {
      databaseConfigured: false,
      generatedAt: new Date().toISOString(),
      table: tableSummary,
      limit: sanitizedLimit,
      rows: [],
    };
  }

  const res = await query<Record<string, unknown>>(
    `
      SELECT ${descriptor.selectList.join(", ")}
      FROM ${descriptor.tableName}
      ORDER BY ${descriptor.orderBy}
      LIMIT $1
    `,
    [sanitizedLimit],
  );

  return {
    databaseConfigured: true,
    generatedAt: new Date().toISOString(),
    table: tableSummary,
    limit: sanitizedLimit,
    rows: res.rows.map(toSerializableRow),
  };
}

export async function exportDatabaseTableRows(tableId: string) {
  const descriptor = getDescriptor(tableId);

  if (!descriptor || !isDatabaseConfigured) {
    return null;
  }

  const res = await query<Record<string, unknown>>(
    `
      SELECT ${descriptor.selectList.join(", ")}
      FROM ${descriptor.tableName}
      ORDER BY ${descriptor.orderBy}
    `,
  );

  return {
    descriptor,
    rows: res.rows.map(toSerializableRow),
  };
}

export function getDatabaseTableDescriptor(tableId: string) {
  return getDescriptor(tableId);
}

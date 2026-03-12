import { isDatabaseConfigured, query } from "./db";
import type {
  IntelligenceItem,
  IntelligencePackage,
  IntelligencePackageResponse,
  SourceHealth,
} from "../types/dashboard";

interface CachedSnapshot {
  payload: IntelligencePackageResponse;
  updatedAt: string;
}

interface PackageRow {
  package_id: string;
  snapshot: IntelligencePackage;
  updated_at: string;
}

interface SourceHealthRow {
  source_id: string;
  source_label: string;
  url: string;
  status: "live" | "stale" | "offline";
  checked_at: string;
  response_time_ms: number | null;
  message: string | null;
}

let memorySnapshot: CachedSnapshot | null = null;

interface CachedPayloadState {
  payload: IntelligencePackageResponse;
  updatedAt: string;
  fresh: boolean;
}

function getLatestTimestamp(packages: IntelligencePackage[]) {
  return packages.reduce((latest, pkg) => {
    if (!latest) {
      return pkg.updatedAt;
    }

    return new Date(pkg.updatedAt) > new Date(latest) ? pkg.updatedAt : latest;
  }, "");
}

function mapSourceHealthRow(row: SourceHealthRow): SourceHealth {
  return {
    id: row.source_id,
    label: row.source_label,
    url: row.url,
    status: row.status,
    checkedAt: row.checked_at,
    responseTimeMs: row.response_time_ms,
    message: row.message,
  };
}

async function loadFromDatabase(): Promise<CachedSnapshot | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const [packagesRes, sourcesRes] = await Promise.all([
      query<PackageRow>(`
        SELECT package_id, snapshot, updated_at
        FROM intelligence_package_snapshots
        ORDER BY package_id ASC
      `),
      query<SourceHealthRow>(`
        SELECT
          source_id,
          source_label,
          url,
          status,
          checked_at,
          response_time_ms,
          message
        FROM intelligence_source_health
        ORDER BY source_label ASC
      `),
    ]);

    if (packagesRes.rows.length === 0) {
      return null;
    }

    const packages = packagesRes.rows.map((row) => row.snapshot);
    const updatedAt =
      getLatestTimestamp(packages) ||
      packagesRes.rows[0]?.updated_at ||
      new Date().toISOString();

    return {
      payload: {
        generatedAt: updatedAt,
        mode: "live",
        packages,
        sources: sourcesRes.rows.map(mapSourceHealthRow),
      },
      updatedAt,
    };
  } catch {
    return null;
  }
}

async function storeInDatabase(payload: IntelligencePackageResponse) {
  if (!isDatabaseConfigured) {
    return;
  }

  try {
    await Promise.all([
      query("DELETE FROM intelligence_package_snapshots"),
      query("DELETE FROM intelligence_items_cache"),
      query("DELETE FROM intelligence_source_health"),
    ]);

    for (const pkg of payload.packages) {
      await query(
        `
          INSERT INTO intelligence_package_snapshots (package_id, snapshot, updated_at, status)
          VALUES ($1, $2::jsonb, $3::timestamptz, $4)
        `,
        [pkg.id, JSON.stringify(pkg), pkg.updatedAt, pkg.status],
      );

      for (const item of pkg.items) {
        await query(
          `
            INSERT INTO intelligence_items_cache (
              item_id,
              package_id,
              source_label,
              source_url,
              title,
              summary,
              url,
              published_at,
              severity,
              score,
              kind,
              tags,
              payload,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12::jsonb, $13::jsonb, $14::timestamptz)
          `,
          [
            item.id,
            item.packageId,
            item.source,
            item.sourceUrl,
            item.title,
            item.summary,
            item.url,
            item.publishedAt,
            item.severity,
            item.score,
            item.kind,
            JSON.stringify(item.tags),
            JSON.stringify(item),
            pkg.updatedAt,
          ],
        );
      }
    }

    for (const source of payload.sources) {
      await query(
        `
          INSERT INTO intelligence_source_health (
            source_id,
            source_label,
            url,
            status,
            checked_at,
            response_time_ms,
            message
          )
          VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
        `,
        [
          source.id,
          source.label,
          source.url,
          source.status,
          source.checkedAt,
          source.responseTimeMs,
          source.message,
        ],
      );
    }
  } catch {
    // Database cache is optional; in-memory fallback is sufficient when unavailable.
  }
}

export async function loadCachedIntelligencePayload(
  maxAgeMs: number,
): Promise<CachedPayloadState | null> {
  const snapshot = (await loadFromDatabase()) ?? memorySnapshot;

  if (!snapshot) {
    return null;
  }

  const ageMs = Date.now() - new Date(snapshot.updatedAt).getTime();

  const payload: IntelligencePackageResponse = {
    ...snapshot.payload,
    mode: ageMs <= maxAgeMs ? "live" : "stale",
    packages: snapshot.payload.packages.map((pkg) => ({
      ...pkg,
      status: ageMs <= maxAgeMs ? pkg.status : "stale",
    })),
    sources: snapshot.payload.sources.map((source) => ({
      ...source,
      status: ageMs <= maxAgeMs ? source.status : "stale",
    })),
  };

  return {
    payload,
    updatedAt: snapshot.updatedAt,
    fresh: ageMs <= maxAgeMs,
  };
}

export async function storeCachedIntelligencePayload(
  payload: IntelligencePackageResponse,
) {
  const updatedAt =
    getLatestTimestamp(payload.packages) ||
    payload.generatedAt ||
    new Date().toISOString();

  const snapshot: CachedSnapshot = {
    payload: {
      ...payload,
      generatedAt: updatedAt,
    },
    updatedAt,
  };

  memorySnapshot = snapshot;
  await storeInDatabase(snapshot.payload);
}

export function synthesizeStalePayload(
  payload: IntelligencePackageResponse,
): IntelligencePackageResponse {
  return {
    ...payload,
    mode: "stale",
    packages: payload.packages.map((pkg) => ({ ...pkg, status: "stale" })),
    sources: payload.sources.map((source) => ({ ...source, status: "stale" })),
  };
}

export function flattenPackageItems(packages: IntelligencePackage[]) {
  return packages.flatMap((pkg): IntelligenceItem[] => pkg.items);
}

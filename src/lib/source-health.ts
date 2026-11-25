export type SourceHealthStatus = "ok" | "degraded" | "unavailable" | "unknown";

export interface SourceHealthRecord {
  key: string;
  last_ok: string | null;
  status: SourceHealthStatus;
}

const KNOWN_SOURCES = [
  "pksb-buses",
  "pksb-routes",
  "operations",
  "airport-arrivals",
  "traffic",
  "weather-ops",
  "marine",
  "maritime",
] as const;

const registry = new Map<string, SourceHealthRecord>(
  KNOWN_SOURCES.map((key) => [
    key,
    {
      key,
      last_ok: null,
      status: "unknown",
    },
  ]),
);

export function recordSourceHealth(
  key: string,
  status: SourceHealthStatus,
  observedAt?: string | null,
): void {
  const previous = registry.get(key);
  const lastOk =
    status === "ok"
      ? observedAt ?? new Date().toISOString()
      : previous?.last_ok ?? null;

  registry.set(key, {
    key,
    last_ok: lastOk,
    status,
  });
}

export function getSourceHealthSnapshot(): SourceHealthRecord[] {
  return Array.from(registry.values());
}

import type { DataFreshness, FallbackTier } from "../types/dashboard";

export const GOVERNOR_MAX_AGE_MINUTES = 24 * 60;

const FALLBACK_ORDER: FallbackTier[] = [
  "live",
  "database",
  "cache",
  "scenario",
  "reference",
  "unavailable",
];

export function toTimestamp(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

export function ageMinutesFromTimestamp(value?: string | null, now = Date.now()) {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.max(0, Math.round((now - timestamp) / 60_000));
}

export function isFreshTimestamp(
  value?: string | null,
  maxAgeMinutes = GOVERNOR_MAX_AGE_MINUTES,
  now = Date.now(),
) {
  const ageMinutes = ageMinutesFromTimestamp(value, now);
  return ageMinutes !== null && ageMinutes <= maxAgeMinutes;
}

export function buildFreshness({
  observedAt,
  checkedAt,
  maxAgeMinutes = GOVERNOR_MAX_AGE_MINUTES,
  fallbackTier,
  sourceIds,
}: {
  observedAt?: string | null;
  checkedAt?: string;
  maxAgeMinutes?: number;
  fallbackTier: FallbackTier;
  sourceIds?: string[];
}): DataFreshness {
  const nextCheckedAt = checkedAt ?? new Date().toISOString();
  const ageMinutes = ageMinutesFromTimestamp(observedAt ?? null, toTimestamp(nextCheckedAt));
  const isFresh =
    fallbackTier !== "unavailable" &&
    ageMinutes !== null &&
    ageMinutes <= maxAgeMinutes;

  return {
    observedAt: observedAt ?? null,
    checkedAt: nextCheckedAt,
    ageMinutes,
    maxAgeMinutes,
    isFresh,
    fallbackTier,
    sourceIds,
  };
}

export function newestObservedAt(values: Array<string | null | undefined>) {
  const newest = values
    .filter((value): value is string => Number.isFinite(toTimestamp(value)))
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0];

  return newest ?? null;
}

export function bestFallbackTier(values: Array<FallbackTier | undefined>) {
  const present = values.filter((value): value is FallbackTier => Boolean(value));
  if (present.length === 0) {
    return "unavailable" as const;
  }

  return present.sort(
    (left, right) => FALLBACK_ORDER.indexOf(left) - FALLBACK_ORDER.indexOf(right),
  )[0];
}

export function summarizeFreshness(
  values: Array<DataFreshness | undefined>,
  checkedAt = new Date().toISOString(),
): DataFreshness {
  const present = values.filter((value): value is DataFreshness => Boolean(value));

  if (present.length === 0) {
    return buildFreshness({
      checkedAt,
      observedAt: null,
      fallbackTier: "unavailable",
    });
  }

  const observedAt = newestObservedAt(present.map((value) => value.observedAt));
  const maxAgeMinutes = Math.min(...present.map((value) => value.maxAgeMinutes));
  const fallbackTier = bestFallbackTier(present.map((value) => value.fallbackTier));
  const isFresh = present.some((value) => value.isFresh);

  return {
    observedAt,
    checkedAt,
    ageMinutes: ageMinutesFromTimestamp(observedAt, toTimestamp(checkedAt)),
    maxAgeMinutes,
    isFresh,
    fallbackTier,
    sourceIds: Array.from(
      new Set(
        present.flatMap((value) => value.sourceIds ?? []),
      ),
    ),
  };
}

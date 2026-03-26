/**
 * Simple in-memory cache for API responses.
 * Prevents re-fetching external APIs on every request.
 * Cache lives as long as the server process (resets on deploy).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Get cached value, or null if expired/missing */
export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Set cached value with TTL in seconds */
export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Get cached value or compute it. Prevents thundering herd with a pending promise. */
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = getCache<T>(key);
  if (hit !== null) return hit;

  // If already computing, wait for that result
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = compute().then((result) => {
    setCache(key, result, ttlSeconds);
    pending.delete(key);
    return result;
  }).catch((err) => {
    pending.delete(key);
    throw err;
  });

  pending.set(key, promise);
  return promise;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export function buildScenarioUrl(path: string, scenarioId?: string | null) {
  const base = path.startsWith("/api/") ? `${API_BASE}${path}` : path;
  return scenarioId
    ? `${base}${base.includes("?") ? "&" : "?"}scenario=${encodeURIComponent(scenarioId)}`
    : base;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const resolved = url.startsWith("/api/") ? `${API_BASE}${url}` : url;
  const response = await fetch(resolved, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchJsonOrNull<T>(
  url: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, options);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return null;
  }
}

export async function fetchJsonOrFallback<T>(
  url: string,
  fallback: T,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await fetchJson<T>(url, options);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return fallback;
  }
}

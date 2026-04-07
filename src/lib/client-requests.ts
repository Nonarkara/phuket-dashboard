export function buildScenarioUrl(path: string, scenarioId?: string | null) {
  return scenarioId
    ? `${path}${path.includes("?") ? "&" : "?"}scenario=${encodeURIComponent(scenarioId)}`
    : path;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, options);
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

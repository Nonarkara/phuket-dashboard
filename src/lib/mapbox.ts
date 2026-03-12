const MAPBOX_PLACEHOLDERS = new Set([
  "",
  "your_mapbox_token_here",
  "your_mapbox_access_token_here",
]);

export function getUsableMapboxToken(token?: string | null) {
  const normalized = token?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  if (MAPBOX_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return "";
  }

  return normalized;
}

export function hasUsableMapboxToken(token?: string | null) {
  return getUsableMapboxToken(token).length > 0;
}

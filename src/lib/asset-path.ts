const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export function assetPath(path: string): string {
  if (!BASE_PATH || !path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

export function apiUrl(path: string): string {
  if (!API_BASE || !path.startsWith("/api/")) return path;
  return `${API_BASE}${path}`;
}

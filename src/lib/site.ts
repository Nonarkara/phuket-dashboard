const DEFAULT_SITE_URL = "https://phuket-dashboard.vercel.app";

export function getSiteUrl() {
  if (process.env.NEXT_OUTPUT === "export") {
    return "https://nonarkara.github.io";
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim();
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return DEFAULT_SITE_URL;
}

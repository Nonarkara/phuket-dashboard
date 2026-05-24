import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/showcase`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}

/**
 * Shared news types.
 *
 * These live in src/types/ and NOT in the API route: scripts/static-export.mjs
 * replaces every route file with a stub before building, so a type imported from a
 * route resolves to nothing and the Pages build fails. That took the site down for
 * days once — see tasks/lessons.md, 2026-05-28.
 */

/** Visitor-origin languages the news watch monitors. */
export const NEWS_LANGS = [
  "th", "en", "zh", "ru", "hi", "ko", "ja", "de", "he", "kk", "fr",
] as const;

export type NewsLang = (typeof NEWS_LANGS)[number];

export type NewsSeverity = "alert" | "watch" | "stable";

export interface NewsTranslation {
  /** Model id that produced the translation, or "source" when none was needed. */
  provider: string;
  from: NewsLang;
  at: string;
}

export interface NewsItem {
  id: string;
  lang: NewsLang;
  /** Headline as published, in its original language. */
  title: string;
  /** English rendering. Null until a translator has actually produced one. */
  titleEn: string | null;
  /** Thai rendering. Only produced for alert/watch items. */
  titleTh: string | null;
  url: string;
  source: string;
  trust: number;
  zone: string;
  severity: NewsSeverity;
  publishedAt: string | null;
  translation: NewsTranslation | null;
}

export interface MultilingualNewsResponse {
  generatedAt: string;
  items: NewsItem[];
  /** Item count per language, for the filter chips. */
  counts: Partial<Record<NewsLang, number>>;
  /** Items still waiting on a translator; they ship in their source language. */
  awaitingTranslation: number;
  failedFeeds: { url: string; lang: string; error: string }[];
  /** Seconds since the ingest worker last published. Null when unknown. */
  ageSeconds: number | null;
  ok: boolean;
}

export const LANG_META: Record<NewsLang, { label: string; flag: string; name: string }> = {
  th: { label: "ไทย", flag: "🇹🇭", name: "Thai" },
  en: { label: "ENG", flag: "🇬🇧", name: "English" },
  zh: { label: "中文", flag: "🇨🇳", name: "Chinese" },
  ru: { label: "РУС", flag: "🇷🇺", name: "Russian" },
  hi: { label: "हिन्दी", flag: "🇮🇳", name: "Hindi" },
  ko: { label: "한국", flag: "🇰🇷", name: "Korean" },
  ja: { label: "日本", flag: "🇯🇵", name: "Japanese" },
  de: { label: "DEU", flag: "🇩🇪", name: "German" },
  he: { label: "עבר", flag: "🇮🇱", name: "Hebrew" },
  kk: { label: "ҚАЗ", flag: "🇰🇿", name: "Kazakh market" },
  fr: { label: "FRA", flag: "🇫🇷", name: "French" },
};

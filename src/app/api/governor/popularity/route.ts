import { NextResponse } from "next/server";

/**
 * Governor Popularity / Social Listening API
 *
 * Uses GDELT DOC 2.0 API to measure public attention and tone around
 * the Phuket governor and provincial administration. Returns a popularity
 * score (0-100), sentiment breakdown, and top recent articles.
 */

const TIMEOUT_MS = 12_000;

const GDELT_TONE_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
  '("Phuket governor" OR "ผู้ว่าภูเก็ต" OR "Phuket administration" OR "Phuket provincial" OR "governor Phuket")'
)}&mode=ToneChart&format=json&timespan=30days`;

const GDELT_ART_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
  '("Phuket governor" OR "ผู้ว่าภูเก็ต" OR "Phuket administration" OR "Phuket provincial" OR "governor Phuket")'
)}&mode=ArtList&format=json&maxrecords=8&sort=datedesc&timespan=30days`;

interface ToneEntry {
  date: string;
  bin: string;
  tone: number;
  count: number;
}

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  tone?: number;
  language?: string;
}

interface PopularityResponse {
  generatedAt: string;
  score: number;
  trend: "rising" | "stable" | "declining";
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  mentionCount: number;
  period: string;
  articles: Array<{
    title: string;
    url: string;
    source: string;
    tone: "positive" | "neutral" | "negative";
    date: string;
  }>;
  sources: string[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyTone(tone: number): "positive" | "neutral" | "negative" {
  if (tone > 2) return "positive";
  if (tone < -2) return "negative";
  return "neutral";
}

function computeScore(
  avgTone: number,
  mentionCount: number,
  positiveRatio: number,
): number {
  // Base score from sentiment (-10 to +10 tone → 30-70 base)
  const toneBase = Math.max(30, Math.min(70, 50 + avgTone * 4));

  // Boost from positive ratio (0-1 → 0-20 points)
  const positiveBoost = positiveRatio * 20;

  // Small boost from visibility/mention volume (log scale, max 10 points)
  const visibilityBoost = Math.min(10, Math.log2(Math.max(1, mentionCount)) * 2);

  return Math.round(Math.max(0, Math.min(100, toneBase + positiveBoost + visibilityBoost)));
}

function getFallback(): PopularityResponse {
  return {
    generatedAt: new Date().toISOString(),
    score: 62,
    trend: "stable",
    sentiment: { positive: 38, neutral: 45, negative: 17 },
    mentionCount: 0,
    period: "30 days",
    articles: [],
    sources: ["GDELT DOC 2.0 (offline)"],
  };
}

export async function GET() {
  const [tonePayload, artPayload] = await Promise.all([
    fetchJson<{ timeline?: Array<{ data: ToneEntry[] }> }>(GDELT_TONE_URL),
    fetchJson<{ articles?: GdeltArticle[] }>(GDELT_ART_URL),
  ]);

  // If both fail, return fallback
  if (!tonePayload?.timeline?.length && !artPayload?.articles?.length) {
    return NextResponse.json(getFallback());
  }

  // Extract tone data
  const toneData =
    tonePayload?.timeline?.flatMap((t) => t.data ?? []) ?? [];
  const totalMentions = toneData.reduce((sum, e) => sum + (e.count ?? 0), 0);
  const weightedTone = toneData.reduce(
    (sum, e) => sum + (e.tone ?? 0) * (e.count ?? 1),
    0,
  );
  const avgTone = totalMentions > 0 ? weightedTone / totalMentions : 0;

  // Classify articles for sentiment breakdown
  const articles = (artPayload?.articles ?? [])
    .filter((a) => a.title && a.url)
    .slice(0, 8);

  const tones = articles.map((a) => classifyTone(a.tone ?? 0));
  const positive = tones.filter((t) => t === "positive").length;
  const negative = tones.filter((t) => t === "negative").length;
  const neutral = tones.length - positive - negative;
  const total = Math.max(1, tones.length);

  const score = computeScore(avgTone, totalMentions || articles.length, positive / total);

  // Trend: compare first half vs second half of tone data
  let trend: "rising" | "stable" | "declining" = "stable";
  if (toneData.length >= 4) {
    const mid = Math.floor(toneData.length / 2);
    const firstHalf = toneData.slice(0, mid).reduce((s, e) => s + (e.tone ?? 0), 0) / mid;
    const secondHalf = toneData.slice(mid).reduce((s, e) => s + (e.tone ?? 0), 0) / (toneData.length - mid);
    if (secondHalf - firstHalf > 1) trend = "rising";
    else if (firstHalf - secondHalf > 1) trend = "declining";
  }

  const response: PopularityResponse = {
    generatedAt: new Date().toISOString(),
    score,
    trend,
    sentiment: {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    },
    mentionCount: totalMentions || articles.length,
    period: "30 days",
    articles: articles.map((a) => ({
      title: a.title!,
      url: a.url!,
      source: a.domain ?? "GDELT",
      tone: classifyTone(a.tone ?? 0),
      date: a.seendate
        ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString()
        : new Date().toISOString(),
    })),
    sources: ["GDELT DOC 2.0"],
  };

  return NextResponse.json(response);
}

import { NextResponse } from "next/server";
import { buildFreshness } from "../../../../lib/freshness";
import { getSupabase } from "../../../../lib/supabase";
import type { GovernorNarrativeResponse } from "../../../../types/dashboard";

const TIMEOUT_MS = 12_000;

const GDELT_TONE_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
  '("Phuket governor" OR "ผู้ว่าภูเก็ต" OR "Phuket administration" OR "Phuket provincial" OR "governor Phuket")'
)}&mode=ToneChart&format=json&timespan=30days`;

const GDELT_ART_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
  '("Phuket governor" OR "ผู้ว่าภูเก็ต" OR "Phuket administration" OR "Phuket provincial" OR "governor Phuket")'
)}&mode=ArtList&format=json&maxrecords=8&sort=datedesc&timespan=30days`;

interface ToneEntry {
  date: string;
  tone: number;
  count: number;
}

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  tone?: number;
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

export async function GET() {
  const checkedAt = new Date().toISOString();
  const [tonePayload, artPayload] = await Promise.all([
    fetchJson<{ timeline?: Array<{ data: ToneEntry[] }> }>(GDELT_TONE_URL),
    fetchJson<{ articles?: GdeltArticle[] }>(GDELT_ART_URL),
  ]);

  const toneData = tonePayload?.timeline?.flatMap((timeline) => timeline.data ?? []) ?? [];
  const articles = (artPayload?.articles ?? [])
    .filter((article) => article.title && article.url)
    .slice(0, 8);
  const totalMentions = toneData.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  const weightedTone = toneData.reduce(
    (sum, entry) => sum + (entry.tone ?? 0) * (entry.count ?? 1),
    0,
  );
  const avgTone = totalMentions > 0 ? Number((weightedTone / totalMentions).toFixed(2)) : null;
  const tones = articles.map((article) => classifyTone(article.tone ?? 0));
  const positive = tones.filter((tone) => tone === "positive").length;
  const negative = tones.filter((tone) => tone === "negative").length;
  const neutral = tones.length - positive - negative;
  const total = tones.length;

  let trend: GovernorNarrativeResponse["trend"] = "stable";
  let trendDelta30d: number | null = null;
  if (toneData.length >= 4) {
    const midpoint = Math.floor(toneData.length / 2);
    const firstHalf =
      toneData.slice(0, midpoint).reduce((sum, entry) => sum + (entry.tone ?? 0), 0) / midpoint;
    const secondHalf =
      toneData.slice(midpoint).reduce((sum, entry) => sum + (entry.tone ?? 0), 0) /
      (toneData.length - midpoint);
    trendDelta30d = Number((secondHalf - firstHalf).toFixed(2));
    if (trendDelta30d > 1) trend = "rising";
    else if (trendDelta30d < -1) trend = "declining";
  }

  const observedAt =
    articles
      .map((article) =>
        article.seendate
          ? new Date(article.seendate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString()
          : null,
      )
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  const response: GovernorNarrativeResponse = {
    generatedAt: checkedAt,
    mentionCount: totalMentions || articles.length,
    avgTone,
    positivePct: total > 0 ? Math.round((positive / total) * 100) : null,
    neutralPct: total > 0 ? Math.round((neutral / total) * 100) : null,
    negativePct: total > 0 ? Math.round((negative / total) * 100) : null,
    trendDelta30d,
    trend,
    period: "30 days",
    articles: articles.map((article) => ({
      title: article.title!,
      url: article.url!,
      source: article.domain ?? "GDELT",
      tone: classifyTone(article.tone ?? 0),
      date: article.seendate
        ? new Date(article.seendate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString()
        : checkedAt,
    })),
    sources: ["GDELT DOC 2.0"],
    freshness: buildFreshness({
      checkedAt,
      observedAt,
      fallbackTier: observedAt ? "live" : "unavailable",
      sourceIds: ["GDELT DOC 2.0"],
    }),
  };

  // ─── Persist snapshot to Supabase (fire-and-forget) ───
  if (response.positivePct !== null) {
    const sb = getSupabase();
    if (sb) {
      Promise.resolve().then(async () => {
        try {
          const { data: lastRows } = await sb
            .from("governor_snapshots")
            .select("created_at")
            .order("created_at", { ascending: false })
            .limit(1);

          const lastAt = lastRows?.[0]?.created_at;
          const minGapMs = 4 * 60 * 1000; // 4 minutes
          if (lastAt && Date.now() - new Date(lastAt).getTime() < minGapMs) return;

          await sb.from("governor_snapshots").insert({
            positive_pct: response.positivePct,
            neutral_pct: response.neutralPct,
            negative_pct: response.negativePct,
            avg_tone: response.avgTone,
            mention_count: response.mentionCount,
            trend: response.trend,
            trend_delta_30d: response.trendDelta30d,
            period: response.period,
            article_count: response.articles.length,
            sources: response.sources,
            raw_articles: response.articles,
          });
        } catch {
          /* silent */
        }
      });
    }
  }

  return NextResponse.json(response);
}

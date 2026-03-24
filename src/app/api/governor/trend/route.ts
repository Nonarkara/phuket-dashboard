import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

interface TrendDataPoint {
  date: string;
  positivePct: number;
  mentionCount: number;
  avgTone: number;
}

interface GovernorTrendResponse {
  range: string;
  dataPoints: TrendDataPoint[];
  currentPct: number | null;
  changeFromStart: number | null;
  trend: "rising" | "stable" | "declining";
  source: "database" | "mock";
}

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: 3650,
};

function generateMockData(days: number): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  const now = new Date();
  let pct = 55 + Math.random() * 15; // start 55-70%

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // random walk with slight upward bias
    pct += (Math.random() - 0.47) * 4;
    pct = Math.max(20, Math.min(85, pct));
    points.push({
      date: d.toISOString().slice(0, 10),
      positivePct: Math.round(pct),
      mentionCount: Math.floor(3 + Math.random() * 15),
      avgTone: Number(((pct - 50) / 10).toFixed(2)),
    });
  }
  return points;
}

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const days = RANGE_DAYS[range] ?? 30;

  const sb = getSupabase();

  if (sb) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: rows, error } = await sb
        .from("governor_snapshots")
        .select("created_at, positive_pct, mention_count, avg_tone")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (!error && rows && rows.length > 0) {
        // Aggregate by day
        const byDay = new Map<string, { pcts: number[]; mentions: number[]; tones: number[] }>();
        for (const row of rows) {
          const day = new Date(row.created_at).toISOString().slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, { pcts: [], mentions: [], tones: [] });
          const bucket = byDay.get(day)!;
          if (row.positive_pct != null) bucket.pcts.push(row.positive_pct);
          if (row.mention_count != null) bucket.mentions.push(row.mention_count);
          if (row.avg_tone != null) bucket.tones.push(row.avg_tone);
        }

        const dataPoints: TrendDataPoint[] = [];
        for (const [date, bucket] of byDay) {
          const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
          dataPoints.push({
            date,
            positivePct: Math.round(avg(bucket.pcts)),
            mentionCount: Math.round(avg(bucket.mentions)),
            avgTone: Number(avg(bucket.tones).toFixed(2)),
          });
        }

        const currentPct = dataPoints[dataPoints.length - 1]?.positivePct ?? null;
        const startPct = dataPoints[0]?.positivePct ?? null;
        const changeFromStart = currentPct !== null && startPct !== null ? currentPct - startPct : null;
        let trend: "rising" | "stable" | "declining" = "stable";
        if (changeFromStart !== null) {
          if (changeFromStart > 3) trend = "rising";
          else if (changeFromStart < -3) trend = "declining";
        }

        const response: GovernorTrendResponse = {
          range,
          dataPoints,
          currentPct,
          changeFromStart,
          trend,
          source: "database",
        };
        return NextResponse.json(response);
      }
    } catch {
      // Fall through to mock
    }
  }

  // Mock data when Supabase is not configured
  const dataPoints = generateMockData(Math.min(days, 90));
  const currentPct = dataPoints[dataPoints.length - 1]?.positivePct ?? null;
  const startPct = dataPoints[0]?.positivePct ?? null;
  const changeFromStart = currentPct !== null && startPct !== null ? currentPct - startPct : null;
  let trend: "rising" | "stable" | "declining" = "stable";
  if (changeFromStart !== null) {
    if (changeFromStart > 3) trend = "rising";
    else if (changeFromStart < -3) trend = "declining";
  }

  return NextResponse.json({
    range,
    dataPoints,
    currentPct,
    changeFromStart,
    trend,
    source: "mock",
  } satisfies GovernorTrendResponse);
}

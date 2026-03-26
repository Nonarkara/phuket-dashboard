"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Database, Layers, Network, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  ExecutiveStatus,
  GovernorBrief,
  GovernorNarrativeResponse,
  PhuketVisitorOriginsResponse,
} from "../../types/dashboard";

interface TopBarProps {
  brief: GovernorBrief | null;
  visitorOrigins: PhuketVisitorOriginsResponse | null;
  onOpenManual: () => void;
  onOpenArchitecture: () => void;
  onOpenDataExplorer: () => void;
  onOpenModuleSelector?: () => void;
}

function formatMainClock() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function statusClasses(status: ExecutiveStatus) {
  if (status === "intervene") {
    return "border-[#ef4444] bg-[rgba(239,68,68,0.08)] text-[#ef4444]";
  }

  if (status === "watch") {
    return "border-[#f59e0b] bg-[rgba(245,158,11,0.08)] text-[#f59e0b]";
  }

  return "border-[var(--line)] bg-[rgba(15,111,136,0.05)] text-[var(--cool)]";
}

export default function TopBar({
  brief,
  visitorOrigins,
  onOpenManual,
  onOpenArchitecture,
  onOpenDataExplorer,
  onOpenModuleSelector,
}: TopBarProps) {
  const [time, setTime] = useState("");
  const [narrative, setNarrative] = useState<GovernorNarrativeResponse | null>(null);
  const [showNarrativeDetail, setShowNarrativeDetail] = useState(false);
  const [trendRange, setTrendRange] = useState<string>("30d");
  const [trendData, setTrendData] = useState<{
    dataPoints: { date: string; positivePct: number }[];
    changeFromStart: number | null;
    trend: string;
    source: string;
  } | null>(null);

  const [newsHeadlines, setNewsHeadlines] = useState<{ title: string; url: string; source: string; severity: string }[]>([]);

  // Fetch news headlines for ticker
  useEffect(() => {
    const loadNews = async () => {
      try {
        const res = await fetch(`/api/news/multilingual?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const all = [...(data.en ?? []), ...(data.th ?? [])];
          setNewsHeadlines(
            all.sort((a: { publishedAt: string }, b: { publishedAt: string }) =>
              new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            ).slice(0, 10).map((item: { title: string; url?: string; source: string; severity: string }) => ({
              title: item.title?.substring(0, 80) ?? "",
              url: item.url ?? "#",
              source: item.source ?? "",
              severity: item.severity ?? "stable",
            }))
          );
        }
      } catch { /* silent */ }
    };
    void loadNews();
    const interval = setInterval(() => void loadNews(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadTrend = async (range: string) => {
    try {
      const res = await fetch(`/api/governor/trend?range=${range}`);
      if (res.ok) setTrendData(await res.json());
    } catch { /* silent */ }
  };

  useEffect(() => {
    const tick = () => {
      setTime(formatMainClock());
    };

    tick();
    const clockInterval = setInterval(tick, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    const loadNarrative = async () => {
      try {
        const res = await fetch("/api/governor/popularity");
        if (res.ok) {
          const data = (await res.json()) as GovernorNarrativeResponse;
          if (data && typeof data.mentionCount === "number") {
            setNarrative(data);
          }
        }
      } catch { /* silent */ }
    };
    void loadNarrative();
    const interval = setInterval(() => {
      void loadNarrative();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const topConcerns = brief?.topConcerns ?? [];
  const feederOrigins = visitorOrigins?.origins ?? [];
  const visitorOriginSourceLabel =
    visitorOrigins?.sources.join(" / ") ?? "Curated Phuket feeder ranking";

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-4 py-1 min-[3000px]:py-2 backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title + posture */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Logos */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <Image
              src="/logos/slic.jpg"
              alt="SLIC"
              width={50}
              height={24}
              className="h-6 min-[3000px]:h-10 w-auto rounded-sm"
            />
            <Image
              src="/logos/depa.jpg"
              alt="depa"
              width={50}
              height={24}
              className="h-6 min-[3000px]:h-10 w-auto rounded-sm"
            />
            <Image
              src="/logos/smart-city-thailand.jpg"
              alt="Smart City Thailand"
              width={70}
              height={24}
              className="h-6 min-[3000px]:h-10 w-auto rounded-sm"
            />
          </div>
          <div className="hidden h-8 w-[1px] bg-[var(--line)] sm:block" />
          <div className="min-w-0 shrink-0">
            <div className="text-[8px] min-[3000px]:text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">Phuket Dashboard v7.0</div>
            <div className="text-[13px] min-[3000px]:text-[22px] font-bold tracking-tight text-[var(--ink)] whitespace-nowrap">
              Governor War Room
            </div>
          </div>
          <div className="hidden h-8 w-[1px] bg-[var(--line)] sm:block" />
          <div className="hidden items-center gap-1.5 border border-[var(--line)] px-2 py-1 lg:flex">
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Posture</span>
            <span
              className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em] ${statusClasses(
                brief?.posture.level ?? "watch",
              )}`}
            >
              {brief?.posture.label ?? "Loading"}
            </span>
          </div>
          {/* Governor approval bar */}
          {narrative && (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setShowNarrativeDetail(!showNarrativeDetail);
                  if (!showNarrativeDetail && !trendData) loadTrend(trendRange);
                }}
                className={`flex items-center gap-2 border px-2.5 py-1 transition-colors ${
                  narrative.freshness.isFresh
                    ? "border-[var(--line)] hover:border-[var(--line-bright)]"
                    : "border-[#f59e0b] bg-[rgba(245,158,11,0.06)]"
                }`}
                title="Governor approval rating (GDELT sentiment analysis)"
              >
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Approval</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-mono font-bold ${
                    (narrative.positivePct ?? 0) >= 50 ? "text-[#22c55e]" : "text-[#ef4444]"
                  }`}>
                    {narrative.freshness.isFresh ? `${narrative.positivePct ?? "--"}%` : "n/a"}
                  </span>
                  {narrative.trend === "rising" ? (
                    <TrendingUp size={10} className="text-[#22c55e]" />
                  ) : narrative.trend === "declining" ? (
                    <TrendingDown size={10} className="text-[#ef4444]" />
                  ) : (
                    <Minus size={10} className="text-[var(--dim)]" />
                  )}
                </div>
              </button>

              {/* Dropdown: approval trend chart + articles */}
              {showNarrativeDetail && (
                <div className="absolute left-0 top-full z-50 mt-1 w-80 border border-[var(--line)] bg-[var(--bg-raised)] shadow-lg">
                  {/* Approval header */}
                  <div className="px-3 py-2 border-b border-[var(--line)]">
                    <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                      Governor approval rating
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className={`text-[28px] font-mono font-bold ${
                        (narrative.positivePct ?? 0) >= 50 ? "text-[#22c55e]" : "text-[#ef4444]"
                      }`}>
                        {narrative.positivePct ?? "--"}%
                      </span>
                      {trendData?.changeFromStart != null && (
                        <span className={`text-[11px] font-mono font-bold ${
                          trendData.changeFromStart > 0 ? "text-[#22c55e]" : trendData.changeFromStart < 0 ? "text-[#ef4444]" : "text-[var(--dim)]"
                        }`}>
                          {trendData.changeFromStart > 0 ? "+" : ""}{trendData.changeFromStart}%
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] text-[var(--dim)]">
                      Based on {narrative.mentionCount} media mentions (GDELT sentiment)
                    </div>
                    <div className="mt-1.5 flex gap-2 text-[8px] font-bold uppercase tracking-wider">
                      <span className="text-[#22c55e]">{narrative.positivePct ?? "--"}% pos</span>
                      <span className="text-[var(--dim)]">{narrative.neutralPct ?? "--"}% neutral</span>
                      <span className="text-[#ef4444]">{narrative.negativePct ?? "--"}% neg</span>
                    </div>
                  </div>

                  {/* Sparkline chart */}
                  <div className="px-3 py-2 border-b border-[var(--line)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                        Trend {trendData?.source === "mock" ? "(simulated)" : ""}
                      </span>
                      <div className="flex gap-1">
                        {(["7d", "30d", "90d"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setTrendRange(r); loadTrend(r); }}
                            className={`px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider border transition-colors ${
                              trendRange === r
                                ? "border-[var(--ink)] text-[var(--ink)]"
                                : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {trendData && trendData.dataPoints.length > 1 ? (
                      <ApprovalSparkline data={trendData.dataPoints} />
                    ) : (
                      <div className="h-[60px] flex items-center justify-center text-[9px] text-[var(--dim)]">
                        Loading trend data...
                      </div>
                    )}
                  </div>

                  {/* Articles */}
                  {narrative.articles.length > 0 && (
                    <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5">
                      {narrative.articles.slice(0, 5).map((art, idx) => (
                        <a
                          key={idx}
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border-l-2 pl-2 py-0.5 hover:bg-[rgba(15,111,136,0.04)] transition-colors"
                          style={{
                            borderColor: art.tone === "positive" ? "#22c55e" : art.tone === "negative" ? "#ef4444" : "var(--line)",
                          }}
                        >
                          <div className="text-[9px] font-semibold text-[var(--ink)] leading-4 line-clamp-2">{art.title}</div>
                          <div className="text-[7px] text-[var(--dim)] uppercase tracking-wider mt-0.5">{art.source}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Key metrics strip */}
        <div className="hidden items-center gap-3 lg:flex">
          {topConcerns.slice(0, 6).map((concern) => (
            <div key={concern.id} className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[var(--ink)]">{concern.metricValue}</span>
              <span className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">{concern.label}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  concern.status === "intervene"
                    ? "bg-[#ef4444]"
                    : concern.status === "watch"
                      ? "bg-[#f59e0b]"
                      : "bg-[var(--cool)]"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Right: Clock + utils */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[18px] min-[3000px]:text-[36px] font-bold tracking-tighter text-[var(--ink)]">
              {time || "--:--:--"}
            </span>
            <span className="text-[8px] min-[3000px]:text-[12px] font-mono text-[var(--dim)] uppercase tracking-wider">
              HKT
            </span>
          </div>
          <div className="hidden h-6 w-[1px] bg-[var(--line)] sm:block" />
          <div className="flex items-center gap-1">
            {onOpenModuleSelector && (
              <button
                type="button"
                onClick={onOpenModuleSelector}
                className="p-1 text-[var(--cool)] hover:text-[var(--ink)] transition-colors"
                title="Global Satellite Toolkit"
              >
                <Layers size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenArchitecture}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="APIs / Architecture"
            >
              <Network size={14} />
            </button>
            <button
              type="button"
              onClick={onOpenDataExplorer}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Data / Export"
            >
              <Database size={14} />
            </button>
            <button
              type="button"
              onClick={onOpenManual}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Help / Manual"
            >
              <BookOpen size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Feeder markets + scrolling news ticker */}
      <div className="mt-1 hidden min-w-0 items-center gap-2 overflow-x-auto border-t border-[var(--line)] pt-1 lg:flex">
        <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
          Feeder markets
        </span>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar">
          {feederOrigins.length > 0 ? (
            feederOrigins.map((origin) => (
              <div
                key={origin.countryCode}
                className="flex shrink-0 items-center gap-1.5 border border-[var(--line)] px-1.5 py-0.5"
              >
                <Image
                  src={origin.logo}
                  alt={origin.country}
                  width={12}
                  height={12}
                  className="h-3 w-3"
                />
                <div className="leading-tight">
                  <div className="text-[8px] font-semibold text-[var(--ink)]">
                    {origin.rank}. {origin.country}
                  </div>
                  <div className="text-[7px] font-mono text-[var(--dim)]">
                    ${origin.gdpPerCapitaUsd ? Math.round(origin.gdpPerCapitaUsd / 1000) + "k" : "--"}
                    {origin.year ? ` • ${origin.year}` : ""}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-[var(--line)] px-2 py-0.5 text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
              Loading
            </div>
          )}
        </div>
        <div className="h-3 w-[1px] bg-[var(--line)] shrink-0" />

        {/* Scrolling news headline ticker */}
        <div className="min-w-0 flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-6">
            {newsHeadlines.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[8px] hover:text-[var(--cool)] transition-colors shrink-0">
                <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                  h.severity === "alert" ? "bg-[#ef4444]" : h.severity === "watch" ? "bg-[#f59e0b]" : "bg-[var(--cool)]"
                }`} />
                <span className="font-semibold text-[var(--ink)]">{h.title}</span>
                <span className="text-[var(--dim)]">({h.source})</span>
              </a>
            ))}
          </div>
        </div>
        <span className="shrink-0 text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
          {visitorOriginSourceLabel}
        </span>
      </div>
    </header>
  );
}

/** SVG sparkline for approval trend */
function ApprovalSparkline({ data }: { data: { date: string; positivePct: number }[] }) {
  const W = 260;
  const H = 60;
  const PAD = 4;

  const pcts = data.map((d) => d.positivePct);
  const minVal = Math.min(...pcts) - 3;
  const maxVal = Math.max(...pcts) + 3;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((d.positivePct - minVal) / range) * (H - 2 * PAD);
    return `${x},${y}`;
  });

  const last = data[data.length - 1];
  const lastX = W - PAD;
  const lastY = H - PAD - ((last.positivePct - minVal) / range) * (H - 2 * PAD);
  const isPositive = last.positivePct >= 50;

  // Area fill
  const areaPoints = `${PAD},${H - PAD} ${points.join(" ")} ${lastX},${H - PAD}`;

  return (
    <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
      {/* 50% reference line */}
      <line
        x1={PAD} y1={H - PAD - ((50 - minVal) / range) * (H - 2 * PAD)}
        x2={W - PAD} y2={H - PAD - ((50 - minVal) / range) * (H - 2 * PAD)}
        stroke="var(--line)" strokeDasharray="2,2"
      />
      <text
        x={W - PAD - 1} y={H - PAD - ((50 - minVal) / range) * (H - 2 * PAD) - 2}
        textAnchor="end" className="fill-[var(--dim)]" fontSize={7}
      >
        50%
      </text>
      {/* Area */}
      <polygon points={areaPoints} fill={isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"} />
      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={isPositive ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5}
      />
      {/* Current dot */}
      <circle cx={lastX} cy={lastY} r={3} fill={isPositive ? "#22c55e" : "#ef4444"} />
      <text
        x={lastX - 4} y={lastY - 5}
        textAnchor="end" fontSize={8} fontWeight="bold"
        className={isPositive ? "fill-[#22c55e]" : "fill-[#ef4444]"}
      >
        {last.positivePct}%
      </text>
    </svg>
  );
}

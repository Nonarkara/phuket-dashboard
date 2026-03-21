"use client";

import { useEffect, useState } from "react";
import { BookOpen, Database, Network, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  ExecutiveStatus,
  GovernorBrief,
} from "../../types/dashboard";

interface PopularityData {
  score: number;
  trend: "rising" | "stable" | "declining";
  sentiment: { positive: number; neutral: number; negative: number };
  mentionCount: number;
  articles: Array<{ title: string; url: string; source: string; tone: string; date: string }>;
}

interface TopBarProps {
  brief: GovernorBrief | null;
  onOpenManual: () => void;
  onOpenArchitecture: () => void;
  onOpenDataExplorer: () => void;
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
  onOpenManual,
  onOpenArchitecture,
  onOpenDataExplorer,
}: TopBarProps) {
  const [time, setTime] = useState("");
  const [popularity, setPopularity] = useState<PopularityData | null>(null);
  const [showPopDetail, setShowPopDetail] = useState(false);

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
    const loadPopularity = async () => {
      try {
        const res = await fetch("/api/governor/popularity");
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.score === "number") {
            setPopularity(data);
          }
        }
      } catch { /* silent */ }
    };
    loadPopularity();
    const interval = setInterval(loadPopularity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const topConcerns = brief?.topConcerns ?? [];

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-4 py-1 backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title + posture */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Logos */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <img src="/logos/slic.jpg" alt="SLIC" className="h-6 w-auto rounded-sm" />
            <img src="/logos/depa.jpg" alt="depa" className="h-6 w-auto rounded-sm" />
            <img src="/logos/smart-city-thailand.jpg" alt="Smart City Thailand" className="h-6 w-auto rounded-sm" />
          </div>
          <div className="hidden h-8 w-[1px] bg-[var(--line)] sm:block" />
          <div className="min-w-0 shrink-0">
            <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">Phuket Dashboard v6.0</div>
            <div className="text-[13px] font-bold tracking-tight text-[var(--ink)] whitespace-nowrap">
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
          {/* Governor Popularity Bar */}
          {popularity && (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setShowPopDetail(!showPopDetail)}
                className="flex items-center gap-2 border border-[var(--line)] px-2.5 py-1 hover:border-[var(--line-bright)] transition-colors"
                title="Governor public sentiment (social listening)"
              >
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Approval</span>
                <div className="flex items-center gap-1.5">
                  <div className="relative h-2 w-16 overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all"
                      style={{
                        width: `${popularity.score}%`,
                        backgroundColor:
                          popularity.score >= 60 ? "#22c55e" : popularity.score >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[var(--ink)]">
                    {popularity.score}%
                  </span>
                  {popularity.trend === "rising" ? (
                    <TrendingUp size={10} className="text-[#22c55e]" />
                  ) : popularity.trend === "declining" ? (
                    <TrendingDown size={10} className="text-[#ef4444]" />
                  ) : (
                    <Minus size={10} className="text-[var(--dim)]" />
                  )}
                </div>
              </button>

              {/* Dropdown detail */}
              {showPopDetail && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 border border-[var(--line)] bg-[var(--bg-raised)] shadow-lg">
                  <div className="px-3 py-2 border-b border-[var(--line)]">
                    <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                      Governor Social Listening
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[20px] font-mono font-bold text-[var(--ink)]">{popularity.score}%</span>
                      <span className="text-[9px] text-[var(--dim)]">approval (30-day GDELT analysis)</span>
                    </div>
                    <div className="mt-2 flex gap-2 text-[8px] font-bold uppercase tracking-wider">
                      <span className="text-[#22c55e]">{popularity.sentiment.positive}% pos</span>
                      <span className="text-[var(--dim)]">{popularity.sentiment.neutral}% neutral</span>
                      <span className="text-[#ef4444]">{popularity.sentiment.negative}% neg</span>
                    </div>
                    <div className="mt-1 text-[8px] text-[var(--dim)]">
                      {popularity.mentionCount} mentions in media
                    </div>
                  </div>
                  {popularity.articles.length > 0 && (
                    <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-1.5">
                      {popularity.articles.slice(0, 5).map((art, idx) => (
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
            <span className="font-mono text-[18px] font-bold tracking-tighter text-[var(--ink)]">
              {time || "--:--:--"}
            </span>
            <span className="text-[8px] font-mono text-[var(--dim)] uppercase tracking-wider">
              HKT
            </span>
          </div>
          <div className="hidden h-6 w-[1px] bg-[var(--line)] sm:block" />
          <div className="flex items-center gap-1">
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
    </header>
  );
}

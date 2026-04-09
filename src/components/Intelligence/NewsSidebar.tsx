"use client";
import { apiUrl } from "../../lib/asset-path";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Globe, Newspaper } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";

interface NewsItem {
  id: string;
  lang: "th" | "en" | "zh";
  title: string;
  titleTh?: string;
  summary: string;
  source: string;
  zone: string;
  severity: "alert" | "watch" | "stable";
  publishedAt: string;
  url?: string;
}

interface MultilingualNewsResponse {
  generatedAt: string;
  th: NewsItem[];
  en: NewsItem[];
  zh: NewsItem[];
  sources: string[];
}

type LangFilter = "all" | "th" | "en" | "zh";

const LANG_FLAGS: Record<string, { label: string; flag: string }> = {
  th: { label: "ไทย", flag: "🇹🇭" },
  en: { label: "ENG", flag: "🇬🇧" },
  zh: { label: "中文", flag: "🇨🇳" },
};

function severityDot(sev: "alert" | "watch" | "stable") {
  if (sev === "alert") return "bg-[#ef4444]";
  if (sev === "watch") return "bg-[#f59e0b]";
  return "bg-[var(--cool)]";
}

function severityBorder(sev: "alert" | "watch" | "stable") {
  if (sev === "alert") return "border-l-[#ef4444]";
  if (sev === "watch") return "border-l-[#f59e0b]";
  return "border-l-[var(--line)]";
}

function categorize(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (/accident|crash|kill|dead|death|injur|อุบัติเหตุ|เสียชีวิต/.test(t))
    return { label: "ACCIDENT", color: "#ef4444" };
  if (/arrest|drug|crime|police|bust|raid|fraud|scam|จับกุม|ตำรวจ|ยาเสพติด/.test(t))
    return { label: "CRIME", color: "#f97316" };
  if (/storm|flood|earthquake|tsunami|warning|fire|เตือน|พายุ|น้ำท่วม|ไฟไหม้/.test(t))
    return { label: "DISASTER", color: "#ef4444" };
  if (/airport|flight|airline|สนามบิน|เที่ยวบิน/.test(t))
    return { label: "AIRPORT", color: "#6366f1" };
  if (/tourism|tourist|visitor|hotel|resort|ท่องเที่ยว|โรงแรม/.test(t))
    return { label: "TOURISM", color: "#0ea5e9" };
  if (/governor|government|admin|budget|ผู้ว่า|รัฐบาล|งบประมาณ/.test(t))
    return { label: "GOV", color: "#22c55e" };
  if (/traffic|road|transport|tuk.?tuk|จราจร|คมนาคม/.test(t))
    return { label: "TRAFFIC", color: "#f59e0b" };
  if (/weather|rain|monsoon|อากาศ|ฝน/.test(t))
    return { label: "WEATHER", color: "#6366f1" };
  if (/property|real.?estate|อสังหา/.test(t))
    return { label: "PROPERTY", color: "#8b5cf6" };
  return { label: "NEWS", color: "var(--dim)" };
}

function formatNewsTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return ""; }
}

function NewsItemCard({ item, is4K, rank }: { item: NewsItem; is4K: boolean; rank?: number }) {
  const cat = categorize(item.title);
  // Recency gradient: newer articles (rank 0-2) get a warm tint, fading to neutral
  const recencyBg = (() => {
    if (item.severity === "alert") return "rgba(239,68,68,0.06)";
    if (rank === undefined || rank > 8) return "transparent";
    if (rank <= 1) return "rgba(15,111,136,0.06)"; // freshest: cool tint
    if (rank <= 3) return "rgba(15,111,136,0.03)";
    if (rank <= 5) return "rgba(15,111,136,0.015)";
    return "transparent";
  })();
  return (
    <article
      className={`border-l-2 ${severityBorder(item.severity)} px-3 py-2 transition-colors hover:bg-[rgba(15,111,136,0.05)]`}
      style={{ background: recencyBg }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`shrink-0 ${is4K ? "text-[13px]" : "text-[10px]"}`}>
              {LANG_FLAGS[item.lang]?.flag}
            </span>
            <span className={`shrink-0 rounded-full ${severityDot(item.severity)} ${is4K ? "h-2.5 w-2.5" : "h-1.5 w-1.5"}`} />
            <span
              className={`${is4K ? "text-[9px] px-1.5 py-0.5" : "text-[7px] px-1 py-px"} font-bold uppercase tracking-[0.1em] border`}
              style={{ color: cat.color, borderColor: cat.color, opacity: 0.85 }}
            >
              {cat.label}
            </span>
            <span className={`${is4K ? "text-[11px]" : "text-[8px]"} font-bold uppercase tracking-[0.14em] text-[var(--dim)]`}>
              {item.zone}
            </span>
          </div>
          <div className="mt-1">
            {item.titleTh && item.lang !== "th" && (
              <div className={`${is4K ? "text-[14px]" : "text-[10px]"} font-semibold leading-4 text-[var(--ink)]`}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--cool)] hover:underline underline-offset-2">
                    {item.titleTh}
                  </a>
                ) : item.titleTh}
              </div>
            )}
            <div className={`${is4K ? "text-[13px] leading-5" : "text-[10px] leading-4"} ${item.titleTh && item.lang !== "th" ? "text-[var(--muted)]" : "font-semibold text-[var(--ink)]"}`}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--cool)] hover:underline underline-offset-2">
                  {item.title}
                </a>
              ) : item.title}
            </div>
          </div>
          <p className={`mt-0.5 ${is4K ? "text-[12px] leading-4" : "text-[9px] leading-[14px]"} text-[var(--muted)]`}>
            {item.summary}
          </p>
          <div className={`mt-1 flex items-center gap-2 ${is4K ? "text-[10px]" : "text-[7px]"} uppercase tracking-[0.16em] text-[var(--dim)]`}>
            <span>{item.source}</span>
            {item.publishedAt && (
              <span className="font-mono">{formatNewsTime(item.publishedAt)}</span>
            )}
          </div>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[var(--dim)] hover:text-[var(--ink)]"
          >
            <ExternalLink size={is4K ? 14 : 9} />
          </a>
        )}
      </div>
    </article>
  );
}

export default function NewsSidebar() {
  const [data, setData] = useState<MultilingualNewsResponse | null>(null);
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const is4K = useWarRoomScale();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(apiUrl(`/api/news/multilingual?t=${Date.now()}`));
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // silent
      }
    };

    void load();
    const interval = setInterval(() => { void load(); }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const alertCount = data ? [...data.th, ...data.en, ...data.zh].filter((i) => i.severity === "alert").length : 0;
  const watchCount = data ? [...data.th, ...data.en, ...data.zh].filter((i) => i.severity === "watch").length : 0;

  // Sort by recency first (newest on top), alerts bumped to very top
  const sortItems = (items: NewsItem[]) =>
    [...items].sort((a, b) => {
      // Alerts always float to top
      if (a.severity === "alert" && b.severity !== "alert") return -1;
      if (b.severity === "alert" && a.severity !== "alert") return 1;
      // Then by publication date (newest first)
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

  // At 4K: show dual columns (Thai left, International right)
  // At desktop: show combined filtered list
  if (is4K && data) {
    const thItems = sortItems(data.th);
    const intlItems = sortItems([...data.en, ...data.zh]);

    return (
      <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper size={18} className="text-[var(--cool)]" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                  Governor intelligence
                </div>
                <div className="text-[18px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                  News feed
                </div>
              </div>
            </div>
            <span className="live-badge text-[10px]">LIVE</span>
          </div>
          {(alertCount > 0 || watchCount > 0) && (
            <div className="mt-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-[#ef4444]">
                  <AlertTriangle size={12} /> {alertCount} alert
                </span>
              )}
              {watchCount > 0 && (
                <span className="flex items-center gap-1 text-[#f59e0b]">
                  <Globe size={12} /> {watchCount} watch
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dual-column news */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex">
          {/* Thai column */}
          <div className="flex-1 border-r border-[var(--line)]">
            <div className="px-3 py-2 border-b border-[var(--line)] bg-[rgba(15,111,136,0.03)]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">🇹🇭 Thai news</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {thItems.map((item, idx) => (
                <NewsItemCard key={`th-${item.id}-${idx}`} item={item} is4K={true} rank={idx} />
              ))}
            </div>
          </div>
          {/* International column */}
          <div className="flex-1">
            <div className="px-3 py-2 border-b border-[var(--line)] bg-[rgba(15,111,136,0.03)]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">🇬🇧 International</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {intlItems.map((item, idx) => (
                <NewsItemCard key={`intl-${item.id}-${idx}`} item={item} is4K={true} rank={idx} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--line)] px-4 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">
            {data.th.length} TH / {data.en.length} EN / {data.zh.length} ZH signals
          </div>
        </div>
      </aside>
    );
  }

  // ─── Standard desktop layout ───────────────────────────────────
  const allItems: NewsItem[] = data
    ? [
        ...(langFilter === "all" || langFilter === "th" ? data.th : []),
        ...(langFilter === "all" || langFilter === "en" ? data.en : []),
        ...(langFilter === "all" || langFilter === "zh" ? data.zh : []),
      ]
    : [];
  const sorted = sortItems(allItems);

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper size={13} className="text-[var(--cool)]" />
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                Multilingual signal
              </div>
              <div className="text-[13px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                News feed
              </div>
            </div>
          </div>
          <span className="live-badge">LIVE</span>
        </div>

        {(alertCount > 0 || watchCount > 0) && (
          <div className="mt-1.5 flex items-center gap-2 text-[8px] font-mono uppercase tracking-wider">
            {alertCount > 0 && (
              <span className="flex items-center gap-1 text-[#ef4444]">
                <AlertTriangle size={8} /> {alertCount} alert
              </span>
            )}
            {watchCount > 0 && (
              <span className="flex items-center gap-1 text-[#f59e0b]">
                <Globe size={8} /> {watchCount} watch
              </span>
            )}
          </div>
        )}

        {/* Language filter */}
        <div className="mt-2 flex gap-1">
          {(["all", "th", "en", "zh"] as LangFilter[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLangFilter(lang)}
              className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                langFilter === lang
                  ? "border-[var(--ink)] bg-[rgba(17,17,17,0.05)] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              {lang === "all"
                ? "ALL"
                : `${LANG_FLAGS[lang].flag} ${LANG_FLAGS[lang].label}`}
            </button>
          ))}
        </div>
      </div>

      {/* News items */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {!data && (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] text-[var(--muted)]">
              Loading multilingual signals...
            </span>
          </div>
        )}

        {data && sorted.length === 0 && (
          <div className="flex h-full items-center justify-center px-3">
            <span className="text-[10px] text-[var(--muted)]">
              No signals for selected language
            </span>
          </div>
        )}

        <div className="divide-y divide-[var(--line)]">
          {sorted.map((item, idx) => (
            <NewsItemCard key={`${item.id}-${idx}`} item={item} is4K={false} rank={idx} />
          ))}
        </div>
      </div>

      {/* Footer */}
      {data && (
        <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5">
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
            {data.th.length} TH / {data.en.length} EN / {data.zh.length} ZH signals
          </div>
        </div>
      )}
    </aside>
  );
}

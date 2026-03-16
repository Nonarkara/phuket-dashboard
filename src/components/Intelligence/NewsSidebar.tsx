"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Globe, Newspaper } from "lucide-react";

interface NewsItem {
  id: string;
  lang: "th" | "en" | "zh";
  title: string;
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

export default function NewsSidebar() {
  const [data, setData] = useState<MultilingualNewsResponse | null>(null);
  const [langFilter, setLangFilter] = useState<LangFilter>("all");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/news/multilingual");
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

  const allItems: NewsItem[] = data
    ? [
        ...(langFilter === "all" || langFilter === "th" ? data.th : []),
        ...(langFilter === "all" || langFilter === "en" ? data.en : []),
        ...(langFilter === "all" || langFilter === "zh" ? data.zh : []),
      ]
    : [];

  // Sort: alerts first, then watch, then stable
  const sorted = allItems.sort((a, b) => {
    const order = { alert: 0, watch: 1, stable: 2 };
    return order[a.severity] - order[b.severity];
  });

  const alertCount = allItems.filter((i) => i.severity === "alert").length;
  const watchCount = allItems.filter((i) => i.severity === "watch").length;

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

        {/* Stats row */}
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
          {sorted.map((item) => (
            <article
              key={item.id}
              className={`border-l-2 ${severityBorder(item.severity)} px-3 py-2 transition-colors hover:bg-[rgba(15,111,136,0.03)]`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 text-[10px]">
                      {LANG_FLAGS[item.lang]?.flag}
                    </span>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityDot(item.severity)}`} />
                    <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
                      {item.zone}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-[var(--ink)]">
                    {item.title}
                  </div>
                  <p className="mt-0.5 text-[9px] leading-[14px] text-[var(--muted)]">
                    {item.summary}
                  </p>
                  <div className="mt-1 text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
                    {item.source}
                  </div>
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[var(--dim)] hover:text-[var(--ink)]"
                  >
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </article>
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

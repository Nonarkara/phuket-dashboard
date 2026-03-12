"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { NewsResponse } from "../../types/dashboard";

function isNewsResponse(value: unknown): value is NewsResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "news" in value &&
    Array.isArray(value.news)
  );
}

function severityClass(severity: string) {
  if (severity === "alert") {
    return "bg-[rgba(239,68,68,0.15)] text-[#ef4444]";
  }

  if (severity === "watch") {
    return "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";
  }

  return "bg-[var(--line-bright)] text-[var(--cool)]";
}

export default function NewsDesk() {
  const [payload, setPayload] = useState<NewsResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/news");
      const nextPayload: unknown = await response.json();

      if (isNewsResponse(nextPayload)) {
        setPayload(nextPayload);
      }
    } catch {
      setPayload(null);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    const interval = setInterval(() => {
      void load();
    }, 2 * 60 * 1000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().then(() => setTimeout(() => setRefreshing(false), 600));
  };

  const items = payload?.news ?? [];

  if (items.length === 0) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
        <span className="eyebrow">Loading live signal stream</span>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-4 overflow-y-auto">
      <div className="border-b border-[var(--line)] pb-3">
        <div className="flex items-center gap-3">
          <div className="eyebrow">Live feed</div>
          <span className="live-badge">LIVE</span>
          <button type="button" onClick={handleRefresh} className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors ml-auto" title="Refresh news feed">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="pt-2 text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Local signal stream
        </div>
      </div>

      <div className="divide-y divide-[var(--line)] overflow-y-auto pt-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] ${severityClass(item.severity)}`}
                >
                  {item.tag}
                </span>
              </div>
              <span className="text-[9px] font-mono tabular-nums text-[var(--dim)]">
                {new Date(item.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                })}
              </span>
            </div>
            <h3 className="pt-2 text-[13px] font-semibold leading-5 text-[var(--ink)]">
              {item.title}
            </h3>
            <p className="pt-1 text-[11px] leading-5 text-[var(--muted)]">
              {item.summary}
            </p>
            <div className="pt-2 text-[9px] uppercase tracking-[0.16em] text-[var(--dim)]">
              {item.source}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

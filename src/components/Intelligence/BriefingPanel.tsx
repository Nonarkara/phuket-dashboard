"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type {
  IntelligencePackageResponse,
  PackageStatus,
} from "../../types/dashboard";

function isIntelligencePackageResponse(
  value: unknown,
): value is IntelligencePackageResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "packages" in value &&
    Array.isArray(value.packages)
  );
}

function statusClass(status: PackageStatus) {
  if (status === "live") {
    return "bg-[rgba(34,197,94,0.15)] text-[#22c55e]";
  }

  if (status === "stale") {
    return "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";
  }

  return "bg-[rgba(239,68,68,0.15)] text-[#ef4444]";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BriefingPanel() {
  const [payload, setPayload] = useState<IntelligencePackageResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence/packages");
      const nextPayload: unknown = await response.json();

      if (isIntelligencePackageResponse(nextPayload)) {
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

  if (!payload) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
        <span className="eyebrow">Loading intelligence packages</span>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="eyebrow">Briefing</div>
            <span className="live-badge">LIVE</span>
            <button type="button" onClick={handleRefresh} className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors" title="Refresh intelligence packages">
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
          <h2 className="pt-2 text-[18px] font-bold tracking-[-0.03em] text-[var(--ink)]">
            Phuket packages
          </h2>
        </div>
        <div className="text-right text-[9px] font-mono tabular-nums text-[var(--dim)]">
          {formatTimestamp(payload.generatedAt)}
        </div>
      </div>

      <div className="mt-2 divide-y divide-[var(--line)]">
        {payload.packages.map((pkg) => (
          <article
            key={pkg.id}
            className="py-3 first:pt-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                  {pkg.title}
                </div>
                <div className="pt-1 text-[11px] leading-5 text-[var(--muted)]">
                  {pkg.headline}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] ${statusClass(pkg.status)}`}
              >
                {pkg.status}
              </span>
            </div>

            <div className="pt-3 flex flex-wrap gap-1.5">
              {pkg.dominantTags.map((tag) => (
                <span
                  key={tag}
                  className="border border-[var(--line)] px-2 py-0.5 text-[9px] text-[var(--cool)]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {pkg.priorities.slice(0, 2).map((item) => (
                <div
                  key={item}
                  className="border-l border-[var(--line-bright)] pl-3 text-[10px] leading-4 text-[var(--muted)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between text-[9px] font-mono tabular-nums text-[var(--dim)]">
              <span>{pkg.stats.elevated} elevated</span>
              <span>{formatTimestamp(pkg.updatedAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fallbackSources } from "../../lib/mock-data";
import { buildMapOverlayCatalog } from "../../lib/map-overlays";
import type {
  ApiSourceResponse,
  MapOverlayCatalogResponse,
} from "../../types/dashboard";

function isApiSourceResponse(value: unknown): value is ApiSourceResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "sources" in value &&
    Array.isArray(value.sources)
  );
}

function isMapOverlayCatalogResponse(
  value: unknown,
): value is MapOverlayCatalogResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "overlays" in value &&
    Array.isArray(value.overlays)
  );
}

export default function SourceStack() {
  const [sources, setSources] = useState<ApiSourceResponse>(fallbackSources);
  const [catalog, setCatalog] = useState<MapOverlayCatalogResponse>(
    buildMapOverlayCatalog(),
  );
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sourcesResponse, overlayResponse] = await Promise.all([
        fetch("/api/sources"),
        fetch("/api/map/overlays"),
      ]);
      const [sourcesPayload, overlayPayload]: [unknown, unknown] =
        await Promise.all([sourcesResponse.json(), overlayResponse.json()]);

      if (isApiSourceResponse(sourcesPayload)) {
        setSources(sourcesPayload);
      }

      if (isMapOverlayCatalogResponse(overlayPayload)) {
        setCatalog(overlayPayload);
      }
    } catch {
      setSources(fallbackSources);
      setCatalog(buildMapOverlayCatalog());
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    const interval = setInterval(() => {
      void load();
    }, 3 * 60 * 1000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().then(() => setTimeout(() => setRefreshing(false), 600));
  };

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] overflow-y-auto">
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="eyebrow">Sources</div>
            <div className="pt-1 text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)]">
              Data feeds
            </div>
          </div>
          <button type="button" onClick={handleRefresh} className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors" title="Refresh sources">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="divide-y divide-[var(--line)] pt-2">
          {sources.sources.slice(0, 4).map((source) => (
            <div
              key={source.id}
              className="grid grid-cols-[70px_1fr] gap-3 py-3 text-[10px]"
            >
              <div className="font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
                {source.target}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-[var(--ink)]">{source.label}</div>
                  {source.health ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] ${
                        source.health === "live"
                          ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e]"
                          : source.health === "stale"
                            ? "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]"
                            : "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
                      }`}
                    >
                      {source.health}
                    </span>
                  ) : null}
                </div>
                <div className="truncate pt-0.5 text-[var(--dim)]">{source.url}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--line)] p-4">
        <div className="eyebrow">
          Overlays / {new Date(catalog.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          })}
        </div>
        <div className="grid gap-0 pt-2">
          {catalog.overlays
            .filter((overlay) => overlay.kind === "raster")
            .slice(0, 5)
            .map((source) => (
            <div
              key={source.id}
              className="border-t border-[var(--line)] px-0 py-3 first:border-t-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cool)]">
                  {source.label}
                </div>
                <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-[var(--dim)]">
                  {source.shortLabel}
                </span>
              </div>
              <p className="pt-1 text-[10px] leading-4 text-[var(--dim)]">
                {source.description}
              </p>
              <div className="pt-1 text-[9px] uppercase tracking-[0.14em] text-[var(--dim)]">
                {source.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

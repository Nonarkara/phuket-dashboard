"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Satellite } from "lucide-react";

interface ProviderSummary {
  id: string;
  name: string;
  country: string;
  capabilityCount: number;
  primaryEndpoint: string;
  accessLevel: string;
  notes: string;
  health: "live" | "stale" | "offline";
  checkedAt: string;
}

interface CatalogPayload {
  generatedAt: string;
  summary: {
    totalProviders: number;
    liveProviders: number;
    offlineProviders: number;
    totalCapabilities: number;
  };
  providers: ProviderSummary[];
}

function isCatalogPayload(value: unknown): value is CatalogPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "providers" in value &&
    Array.isArray((value as CatalogPayload).providers)
  );
}

export default function SatelliteStatusPanel() {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/satellite/catalog");
      const data: unknown = await response.json();
      if (isCatalogPayload(data)) setPayload(data);
    } catch {
      setPayload(null);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => { void load(); }, 0);
    const interval = setInterval(() => { void load(); }, 10 * 60 * 1000);
    return () => { clearTimeout(initialLoad); clearInterval(interval); };
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().then(() => setTimeout(() => setRefreshing(false), 600));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Satellite size={10} className="text-[var(--cool)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
            Satellite feeds
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors"
          title="Refresh satellite status"
        >
          <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {!payload ? (
        <div className="text-[9px] text-[var(--muted)]">Loading satellite status...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1">
            <div className="border border-[var(--line)] px-1.5 py-1 text-center">
              <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">Providers</div>
              <div className="text-[12px] font-mono font-bold text-[var(--ink)]">{payload.summary.totalProviders}</div>
            </div>
            <div className="border border-[var(--line)] px-1.5 py-1 text-center">
              <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">Reachable</div>
              <div className="text-[12px] font-mono font-bold text-[#22c55e]">{payload.summary.liveProviders}</div>
            </div>
            <div className="border border-[var(--line)] px-1.5 py-1 text-center">
              <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">Catalog</div>
              <div className="text-[12px] font-mono font-bold text-[var(--ink)]">{payload.summary.totalCapabilities}</div>
            </div>
          </div>

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {payload.providers.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between py-1.5 px-0.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        provider.health === "live" ? "bg-[#22c55e] animate-pulse" : "bg-[var(--dim)]"
                      }`}
                    />
                    <span className="text-[9px] font-bold text-[var(--ink)]">{provider.name}</span>
                    <span className="text-[7px] font-mono text-[var(--dim)]">{provider.country}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${provider.health === "live" ? "text-[#22c55e]" : "text-[var(--dim)]"}`}>
                    {provider.health}
                  </span>
                  <span className="text-[7px] text-[var(--dim)]">/</span>
                  <span className="text-[8px] font-mono text-[var(--dim)]">{provider.capabilityCount}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

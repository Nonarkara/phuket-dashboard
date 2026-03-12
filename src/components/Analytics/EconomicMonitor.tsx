"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import {
  fallbackAseanGdp,
  fallbackEconomicIndicators,
} from "../../lib/mock-data";
import type {
  AseanGdpDatum,
  EconomicIndicator,
  MarketRadarResponse,
} from "../../types/dashboard";

const isEconomicIndicatorArray = (value: unknown): value is EconomicIndicator[] =>
  Array.isArray(value);

const isAseanGdpArray = (value: unknown): value is AseanGdpDatum[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "countryCode" in entry &&
      "country" in entry &&
      "gdpUsd" in entry &&
      "gdpPerCapitaUsd" in entry,
  );

const isMarketRadarResponse = (value: unknown): value is MarketRadarResponse =>
  typeof value === "object" &&
  value !== null &&
  "generatedAt" in value &&
  "data" in value &&
  isEconomicIndicatorArray(value.data) &&
  "signals" in value &&
  isEconomicIndicatorArray(value.signals) &&
  "aseanGdp" in value &&
  isAseanGdpArray(value.aseanGdp) &&
  "sources" in value &&
  Array.isArray(value.sources);

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

function formatCompactUsd(value: number) {
  return `$${compactCurrencyFormatter.format(value)}`;
}

function formatSignalValue(item: EconomicIndicator) {
  if (typeof item.value !== "number") {
    return item.value;
  }

  return item.value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatSignalChange(item: EconomicIndicator) {
  if (typeof item.change === "number") {
    return Math.abs(item.change).toFixed(2);
  }

  return item.change;
}

function formatMacroCoverage(entries: AseanGdpDatum[]) {
  const years = Array.from(
    new Set(entries.flatMap((entry) => [entry.gdpYear, entry.gdpPerCapitaYear])),
  ).sort((left, right) => left - right);

  if (years.length === 0) {
    return "n/a";
  }

  if (years.length === 1) {
    return String(years[0]);
  }

  return `${years[0]}-${years[years.length - 1]}`;
}

export default function EconomicMonitor() {
  const [indicators, setIndicators] = React.useState<EconomicIndicator[]>([]);
  const [aseanGdp, setAseanGdp] = React.useState<AseanGdpDatum[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchEconomics = React.useCallback(async () => {
    try {
      const res = await fetch("/api/markets");
      const payload: unknown = await res.json();

      if (isMarketRadarResponse(payload)) {
        setIndicators(payload.signals.length > 0 ? payload.signals : payload.data);
        setAseanGdp(payload.aseanGdp.length > 0 ? payload.aseanGdp : fallbackAseanGdp);
        setSources(payload.sources);
        return;
      }

      if (isEconomicIndicatorArray(payload)) {
        setIndicators(payload);
        setAseanGdp(fallbackAseanGdp);
        setSources(["Fallback markets"]);
        return;
      }

      if (
        payload &&
        typeof payload === "object" &&
        "data" in payload &&
        isEconomicIndicatorArray(payload.data)
      ) {
        setIndicators(payload.data);
        setAseanGdp(
          "aseanGdp" in payload && isAseanGdpArray(payload.aseanGdp)
            ? payload.aseanGdp
            : fallbackAseanGdp,
        );
        setSources(
          "sources" in payload && Array.isArray(payload.sources)
            ? payload.sources.filter((entry): entry is string => typeof entry === "string")
            : ["Fallback markets"],
        );
        return;
      }

      setIndicators(fallbackEconomicIndicators);
      setAseanGdp(fallbackAseanGdp);
      setSources(["Fallback markets", "Fallback macro snapshot"]);
    } catch {
      setIndicators(fallbackEconomicIndicators);
      setAseanGdp(fallbackAseanGdp);
      setSources(["Fallback markets", "Fallback macro snapshot"]);
    }
  }, []);

  React.useEffect(() => {
    fetchEconomics();
    const interval = setInterval(fetchEconomics, 90 * 1000);
    return () => clearInterval(interval);
  }, [fetchEconomics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEconomics().then(() => setTimeout(() => setRefreshing(false), 600));
  };

  if (indicators.length === 0 && aseanGdp.length === 0) {
    return (
      <div className="flex h-full items-center px-5">
        <span className="eyebrow">Synchronizing market signals</span>
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-4 select-none overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <div>
          <div className="eyebrow">Economic radar</div>
          <h3 className="pt-1 text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            Tourism & cost
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleRefresh} className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors" title="Refresh market data">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
          <span className="live-badge">LIVE / MACRO</span>
        </div>
      </div>

      <div className="mt-3 space-y-4 flex-1">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Live operating signals
            </span>
            <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-[var(--dim)]">
              90s refresh
            </span>
          </div>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {indicators.slice(0, 4).map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
                    {item.category ?? "REF"}
                  </span>
                  <span className="truncate text-[12px] font-bold text-[var(--ink)]">
                    {item.label}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--ink)]">
                    {formatSignalValue(item)}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold tabular-nums ${
                      item.up ? "text-[#22c55e]" : "text-[#ef4444]"
                    }`}
                  >
                    {item.up ? "▲" : "▼"} {formatSignalChange(item)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Regional GDP context
            </span>
            <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-[var(--dim)]">
              {formatMacroCoverage(aseanGdp)}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)]">
            <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_40px] gap-2 border-b border-[var(--line)] px-3 py-2 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              <span>Country</span>
              <span className="text-right">GDP</span>
              <span className="text-right">GDP/cap</span>
              <span className="text-right">Yr</span>
            </div>
            <div>
              {aseanGdp.map((entry) => (
                <div
                  key={entry.countryCode}
                  className="grid grid-cols-[minmax(0,1fr)_72px_72px_40px] gap-2 border-b border-[var(--line)] px-3 py-2 text-[10px] leading-4 last:border-b-0"
                >
                  <span className="truncate font-semibold text-[var(--ink)]">
                    {entry.country}
                  </span>
                  <span className="text-right font-mono tabular-nums text-[var(--ink)]">
                    {formatCompactUsd(entry.gdpUsd)}
                  </span>
                  <span className="text-right font-mono tabular-nums text-[var(--cool)]">
                    {formatCompactUsd(entry.gdpPerCapitaUsd)}
                  </span>
                  <span className="text-right font-mono tabular-nums text-[var(--dim)]">
                    {entry.gdpYear === entry.gdpPerCapitaYear
                      ? String(entry.gdpYear).slice(-2)
                      : `${String(entry.gdpYear).slice(-2)}/${String(
                          entry.gdpPerCapitaYear,
                        ).slice(-2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[7px] font-mono tracking-[0.1em] text-[var(--dim)]">
        Source: {sources.join(" · ")}. GDP uses the latest annual official release.
      </div>
    </section>
  );
}

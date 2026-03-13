"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { ASEAN_COUNTRIES } from "../../lib/asean-country-registry";
import type {
  AseanCountryProfileResponse,
  AseanProfileMetric,
} from "../../types/dashboard";

function isAseanProfileMetric(value: unknown): value is AseanProfileMetric {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "label" in value &&
    typeof value.label === "string"
  );
}

function isAseanCountryProfileResponse(
  value: unknown,
): value is AseanCountryProfileResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "country" in value &&
    typeof value.country === "object" &&
    value.country !== null &&
    "metrics" in value &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isAseanProfileMetric) &&
    "news" in value &&
    Array.isArray(value.news)
  );
}

function formatMetricValue(metric: AseanProfileMetric) {
  if (metric.value === null) return "n/a";
  if (metric.id === "gdp-per-person") return `$${Math.round(metric.value).toLocaleString()}`;
  if (metric.id === "population") return Math.round(metric.value).toLocaleString();
  const rounded = metric.value >= 100 ? metric.value.toFixed(0) : metric.value.toFixed(1);
  if (metric.unit === "% of GDP" || metric.unit === "%") return `${rounded}%`;
  return rounded;
}

export default function AseanEconomicsPanel() {
  const [selectedCountry, setSelectedCountry] = useState("THA");
  const [payload, setPayload] = useState<AseanCountryProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const selectedLabel =
    ASEAN_COUNTRIES.find((country) => country.code === selectedCountry)?.label ?? "Thailand";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setPayload(null);
      try {
        const response = await fetch(
          `/api/asean/profile?country=${encodeURIComponent(selectedCountry)}`,
        );
        const nextPayload: unknown = await response.json();
        if (!cancelled && isAseanCountryProfileResponse(nextPayload)) {
          setPayload(nextPayload);
        } else if (!cancelled) {
          setPayload(null);
        }
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedCountry]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={10} className="text-[var(--cool)]" />
          <span className="text-[10px] font-bold text-[var(--ink)]">
            {payload?.country.label ?? selectedLabel}
          </span>
        </div>
      </div>

      <div className="relative">
        <select
          value={selectedCountry}
          onChange={(event) => setSelectedCountry(event.target.value)}
          className="w-full appearance-none border border-[var(--line)] bg-transparent px-2 py-1.5 pr-7 text-[10px] font-medium text-[var(--ink)] outline-none transition-colors hover:border-[var(--line-bright)] focus:border-[var(--cool)]"
          aria-label="Select ASEAN country"
        >
          {ASEAN_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-[7px] text-[var(--dim)]" />
      </div>

      {isLoading && !payload ? (
        <div className="text-[9px] text-[var(--muted)]">Loading macro profile...</div>
      ) : !payload ? (
        <div className="text-[9px] text-[var(--muted)]">Profile unavailable. Retrying next cycle.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1">
            {(payload?.metrics ?? []).map((metric) => (
              <div key={metric.id} className="border border-[var(--line)] px-2 py-1.5">
                <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">
                  {metric.label}
                </div>
                <div className="pt-0.5 text-[12px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                  {formatMetricValue(metric)}
                </div>
                {metric.year && (
                  <div className="text-[7px] font-mono text-[var(--dim)]">{metric.year}</div>
                )}
              </div>
            ))}
          </div>

          {payload.news.length > 0 && (
            <div className="space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">
                Economics news
              </div>
              {payload.news.slice(0, 3).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-[var(--line)] px-2 py-1.5 transition-colors hover:border-[var(--line-bright)]"
                >
                  <div className="text-[9px] font-medium leading-3.5 text-[var(--ink)]">
                    {item.title}
                  </div>
                  <div className="pt-0.5 text-[7px] font-mono uppercase tracking-[0.1em] text-[var(--dim)]">
                    {item.source}
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

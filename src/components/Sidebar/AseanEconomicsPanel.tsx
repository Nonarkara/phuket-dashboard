"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Globe2, TrendingUp } from "lucide-react";
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

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "--";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "--";
  }

  return timestamp.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMetricValue(metric: AseanProfileMetric) {
  if (metric.value === null) {
    return "n/a";
  }

  if (metric.id === "gdp-per-person") {
    return `$${Math.round(metric.value).toLocaleString()}`;
  }

  if (metric.id === "population") {
    return Math.round(metric.value).toLocaleString();
  }

  const rounded = metric.value >= 100 ? metric.value.toFixed(0) : metric.value.toFixed(1);

  if (metric.unit === "% of GDP") {
    return `${rounded}%`;
  }

  if (metric.unit === "%") {
    return `${rounded}%`;
  }

  return rounded;
}

function formatSecondaryMetric(metric: AseanProfileMetric) {
  if (
    metric.id !== "gdp-per-person" ||
    typeof metric.secondaryValue !== "number"
  ) {
    return null;
  }

  return `PPP int$ ${Math.round(metric.secondaryValue).toLocaleString()}${
    metric.secondaryYear ? ` · ${metric.secondaryYear}` : ""
  }`;
}

function MetricCard({ metric }: { metric: AseanProfileMetric }) {
  const secondary = formatSecondaryMetric(metric);

  return (
    <article className="border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
          {metric.label}
        </div>
        <span className="rounded-full bg-[var(--line)] px-2 py-0.5 text-[8px] font-mono text-[var(--muted)]">
          {metric.year ?? "--"}
        </span>
      </div>

      <div className="pt-2 text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        {formatMetricValue(metric)}
      </div>

      {secondary ? (
        <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">{secondary}</div>
      ) : null}

      {metric.note ? (
        <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">{metric.note}</div>
      ) : metric.unit && metric.id !== "gdp-per-person" && metric.id !== "population" ? (
        <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">{metric.unit}</div>
      ) : null}
    </article>
  );
}

export default function AseanEconomicsPanel() {
  const [selectedCountry, setSelectedCountry] = useState("THA");
  const [payload, setPayload] = useState<AseanCountryProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const selectedLabel =
    ASEAN_COUNTRIES.find((country) => country.code === selectedCountry)?.label ??
    "Thailand";

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
        if (!cancelled) {
          setPayload(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cool)]">
            <TrendingUp size={12} />
            <span>Country profile</span>
          </div>
          <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            {payload?.country.label ?? selectedLabel}
          </h3>
        </div>
        <div className="text-right text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--dim)]">
          <div>Updated</div>
          <div className="pt-1 text-[11px] text-[var(--muted)]">
            {formatUpdatedAt(payload?.generatedAt)}
          </div>
        </div>
      </div>

      <div className="relative pt-4">
        <select
          value={selectedCountry}
          onChange={(event) => setSelectedCountry(event.target.value)}
          className="w-full appearance-none border border-[var(--line)] bg-transparent px-3 py-2.5 pr-10 text-[13px] font-medium text-[var(--ink)] outline-none transition-colors hover:border-[var(--line-bright)] focus:border-[var(--cool)]"
          aria-label="Select ASEAN country"
        >
          {ASEAN_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-[calc(1rem+12px)] text-[var(--dim)]"
        />
      </div>

      {isLoading && !payload ? (
        <div className="mt-4 border border-[var(--line)] p-3 text-[11px] leading-5 text-[var(--muted)]">
          Loading latest macro profile and country economics coverage.
        </div>
      ) : !payload ? (
        <div className="mt-4 border border-[var(--line)] p-3 text-[11px] leading-5 text-[var(--muted)]">
          The country profile is unavailable right now. The selector is still active, and
          the panel will retry on the next refresh cycle.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(payload?.metrics ?? []).map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          <div className="mt-4 border border-[var(--line)] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
              <Globe2 size={12} />
              <span>Relevant economics news</span>
            </div>

            <div className="mt-3 space-y-3">
              {payload && payload.news.length > 0 ? (
                payload.news.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block border border-[var(--line)] p-3 transition-colors hover:border-[var(--line-bright)]"
                  >
                    <div className="text-[12px] font-medium leading-5 text-[var(--ink)]">
                      {item.title}
                    </div>
                    <div className="pt-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--dim)]">
                      {item.source} · {formatUpdatedAt(item.publishedAt)}
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-[11px] leading-5 text-[var(--muted)]">
                  No recent country-scoped economics headlines were matched in the current
                  14-day news window.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 text-[10px] leading-4 text-[var(--dim)]">
            World Bank · Country news feed
          </div>
        </>
      )}
    </div>
  );
}

"use client";

/**
 * CityFacts — the static context layer from Phuket's own government statistics
 * (phuket.gdcatalog.go.th, the provincial data.go.th node, baked by
 * scripts/fetch-datagoth.mjs).
 *
 * This is what makes the live numbers mean something: today's rainfall reads
 * differently next to the island's 400k-ton annual waste stream and 17M airport
 * passengers. Every figure names its publisher and Buddhist-era year — these are
 * annual administrative statistics, not live telemetry, and the panel must never
 * let them read as "now".
 */
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { assetPath } from "../../lib/asset-path";
import { SkeletonRow } from "../Skeleton";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";

interface GovDataset {
  key: string;
  domain: "tourism" | "water" | "safety" | "health";
  label: string;
  titleTh: string;
  org: string;
  updated: string;
  landing: string;
  header: string[];
  rows: string[][];
}

interface GovBundle {
  generatedAt: string;
  datasets: GovDataset[];
}

const DOMAINS: { id: GovDataset["domain"]; label: string }[] = [
  { id: "tourism", label: "Tourism load" },
  { id: "water", label: "Water & waste" },
  { id: "safety", label: "Safety" },
  { id: "health", label: "Health" },
];

const YEAR_COLS = ["ปี"];
const VALUE_COLS = ["จำนวน", "จำนวนการใช้บริการ", "Value"];
const UNIT_COLS = ["หน่วย", "unit"];

function parseNum(s: string): number | null {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && s.trim() !== "" ? n : null;
}

interface Fact {
  key: string;
  label: string;
  value: string;
  unit: string;
  yearBE: string | null;
  org: string;
  landing: string;
  titleTh: string;
}

/**
 * Reduce a dataset to its single headline figure.
 *
 * Rule: take the latest year that has numeric data (rows can carry
 * "รอประมวลผล" — pending — for the current year); within it prefer an explicit
 * "รวม" total row over summing, because these files usually publish breakdowns
 * AND the total, and summing both double-counts.
 */
function headline(d: GovDataset): Fact | null {
  const col = (names: string[]) =>
    d.header.findIndex((h) => names.some((n) => h.replace(/\s/g, "") === n));
  const yearIdx = col(YEAR_COLS);
  const valueIdx = col(VALUE_COLS);
  const unitIdx = col(UNIT_COLS);
  if (valueIdx < 0) return null;

  const numeric = d.rows
    .map((r) => ({ r, v: parseNum(r[valueIdx] ?? "") }))
    .filter((x): x is { r: string[]; v: number } => x.v !== null);
  if (!numeric.length) return null;

  let pool = numeric;
  let yearBE: string | null = null;
  if (yearIdx >= 0) {
    const years = [...new Set(numeric.map((x) => x.r[yearIdx]))].sort();
    yearBE = years[years.length - 1] ?? null;
    pool = numeric.filter((x) => x.r[yearIdx] === yearBE);
  }

  const totals = pool.filter((x) => x.r.some((c, i) => i !== valueIdx && c === "รวม"));
  const chosen = totals.length
    ? totals.reduce((a, b) => (b.v > a.v ? b : a))
    : { r: pool[0].r, v: pool.reduce((s, x) => s + x.v, 0) };

  const unit = unitIdx >= 0 ? (chosen.r[unitIdx] ?? "") : "";
  const value =
    chosen.v >= 1_000_000 ? `${(chosen.v / 1_000_000).toFixed(2)}M`
    : chosen.v >= 10_000 ? `${Math.round(chosen.v).toLocaleString("en-US")}`
    : chosen.v % 1 !== 0 ? chosen.v.toFixed(2)
    : String(chosen.v);

  return {
    key: d.key, label: d.label, value, unit, yearBE,
    org: d.org, landing: d.landing, titleTh: d.titleTh,
  };
}

export default function CityFacts() {
  const [bundle, setBundle] = useState<GovBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const is4K = useWarRoomScale();

  useEffect(() => {
    fetch(assetPath("/data/gov/all.json"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: GovBundle) => setBundle(d))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <section className="border-t border-[var(--line)] px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Landmark size={is4K ? 14 : 11} className="text-[var(--cool)]" />
          <span className={`${is4K ? "text-[11px]" : "text-[9px]"} font-bold uppercase tracking-[0.16em] text-[var(--dim)]`}>
            City facts · data.go.th
          </span>
        </div>
        <span className={`${is4K ? "text-[9px]" : "text-[7px]"} font-mono uppercase tracking-[0.14em] text-[var(--dim)]`}>
          Annual · official
        </span>
      </div>

      {!bundle && (
        <div className="mt-2">
          <SkeletonRow count={4} gap="10px" />
        </div>
      )}

      {bundle && DOMAINS.map((dom) => {
        const facts = bundle.datasets
          .filter((d) => d.domain === dom.id)
          .map(headline)
          .filter((f): f is Fact => f !== null);
        if (!facts.length) return null;
        return (
          <div key={dom.id} className="mt-2.5">
            <div className={`${is4K ? "text-[9px]" : "text-[7px]"} font-bold uppercase tracking-[0.18em] text-[var(--dim)]`}>
              {dom.label}
            </div>
            <div className="mt-1 space-y-px">
              {facts.map((f) => (
                <a
                  key={f.key}
                  href={f.landing}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${f.titleTh} — ${f.org}`}
                  className="group flex items-baseline justify-between gap-2 py-0.5 hover:bg-[rgba(15,111,136,0.05)]"
                >
                  <span className={`${is4K ? "text-[11px]" : "text-[9px]"} min-w-0 truncate text-[var(--muted)] group-hover:text-[var(--ink)]`}>
                    {f.label}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1">
                    <span className={`${is4K ? "text-[12px]" : "text-[10px]"} font-mono font-bold text-[var(--ink)]`}>
                      {f.value}
                    </span>
                    <span className={`${is4K ? "text-[9px]" : "text-[7px]"} text-[var(--dim)]`}>
                      {f.unit}
                    </span>
                    {f.yearBE && (
                      <span className={`${is4K ? "text-[9px]" : "text-[7px]"} font-mono text-[var(--dim)]`}>
                        พ.ศ.{f.yearBE}
                      </span>
                    )}
                  </span>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {/* What this panel cannot say — stated, not implied. */}
      <p className={`mt-2 ${is4K ? "text-[9px] leading-4" : "text-[7px] leading-[11px]"} text-[var(--dim)]`}>
        Annual administrative statistics, latest published year per series. Not
        live telemetry — says nothing about today.
      </p>
    </section>
  );
}

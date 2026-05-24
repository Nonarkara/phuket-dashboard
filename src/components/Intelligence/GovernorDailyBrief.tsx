"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CloudLightning, Scale, Sparkles } from "lucide-react";
import { apiUrl } from "../../lib/asset-path";
import { phuketSlugLine } from "../../data/phuket-sciti-metrics";
import type { CoralWatchData } from "../../app/api/coral-watch/route";
import type { MarineConditions } from "../../app/api/marine-conditions/route";
import {
  PHUKET_TOTALS,
  BANGKOK_TOTALS,
  PHUKET_DEATH_RATE_MULTIPLE,
  PHUKET_DISTRICTS,
  PHUKET_BY_VEHICLE,
  PHUKET_PEAK_HOURS,
  ROAD_SAFETY_ACTIONS,
  THAIRSC_PERIOD,
  THAIRSC_SOURCE_URL,
} from "../../data/phuket-road-safety";
import type {
  ExecutiveStatus,
  GovernorBrief,
  OperationsDashboardResponse,
} from "../../types/dashboard";

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  source: string;
  zone: string;
  severity: "alert" | "watch" | "stable";
  url?: string;
  publishedAt?: string;
}

interface MultilingualNewsResponse {
  th: NewsItem[];
  en: NewsItem[];
  zh: NewsItem[];
}

type ActionType =
  | "brief_press"
  | "intervene"
  | "frame_media"
  | "confirm_delivery"
  | "pre_position"
  | "hold_posture";

interface BriefItem {
  id: string;
  headline: string;
  why: string;
  source: string;
  href?: string;
  action: string;
  actionType: ActionType;
  publishedAt?: string;
}

function formatRelativeAge(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  return null;
}

function buildActionDraft(item: BriefItem): string {
  const head = item.headline.trim();
  const ctx = (item.why ?? "").trim();
  const src = item.source ? `\nSource: ${item.source}` : "";
  const sciti = phuketSlugLine();
  switch (item.actionType) {
    case "brief_press":
      return `[${sciti} — public statement]

Re: ${head}

The Provincial Office is monitoring this situation and coordinating with the relevant agencies. ${ctx} We will provide further updates as warranted. Public safety remains our priority.${src}

— Office of the Governor of Phuket`;
    case "intervene":
      return `[Decision brief — immediate · ${sciti}]

Issue: ${head}
Why now: ${ctx}

Recommended action: immediate intervention by lead agency. Confirm action and brief-out by end of day.${src}`;
    case "frame_media":
      return `[${sciti} — release ready]

${head}

The province is delivering on its commitment. ${ctx}${src}

— Office of the Governor of Phuket`;
    case "confirm_delivery":
      return `[Status check — scheduled delivery]

Item: ${head}
Note: ${ctx}

Please confirm completion status by end of day.`;
    case "pre_position":
      return `[Operations advisory — pre-positioning · ${sciti}]

${head}
${ctx}

Recommend lead agencies confirm readiness and resourcing within 4 hours. Brief out before posture window opens.${src}`;
    case "hold_posture":
      return `[Operations — posture hold · ${sciti}]

${head}. ${ctx} Continuing standard monitoring posture; no further action required at this time.${src}`;
  }
}

interface Props {
  brief: GovernorBrief | null;
  operations: OperationsDashboardResponse | null;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export default function GovernorDailyBrief({ brief, operations }: Props) {
  const [news, setNews] = useState<MultilingualNewsResponse | null>(null);
  const [coralWatch, setCoralWatch] = useState<CoralWatchData | null>(null);
  const [marineConditions, setMarineConditions] = useState<MarineConditions | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/news/multilingual?t=${Date.now()}`),
        );
        if (!res.ok) return;
        const data = (await res.json()) as MultilingualNewsResponse;
        if (!cancelled) setNews(data);
      } catch {
        // silent
      }
    };
    void load();
    const interval = setInterval(() => void load(), 3 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Coral watch + marine — fetch once, refresh hourly
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(apiUrl("/api/coral-watch")).then((r) => r.ok ? r.json() : null),
      fetch(apiUrl("/api/marine-conditions")).then((r) => r.ok ? r.json() : null),
    ]).then(([coral, marine]) => {
      if (cancelled) return;
      if (coral) setCoralWatch(coral as CoralWatchData);
      if (marine) setMarineConditions(marine as MarineConditions);
    }).catch(() => {});
    const interval = setInterval(() => {
      if (cancelled) return;
      fetch(apiUrl("/api/coral-watch")).then((r) => r.ok ? r.json() : null).then((d) => !cancelled && d && setCoralWatch(d as CoralWatchData)).catch(() => {});
      fetch(apiUrl("/api/marine-conditions")).then((r) => r.ok ? r.json() : null).then((d) => !cancelled && d && setMarineConditions(d as MarineConditions)).catch(() => {});
    }, 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const fires = computeFires(brief, news, coralWatch, marineConditions);
  const wins = computeWins(brief);
  const risk = computeRisk(operations, marineConditions);
  const realityChecks = computeRealityChecks(news, operations);
  const hottestZone = computeHottestZone(news);

  const postureLevel = brief?.posture?.level ?? null;
  const postureColor =
    postureLevel === "intervene"
      ? "#ef4444"
      : postureLevel === "watch"
        ? "#f59e0b"
        : postureLevel === "stable"
          ? "#22c55e"
          : "var(--line)";
  const postureWord =
    postureLevel === "intervene"
      ? "Intervene"
      : postureLevel === "watch"
        ? "Watch"
        : postureLevel === "stable"
          ? "Calm"
          : "Loading";

  return (
    <section className="border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: postureColor }}
            aria-label={`Posture: ${postureWord}`}
          />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              Today&apos;s brief
            </div>
            <div className="text-[14px] font-bold tracking-tight" style={{ color: postureColor }}>
              {postureWord}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--dim)] text-right max-w-[160px] leading-3">
          {brief?.posture?.label ?? ""}
        </div>
      </div>

      {hottestZone && (
        <div className="mt-2 flex items-center justify-between gap-2 border border-[var(--line)] bg-[var(--bg-raised)] px-2.5 py-1.5">
          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
            Hottest zone today
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
            {hottestZone.zone}{" "}
            <span className="text-[var(--dim)]">
              · {hottestZone.count} {hottestZone.count === 1 ? "story" : "stories"}
            </span>
          </span>
        </div>
      )}

      {realityChecks.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <Scale size={11} className="text-[var(--cool)]" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--cool)]">
              Reality check · narrative vs measurement
            </span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {realityChecks.map((check) => (
              <RealityCheckRow key={check.topic} check={check} />
            ))}
          </div>
        </div>
      )}

      <BriefBlock
        title="Today's fires"
        accent="#ef4444"
        icon={<AlertCircle size={11} className="text-[#ef4444]" />}
        items={fires}
        emptyText="Quiet morning — ship a win while it lasts."
      />

      <BriefBlock
        title="Wins ready to announce"
        accent="#22c55e"
        icon={<Sparkles size={11} className="text-[#22c55e]" />}
        items={wins}
        emptyText="No deliverables booked today — set posture by 09:00."
      />

      <BriefBlock
        title="Tomorrow's risk"
        accent="#f59e0b"
        icon={<CloudLightning size={11} className="text-[#f59e0b]" />}
        items={risk ? [risk] : []}
        emptyText="24h forecast clean. Hold posture."
      />

      <RoadSafetyBenchmark />

      <div className="mt-3 border-t border-[var(--line)] pt-2">
        <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
          Province baseline
        </div>
        <div className="mt-0.5 font-mono text-[9px] leading-4 text-[var(--muted)]">
          {phuketSlugLine()}
        </div>
        <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
          Source: SLIC Smart City Thailand Index
        </div>
      </div>
    </section>
  );
}

function RoadSafetyBenchmark() {
  const accent = PHUKET_DEATH_RATE_MULTIPLE >= 3 ? "#ef4444" : "#f59e0b";
  const maxDistrict = PHUKET_DISTRICTS.reduce((m, d) => (d.deaths > m.deaths ? d : m));

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
            Road safety · THAIRSC
          </span>
        </div>
        <span className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">
          {THAIRSC_PERIOD}
        </span>
      </div>

      {/* Per-capita comparison */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {[
          { label: "Phuket", data: PHUKET_TOTALS, highlight: true },
          { label: "Bangkok", data: BANGKOK_TOTALS, highlight: false },
        ].map(({ label, data, highlight }) => (
          <div key={label} className="border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1.5">
            <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              {label} · pop {data.populationThousands}k
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono text-[22px] font-bold tabular-nums"
                style={{ color: highlight ? accent : "var(--ink)" }}
              >
                {data.deathsPer100k}
              </span>
              <span className="text-[7px] text-[var(--dim)] uppercase tracking-[0.12em]">
                deaths/100k
              </span>
            </div>
            <div className="font-mono text-[8px] text-[var(--muted)]">
              {data.deaths.toLocaleString()} dead · {data.injuries.toLocaleString()} hurt
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[9px] font-bold" style={{ color: accent }}>
        Phuket is <span className="font-mono">{PHUKET_DEATH_RATE_MULTIPLE.toFixed(1)}×</span> Bangkok&apos;s per-capita death rate.
      </p>

      {/* District breakdown */}
      <div className="mt-2">
        <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
          District breakdown
        </div>
        <div className="mt-1 space-y-1">
          {PHUKET_DISTRICTS.map((d) => {
            const isHot = d.district === maxDistrict.district;
            const barW = Math.round((d.deaths / maxDistrict.deaths) * 100);
            return (
              <div key={d.district} className="flex items-center gap-2">
                <div className="w-[78px] shrink-0">
                  <div className="text-[8px] font-semibold text-[var(--ink)] truncate">{d.district}</div>
                  <div className="text-[7px] text-[var(--dim)] truncate">{d.corridor}</div>
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <div className="h-3 flex-1 overflow-hidden bg-[var(--bg-raised)] border border-[var(--line)]">
                    <div
                      className="h-full"
                      style={{
                        width: `${barW}%`,
                        backgroundColor: isHot ? accent : "var(--cool)",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[9px] font-bold text-[var(--ink)] w-8 text-right">
                    {d.deaths}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key stats row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <div className="border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-2 py-1">
          <div className="font-mono text-[11px] font-bold text-[#ef4444]">{PHUKET_BY_VEHICLE.motorcycle}%</div>
          <div className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">Motorcycle</div>
        </div>
        <div className="border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-2 py-1">
          <div className="font-mono text-[11px] font-bold text-[#f59e0b]">{PHUKET_PEAK_HOURS}</div>
          <div className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">Peak window</div>
        </div>
      </div>

      {/* Evidence-based actions */}
      <div className="mt-2 space-y-1.5">
        {ROAD_SAFETY_ACTIONS.map((a, i) => (
          <div key={i} className="border-l-2 pl-2" style={{ borderLeftColor: accent }}>
            <div className="font-mono text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
              {a.stat}
            </div>
            <div className="text-[9px] leading-4 text-[var(--muted)]">{a.action}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">
        Source:{" "}
        <a href={THAIRSC_SOURCE_URL} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-[var(--ink)]">
          THAIRSC · thairsc.com
        </a>
      </div>
    </div>
  );
}

function BriefBlock({
  title,
  accent,
  icon,
  items,
  emptyText,
}: {
  title: string;
  accent: string;
  icon: ReactNode;
  items: BriefItem[];
  emptyText: string;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          className="text-[8px] font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {title}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
          {emptyText}
        </p>
      ) : (
        <ol className="mt-1.5 space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="border-l-2 pl-2"
              style={{ borderLeftColor: accent }}
            >
              <div className="text-[11px] font-bold leading-tight text-[var(--ink)]">
                <span className="mr-1 font-mono" style={{ color: accent }}>
                  {idx + 1}.
                </span>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
              </div>
              <div className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">
                {item.why}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.14em] text-[var(--dim)]">
                <span className="min-w-0 truncate">
                  {item.source}
                  {formatRelativeAge(item.publishedAt) && (
                    <span className="ml-1.5 font-mono text-[var(--ink)]">
                      · {formatRelativeAge(item.publishedAt)}
                    </span>
                  )}
                </span>
                <ActionButton accent={accent} item={item} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function computeFires(
  brief: GovernorBrief | null,
  news: MultilingualNewsResponse | null,
  coralWatch?: CoralWatchData | null,
  marine?: MarineConditions | null,
): BriefItem[] {
  const items: BriefItem[] = [];

  // Coral bleaching alert — governor-level environmental emergency
  if (coralWatch?.isGovernorEvent) {
    items.push({
      id: "coral-bleaching",
      headline: `Reef Bleaching ${coralWatch.baaLabel} — DHW ${coralWatch.dhw}°C-weeks`,
      why: coralWatch.governorMessage + ` Sea temp ${coralWatch.sstMax.toFixed(1)}°C.`,
      source: "NOAA Coral Reef Watch · Andaman Sea",
      action: "Marine emergency plan",
      actionType: "intervene",
    });
  }

  // Red flag beach conditions (wave > 2m)
  if (marine?.beachFlag === "red") {
    items.push({
      id: "beach-red-flag",
      headline: `Red Flag: ${marine.beachFlagReason}`,
      why: `Swell ${marine.swellHeightM}m, period ${marine.wavePeriodSec}s. Drowning risk elevated.`,
      source: "Open-Meteo Marine · Patong",
      action: "Close beaches",
      actionType: "intervene",
    });
  }

  for (const concern of (brief?.topConcerns ?? []).filter(
    (c) => c.status === "intervene",
  )) {
    items.push({
      id: `concern-${concern.id}`,
      headline: truncate(`${concern.label}: ${concern.metricValue}`, 78),
      why: concern.whyNow || concern.summary,
      source: concern.sources?.[0] ?? "Governor brief",
      action: concern.action ? truncate(concern.action, 26) : "Intervene now",
      actionType: "intervene",
    });
  }

  if (news) {
    const allNews = [...news.th, ...news.en, ...news.zh];
    const alerts = allNews.filter((n) => n.severity === "alert");
    const seen = new Set(items.map((i) => i.headline.toLowerCase()));
    for (const alert of alerts) {
      if (items.length >= 6) break;
      const headline = truncate(alert.title, 78);
      const key = headline.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `news-${alert.id}`,
        headline,
        why: `${alert.zone}. Story breaking now in media.`,
        source: alert.source,
        href: alert.url,
        action: "Brief press",
        actionType: "brief_press",
        publishedAt: alert.publishedAt,
      });
    }
  }

  return items.slice(0, 3);
}

function isWinnableMetric(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.includes("data unavailable") || v === "--" || v === "—") return false;
  if (v === "0" || v === "0/0" || v === "0 / 0") return false;
  return true;
}

function computeWins(brief: GovernorBrief | null): BriefItem[] {
  const items: BriefItem[] = [];

  for (const concern of (brief?.topConcerns ?? []).filter(
    (c) => c.status === "stable" && isWinnableMetric(c.metricValue),
  )) {
    items.push({
      id: `win-${concern.id}`,
      headline: truncate(`${concern.label}: ${concern.metricValue}`, 78),
      why: concern.summary || "On target. Press-release-ready.",
      source: concern.sources?.[0] ?? "Governor brief",
      action: "Frame for media",
      actionType: "frame_media",
    });
    if (items.length >= 3) break;
  }

  if (items.length < 3 && brief?.nextActions) {
    for (const action of brief.nextActions) {
      if (items.length >= 3) break;
      items.push({
        id: `next-${items.length}-${action.slice(0, 12)}`,
        headline: truncate(action, 78),
        why: "Scheduled delivery. Visible win if executed today.",
        source: "Governor calendar",
        action: "Confirm delivery",
        actionType: "confirm_delivery",
      });
    }
  }

  return items.slice(0, 3);
}

function ActionButton({ accent, item }: { accent: string; item: BriefItem }) {
  const [copied, setCopied] = useState(false);
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(buildActionDraft(item));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — silent
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to copy a draft to clipboard"
      className="shrink-0 cursor-pointer font-bold uppercase tracking-[0.16em] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-1"
      style={{ color: accent }}
    >
      {copied ? "✓ Copied" : `${item.action} ↗`}
    </button>
  );
}

type Verdict =
  | "CONFIRMED"
  | "UNDERSTATED"
  | "OVERSTATED"
  | "CALM"
  | "INSUFFICIENT";

interface RealityCheck {
  topic: string;
  narrativeCount: number;
  topHeadline?: string;
  measuredLabel: string;
  measuredStatus: ExecutiveStatus;
  verdict: Verdict;
  blurb: string;
}

function verdictAccent(v: Verdict): string {
  if (v === "CONFIRMED") return "#ef4444";
  if (v === "UNDERSTATED") return "#a855f7";
  if (v === "OVERSTATED") return "#f59e0b";
  if (v === "CALM") return "#22c55e";
  return "var(--dim)";
}

function verdictBlurb(v: Verdict): string {
  if (v === "CONFIRMED") return "Public sees what we see — get ahead of it.";
  if (v === "UNDERSTATED") return "Sensors louder than the press — set the narrative.";
  if (v === "OVERSTATED") return "Press louder than sensors — calmly correct the record.";
  if (v === "CALM") return "Quiet on both sides — no action needed.";
  return "Insufficient signal — keep watching.";
}

function RealityCheckRow({ check }: { check: RealityCheck }) {
  const accent = verdictAccent(check.verdict);
  return (
    <div className="border-l-2 pl-2" style={{ borderLeftColor: accent }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
          {check.topic}
        </span>
        <span
          className="font-mono text-[8px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {check.verdict}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-[64px_1fr] gap-x-2 text-[9px] leading-4">
        <span className="font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
          Narrative
        </span>
        <span className="truncate text-[var(--muted)]">
          {check.narrativeCount} {check.narrativeCount === 1 ? "story" : "stories"}
          {check.topHeadline ? ` · "${truncate(check.topHeadline, 48)}"` : ""}
        </span>
        <span className="font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
          Measured
        </span>
        <span className="truncate text-[var(--muted)]">
          {check.measuredLabel} · {check.measuredStatus.toUpperCase()}
        </span>
      </div>
      <p
        className="mt-1 text-[9px] italic leading-4"
        style={{ color: accent }}
      >
        {check.blurb}
      </p>
    </div>
  );
}

interface TopicSpec {
  name: string;
  pattern: RegExp;
  measured(ops: OperationsDashboardResponse): {
    label: string;
    status: ExecutiveStatus;
  } | null;
}

const REALITY_TOPICS: TopicSpec[] = [
  {
    name: "Marine safety",
    pattern: /(marine|ferry|boat|drown|wave|jellyfish|sea\b|ทะเล|เรือ|จม)/i,
    measured: (ops) =>
      ops.marineConstraint
        ? {
            label: ops.marineConstraint.label,
            status: ops.marineConstraint.status,
          }
        : null,
  },
  {
    name: "Weather posture",
    pattern: /(storm|rain|flood|thunder|monsoon|พายุ|ฝน|น้ำท่วม)/i,
    measured: (ops) =>
      ops.weatherConstraint
        ? {
            label: ops.weatherConstraint.condition || "Weather",
            status: ops.weatherConstraint.status,
          }
        : null,
  },
  {
    name: "Tourism flow",
    pattern:
      /(tourist|hotel|overstay|scam|visitor|airport|นักท่องเที่ยว|โรงแรม|หลอก)/i,
    measured: (ops) =>
      ops.airportDemand
        ? {
            label: "Airport demand",
            status: ops.airportDemand.status,
          }
        : null,
  },
];

function computeRealityChecks(
  news: MultilingualNewsResponse | null,
  operations: OperationsDashboardResponse | null,
): RealityCheck[] {
  if (!operations) return [];
  const allNews = news ? [...news.th, ...news.en, ...news.zh] : [];

  return REALITY_TOPICS.flatMap((topic) => {
    const measured = topic.measured(operations);
    if (!measured) return [];
    const matched = allNews.filter((n) =>
      topic.pattern.test(`${n.title ?? ""} ${n.summary ?? ""}`),
    );
    const negativeCount = matched.filter(
      (n) => n.severity === "alert" || n.severity === "watch",
    ).length;
    const top =
      matched.find((n) => n.severity === "alert") ??
      matched.find((n) => n.severity === "watch") ??
      matched[0];

    let verdict: Verdict;
    if (matched.length === 0 && measured.status === "stable") {
      verdict = "CALM";
    } else if (negativeCount >= 2 && measured.status !== "stable") {
      verdict = "CONFIRMED";
    } else if (negativeCount < 2 && measured.status !== "stable") {
      verdict = "UNDERSTATED";
    } else if (negativeCount >= 3 && measured.status === "stable") {
      verdict = "OVERSTATED";
    } else {
      verdict = "INSUFFICIENT";
    }

    return [
      {
        topic: topic.name,
        narrativeCount: matched.length,
        topHeadline: top?.title,
        measuredLabel: measured.label,
        measuredStatus: measured.status,
        verdict,
        blurb: verdictBlurb(verdict),
      },
    ];
  });
}

function computeHottestZone(
  news: MultilingualNewsResponse | null,
): { zone: string; count: number } | null {
  if (!news) return null;
  const all = [...news.th, ...news.en, ...news.zh];
  if (all.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of all) {
    if (!item.zone) continue;
    if (item.severity === "stable") continue;
    counts.set(item.zone, (counts.get(item.zone) ?? 0) + 1);
  }
  let top: { zone: string; count: number } | null = null;
  for (const [zone, count] of counts) {
    if (!top || count > top.count) top = { zone, count };
  }
  return top && top.count >= 2 ? top : null;
}

function computeRisk(
  operations: OperationsDashboardResponse | null,
  marine?: MarineConditions | null,
): BriefItem | null {
  // Wave forecast — if yellow today, flag as tomorrow's risk
  if (marine?.beachFlag === "yellow") {
    const peakWave = Math.max(...marine.forecastHourly.slice(0, 24).map((h) => h.waveHeight));
    if (peakWave > 1.5) {
      return {
        id: "risk-marine-swell",
        headline: `Swell building — peak ${peakWave.toFixed(1)}m in next 24h`,
        why: `Current ${marine.waveHeightM}m waves, ${marine.wavePeriodSec}s period. Pre-position lifeguard teams.`,
        source: "Open-Meteo Marine · Andaman forecast",
        action: "Pre-position teams",
        actionType: "pre_position",
      };
    }
  }
  if (!operations) return null;
  const weather = operations.weatherConstraint;
  if (weather && weather.status !== "stable") {
    return {
      id: "risk-weather",
      headline: weather.condition || "Weather watch",
      why: weather.summary,
      source: "Open-Meteo / TMD",
      action: "Pre-position teams",
      actionType: "pre_position",
    };
  }
  const marineConstraint = operations.marineConstraint;
  if (marineConstraint && marineConstraint.status !== "stable") {
    return {
      id: "risk-marine",
      headline: marineConstraint.label,
      why: marineConstraint.summary,
      source: marineConstraint.sourceSummary?.label ?? "Marine forecast",
      action: "Pre-position teams",
      actionType: "pre_position",
    };
  }
  if (weather) {
    return {
      id: "risk-weather-stable",
      headline: weather.condition || "Conditions normal",
      why: weather.summary,
      source: "Open-Meteo / TMD",
      action: "Hold posture",
      actionType: "hold_posture",
    };
  }
  return null;
}

"use client";

import { findCorridorById } from "../../lib/governor-config";
import type {
  CityVibesResponse,
  ExecutiveStatus,
  MediaWatchResponse,
} from "../../types/dashboard";

interface TrendingKeywordsProps {
  cityVibes: CityVibesResponse | null;
  mediaWatch: MediaWatchResponse | null;
  selectedCorridorId: string;
}

function statusTone(status: ExecutiveStatus) {
  if (status === "intervene") return "text-[#ef4444]";
  if (status === "watch") return "text-[#f59e0b]";
  return "text-[var(--cool)]";
}

export default function TrendingKeywords({
  cityVibes,
  mediaWatch,
  selectedCorridorId,
}: TrendingKeywordsProps) {
  const corridor = findCorridorById(selectedCorridorId);
  const vibeCards = cityVibes?.zones ?? [];
  const corridorVibes = corridor
    ? vibeCards.filter(
        (zone) =>
          corridor.focusAreas.some((focusArea) =>
            `${zone.label} ${zone.summary}`.toLowerCase().includes(focusArea.toLowerCase()),
          ) ||
          corridor.aliases.some((alias) =>
            `${zone.label} ${zone.summary} ${zone.whyNow}`.toLowerCase().includes(alias.toLowerCase()),
          ),
      )
    : [];
  const featuredVibes = corridorVibes.length > 0 ? corridorVibes : vibeCards.slice(0, 3);
  const narrativeItems = mediaWatch
    ? [...mediaWatch.peopleTalkAbout, ...mediaWatch.peopleShare].slice(0, 4)
    : [];

  if (!cityVibes || !mediaWatch) {
    return (
      <div className="flex h-full items-center px-5">
        <span className="eyebrow">Scanning island mood...</span>
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-4 select-none overflow-hidden">
      <div className="flex items-center justify-between pb-2">
        <div>
          <div className="eyebrow">Public mood</div>
          <h3 className="pt-0.5 text-[13px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {corridor?.label ?? "Island-wide"} vibe cards
          </h3>
        </div>
        <span className="live-badge">LIVE</span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="space-y-2 overflow-y-auto pr-1">
          {featuredVibes.map((zone) => (
            <article key={zone.id} className="border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                  {zone.label}
                </div>
                <span className={`text-[9px] font-mono font-bold ${statusTone(zone.status)}`}>
                  {zone.pulseIndex ?? "n/a"}
                </span>
              </div>
              <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                {zone.summary}
              </p>
              <div className="pt-2 grid grid-cols-2 gap-1 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                <span>Camera {zone.cameraCoveragePct ?? "--"}%</span>
                <span>{zone.narrativeSignals24h} narrative / 24h</span>
                <span>{zone.weatherExposure}</span>
                <span>{zone.mobilityLoad}</span>
              </div>
              <div className="pt-1 text-[8px] leading-4 text-[var(--dim)]">
                {zone.pulseIndex !== null && zone.pulseIndex !== undefined
                  ? zone.pulseFormula ??
                    "Pulse index = weighted mean of fresh camera, narrative, mobility, weather, and incident inputs."
                  : "Data unavailable. Index withheld until fresh source-backed inputs are available."}
              </div>
              <div className="pt-1 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                {zone.freshness.isFresh
                  ? `Observed ${zone.freshness.observedAt?.slice(11, 16) ?? "recently"}`
                  : "Freshness over 24h or source unavailable"}
              </div>
            </article>
          ))}
        </div>

        <div className="overflow-y-auto border border-[var(--line)] bg-[var(--bg)]">
          <div className="border-b border-[var(--line)] px-3 py-2">
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              What people talk about
            </div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {narrativeItems.map((item) => (
              <div key={item.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold text-[var(--ink)]">{item.title}</div>
                  <span className={`text-[8px] uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
                    {item.kind}
                  </span>
                </div>
                <div className="pt-1 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                  {item.zone} / {item.volumeLabel}
                </div>
                <p className="pt-1 text-[9px] leading-4 text-[var(--muted)]">
                  {item.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

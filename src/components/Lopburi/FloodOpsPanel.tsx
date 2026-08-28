"use client";

// Right bar of the Lopburi war room — FloodDash operations desk.
// Same slot as the Phuket operations panel: basin KPIs, Pa Sak dam
// storage gauge, station list ranked by bank capacity, advisories.

import { Droplets, TrendingDown, TrendingUp, Minus, Waves } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import { SkeletonOpsPanel } from "../Skeleton";
import type {
  LopburiFloodResponse,
  LopburiFloodStation,
  FloodStationStatus,
} from "../../types/lopburi";

const STATUS_COLOR: Record<FloodStationStatus, string> = {
  normal: "#22c55e",
  watch: "#f59e0b",
  warning: "#f97316",
  critical: "#ef4444",
};

function TrendIcon({ trend, size }: { trend: LopburiFloodStation["trend"]; size: number }) {
  if (trend === "rising") return <TrendingUp size={size} className="text-[#ef4444]" />;
  if (trend === "falling") return <TrendingDown size={size} className="text-[#22c55e]" />;
  return <Minus size={size} className="text-[var(--dim)]" />;
}

function CapacityBar({ pct, status }: { pct: number; status: FloodStationStatus }) {
  return (
    <div className="h-1 w-full border border-[var(--line)] bg-transparent">
      <div
        className="h-full"
        style={{ width: `${Math.min(100, pct)}%`, background: STATUS_COLOR[status] }}
      />
    </div>
  );
}

function StationRow({ station, is4K }: { station: LopburiFloodStation; is4K: boolean }) {
  const isRainGauge = station.bankLevelMsl === 0;
  return (
    <div className="border-l-2 px-3 py-2" style={{ borderLeftColor: STATUS_COLOR[station.status] }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`truncate font-semibold text-[var(--ink)] ${is4K ? "text-[14px]" : "text-[10px]"}`} lang="th">
            {station.name}
          </div>
          <div className={`mt-0.5 flex flex-wrap items-center gap-2 uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>
            <span>{station.district}</span>
            {station.river && <span>{station.river}</span>}
            <span className="font-mono">{station.agency}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TrendIcon trend={station.trend} size={is4K ? 16 : 11} />
          <span
            className={`border px-1 py-px font-bold uppercase tracking-[0.1em] ${is4K ? "text-[9px]" : "text-[7px]"}`}
            style={{ color: STATUS_COLOR[station.status], borderColor: STATUS_COLOR[station.status] }}
          >
            {station.status}
          </span>
        </div>
      </div>
      <div className={`mt-1.5 grid grid-cols-3 gap-2 font-mono text-[var(--muted)] ${is4K ? "text-[11px]" : "text-[8px]"}`}>
        <span>
          {isRainGauge ? "RAIN" : "WL"}{" "}
          <span className="text-[var(--ink)]">
            {isRainGauge ? `${station.rainfall24h}mm` : `${station.waterLevelMsl}m`}
          </span>
        </span>
        <span>
          {isRainGauge ? "24H" : "BANK"}{" "}
          <span className="text-[var(--ink)]">
            {isRainGauge ? "gauge" : `${station.bankLevelMsl}m`}
          </span>
        </span>
        <span>
          CAP <span className="text-[var(--ink)]">{station.capacityPct}%</span>
        </span>
      </div>
      <div className="mt-1">
        <CapacityBar pct={station.capacityPct} status={station.status} />
      </div>
    </div>
  );
}

export default function FloodOpsPanel({ data }: { data: LopburiFloodResponse | null }) {
  const is4K = useWarRoomScale();

  if (!data) {
    return (
      <div className="h-full border-l border-[var(--line)] bg-[var(--bg-surface)]">
        <SkeletonOpsPanel />
      </div>
    );
  }

  const { summary, dam, stations } = data;
  const postureColor =
    summary.basinPosture === "severe"
      ? "#ef4444"
      : summary.basinPosture === "elevated"
        ? "#f59e0b"
        : "#22c55e";

  const advisories = stations
    .filter((s) => s.status === "warning" || s.status === "critical")
    .slice(0, 4);

  return (
    <aside className="flex h-full w-full flex-col border-l border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves size={is4K ? 18 : 13} className="text-[var(--cool)]" />
            <div>
              <div className={`${is4K ? "text-[11px]" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-[var(--dim)]`}>
                Pa Sak / Lopburi basin
              </div>
              <div className={`${is4K ? "text-[18px]" : "text-[13px]"} font-bold tracking-[-0.02em]`}>FloodDash</div>
            </div>
          </div>
          <span className="live-badge">
            {data.source === "live" ? "LIVE" : data.source === "scenario" ? "SCENARIO" : "MODEL"}
          </span>
        </div>

        {/* KPI row */}
        <div className={`mt-2 grid grid-cols-4 divide-x divide-[var(--line)] border border-[var(--line)] text-center font-mono ${is4K ? "text-[12px]" : "text-[9px]"}`}>
          <div className="px-1 py-1.5">
            <div className="text-[var(--ink)] font-bold">{summary.stationsReporting}</div>
            <div className={`uppercase tracking-wider text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>stations</div>
          </div>
          <div className="px-1 py-1.5">
            <div className="font-bold" style={{ color: summary.stationsWarning > 0 ? "#ef4444" : "var(--ink)" }}>
              {summary.stationsWarning}
            </div>
            <div className={`uppercase tracking-wider text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>warn+</div>
          </div>
          <div className="px-1 py-1.5">
            <div className="text-[var(--ink)] font-bold">{summary.maxRainfall24h}</div>
            <div className={`uppercase tracking-wider text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>max mm/24h</div>
          </div>
          <div className="px-1 py-1.5">
            <div className="font-bold" style={{ color: postureColor }}>
              {summary.basinPosture.toUpperCase()}
            </div>
            <div className={`uppercase tracking-wider text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>posture</div>
          </div>
        </div>

        <p className={`mt-2 leading-4 text-[var(--muted)] ${is4K ? "text-[13px] leading-5" : "text-[9px]"}`}>
          {summary.headline}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {/* Pa Sak Jolasid dam card */}
        <div className="border-b border-[var(--line)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[11px]" : "text-[8px]"}`}>
              <Droplets size={is4K ? 14 : 10} className="text-[var(--cool)]" />
              {dam.name}
            </div>
            {dam.spillwayOpen && (
              <span className={`border border-[#ef4444] px-1 py-px font-bold uppercase tracking-[0.1em] text-[#ef4444] ${is4K ? "text-[9px]" : "text-[7px]"}`}>
                elevated release
              </span>
            )}
          </div>
          <div className={`mt-2 flex items-baseline gap-2 font-mono ${is4K ? "text-[24px]" : "text-[18px]"}`}>
            <span className="font-bold text-[var(--ink)]">{dam.storagePct}%</span>
            <span className={`text-[var(--dim)] ${is4K ? "text-[12px]" : "text-[9px]"}`}>
              {dam.storageMcm} / {dam.capacityMcm} MCM
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full border border-[var(--line)]">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, dam.storagePct)}%`,
                background: dam.storagePct >= 90 ? "#ef4444" : dam.storagePct >= 80 ? "#f59e0b" : "var(--cool)",
              }}
            />
          </div>
          <div className={`mt-1.5 grid grid-cols-2 gap-2 font-mono text-[var(--muted)] ${is4K ? "text-[11px]" : "text-[8px]"}`}>
            <span>
              INFLOW <span className="text-[var(--ink)]">{dam.inflowMcm} MCM/d</span>
            </span>
            <span>
              RELEASE <span className="text-[var(--ink)]">{dam.releaseMcm} MCM/d</span>
            </span>
          </div>
          <p className={`mt-1.5 leading-4 text-[var(--muted)] ${is4K ? "text-[12px] leading-5" : "text-[8px]"}`}>
            {dam.downstreamNote}
          </p>
        </div>

        {/* Advisories */}
        {advisories.length > 0 && (
          <div className="border-b border-[var(--line)] px-3 py-2.5">
            <div className={`font-bold uppercase tracking-[0.14em] text-[#ef4444] ${is4K ? "text-[11px]" : "text-[8px]"}`}>
              Active advisories
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {advisories.map((s) => (
                <li key={`adv-${s.id}`} className={`leading-4 text-[var(--muted)] ${is4K ? "text-[12px] leading-5" : "text-[8px]"}`}>
                  <span className="font-semibold text-[var(--ink)]" lang="th">
                    {s.district}:
                  </span>{" "}
                  {s.advice}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Station list */}
        <div className="px-3 pt-2">
          <div className={`font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[11px]" : "text-[8px]"}`}>
            Telemetry stations — by bank capacity
          </div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {stations.slice(0, is4K ? 24 : 14).map((s) => (
            <StationRow key={s.id} station={s} is4K={is4K} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5">
        <div className={`uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>
          {data.attribution}
        </div>
      </div>
    </aside>
  );
}

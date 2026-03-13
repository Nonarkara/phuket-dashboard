"use client";

import { useEffect, useState } from "react";
import type {
  ConvergenceAlert,
  ConvergencePosture,
  CorridorConvergenceResponse,
} from "../../types/dashboard";

function isCorridorConvergenceResponse(
  value: unknown,
): value is CorridorConvergenceResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "corridor" in value &&
    "alerts" in value &&
    Array.isArray((value as { alerts?: unknown[] }).alerts)
  );
}

function postureClasses(posture: ConvergencePosture) {
  if (posture === "priority") return "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";
  if (posture === "watch") return "bg-[var(--line-bright)] text-[var(--cool)]";
  return "bg-[rgba(100,116,139,0.14)] text-[var(--muted)]";
}

function postureLabel(posture: ConvergencePosture) {
  if (posture === "priority") return "priority";
  if (posture === "watch") return "elevated";
  return "baseline";
}

function formatObservedAt(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "--";
  return timestamp.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CompactAlertCard({ alert }: { alert: ConvergenceAlert }) {
  return (
    <article className="border border-[var(--line)] p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] ${postureClasses(alert.posture)}`}>
            {postureLabel(alert.posture)}
          </span>
          <span className="text-[7px] font-mono text-[var(--dim)]">{alert.windowHours}h</span>
        </div>
        <span className="text-[11px] font-mono font-bold tabular-nums text-[var(--ink)]">{alert.score}</span>
      </div>
      <h4 className="pt-1 text-[10px] font-bold tracking-[-0.01em] text-[var(--ink)]">{alert.title}</h4>
      <p className="pt-0.5 text-[8px] leading-3 text-[var(--muted)]">{alert.summary}</p>
      <div className="pt-1 flex flex-wrap gap-1">
        {alert.families.map((family) => (
          <span key={family} className="bg-[var(--line)] px-1.5 py-0.5 text-[7px] capitalize text-[var(--muted)]">
            {family}
          </span>
        ))}
      </div>
      {alert.evidence.slice(0, 1).map((item) => (
        <div key={item.id} className="mt-1 border-l-2 border-[var(--line-bright)] pl-2">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--cool)]">{item.family}</span>
            <span className="text-[7px] font-mono text-[var(--dim)]">{formatObservedAt(item.observedAt)}</span>
          </div>
          <div className="pt-0.5 text-[8px] font-medium text-[var(--ink)]">{item.title}</div>
        </div>
      ))}
    </article>
  );
}

export default function ConvergenceAlerts() {
  const [payload, setPayload] = useState<CorridorConvergenceResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/intelligence/convergence");
        const nextPayload: unknown = await response.json();
        if (isCorridorConvergenceResponse(nextPayload)) setPayload(nextPayload);
      } catch {
        setPayload(null);
      }
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!payload) {
    return <div className="text-[9px] text-[var(--muted)]">Loading Andaman signals...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Area summary */}
      <div className="border border-[var(--line)] p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[7px] font-mono uppercase tracking-[0.14em] text-[var(--dim)]">{payload.corridor.label}</div>
            <div className="pt-0.5 text-[11px] font-bold text-[var(--ink)]">Area pressure</div>
          </div>
          <div className="text-right">
            <span className={`inline-flex px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] ${postureClasses(payload.posture)}`}>
              {postureLabel(payload.posture)}
            </span>
            <div className="pt-0.5 text-[14px] font-mono font-bold tabular-nums text-[var(--ink)]">{payload.score}</div>
          </div>
        </div>
        <p className="pt-1 text-[8px] leading-3 text-[var(--muted)]">{payload.summary}</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {[
            { label: "Live", value: payload.sourceCoverage.live, tone: "text-[#22c55e]" },
            { label: "Stale", value: payload.sourceCoverage.stale, tone: "text-[#f59e0b]" },
            { label: "Off", value: payload.sourceCoverage.offline, tone: "text-[#ef4444]" },
            { label: "All", value: payload.sourceCoverage.total, tone: "text-[var(--ink)]" },
          ].map((stat) => (
            <div key={stat.label} className="border border-[var(--line)] px-1 py-1 text-center">
              <div className="text-[6px] font-bold uppercase tracking-[0.12em] text-[var(--dim)]">{stat.label}</div>
              <div className={`text-[10px] font-mono font-bold ${stat.tone}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert cards */}
      {payload.alerts.map((alert) => (
        <CompactAlertCard key={alert.id} alert={alert} />
      ))}

      {payload.dataGaps.length > 0 && (
        <div className="border-l-2 border-[#f59e0b] pl-2">
          <div className="text-[7px] font-bold uppercase tracking-[0.14em] text-[#f59e0b]">Coverage gap</div>
          <div className="pt-0.5 text-[8px] leading-3 text-[var(--muted)]">{payload.dataGaps[0]}</div>
        </div>
      )}
    </div>
  );
}

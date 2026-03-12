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
  if (posture === "priority") {
    return "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";
  }

  if (posture === "watch") {
    return "bg-[var(--line-bright)] text-[var(--cool)]";
  }

  return "bg-[rgba(100,116,139,0.14)] text-[var(--muted)]";
}

function postureLabel(posture: ConvergencePosture) {
  if (posture === "priority") {
    return "priority";
  }

  if (posture === "watch") {
    return "elevated";
  }

  return "baseline";
}

function formatObservedAt(value: string) {
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

function AlertCard({ alert }: { alert: ConvergenceAlert }) {
  return (
    <article className="border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${postureClasses(alert.posture)}`}
          >
            {postureLabel(alert.posture)}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-[var(--dim)]">
            {alert.windowHours}h
          </span>
        </div>
        <span className="text-[13px] font-mono font-bold tabular-nums text-[var(--ink)]">
          {alert.score}
        </span>
      </div>

      <h4 className="pt-2 text-[14px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {alert.title}
      </h4>
      <p className="pt-1 text-[11px] leading-5 text-[var(--muted)]">{alert.summary}</p>

      <div className="pt-2 flex flex-wrap gap-1.5">
        {alert.families.map((family) => (
          <span
            key={family}
            className="rounded-full bg-[var(--line)] px-2 py-0.5 text-[9px] capitalize text-[var(--muted)]"
          >
            {family}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {alert.evidence.slice(0, 2).map((item) => (
          <div
            key={item.id}
            className="border-l border-[var(--line-bright)] pl-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--cool)]">
                {item.family}
              </span>
              <span className="text-[9px] font-mono text-[var(--dim)]">
                {formatObservedAt(item.observedAt)}
              </span>
            </div>
            <div className="pt-1 text-[11px] font-medium text-[var(--ink)]">
              {item.title}
            </div>
            <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
              {item.source}
            </div>
          </div>
        ))}
      </div>

      {alert.dataGaps.length > 0 ? (
        <div className="mt-3 border-l border-[#f59e0b] pl-3">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#f59e0b]">
            Data gap
          </div>
          <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
            {alert.dataGaps[0]}
          </div>
        </div>
      ) : null}
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

        if (isCorridorConvergenceResponse(nextPayload)) {
          setPayload(nextPayload);
        }
      } catch {
        setPayload(null);
      }
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!payload) {
    return (
      <div className="border border-[var(--line)] p-3 text-[11px] leading-5 text-[var(--muted)]">
        Andaman area signals are loading.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-[var(--line)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--dim)]">
              {payload.corridor.label}
            </div>
            <div className="pt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              Area pressure
            </div>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${postureClasses(payload.posture)}`}
            >
              {postureLabel(payload.posture)}
            </span>
            <div className="pt-1 text-[18px] font-mono font-bold tabular-nums text-[var(--ink)]">
              {payload.score}
            </div>
          </div>
        </div>

        <p className="pt-3 text-[11px] leading-5 text-[var(--muted)]">
          {payload.summary}
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "Live", value: payload.sourceCoverage.live, tone: "text-[#22c55e]" },
            { label: "Stale", value: payload.sourceCoverage.stale, tone: "text-[#f59e0b]" },
            { label: "Offline", value: payload.sourceCoverage.offline, tone: "text-[#ef4444]" },
            { label: "Total", value: payload.sourceCoverage.total, tone: "text-[var(--ink)]" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-[var(--line)] px-2 py-2 text-center"
            >
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">
                {stat.label}
              </div>
              <div className={`pt-1 text-[14px] font-mono font-bold ${stat.tone}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {payload.alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}

      {payload.dataGaps.length > 0 ? (
        <div className="border border-[var(--line)] p-3">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
            Coverage notes
          </div>
          <div className="pt-2 space-y-2">
            {payload.dataGaps.slice(0, 2).map((gap) => (
              <div key={gap} className="text-[10px] leading-4 text-[var(--muted)]">
                {gap}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

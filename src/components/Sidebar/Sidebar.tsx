"use client";

import type { ExecutiveStatus, GovernorBrief } from "../../types/dashboard";

interface SidebarProps {
  brief: GovernorBrief | null;
}

function statusClasses(status: ExecutiveStatus) {
  if (status === "intervene") {
    return "border-[#ef4444] bg-[rgba(239,68,68,0.08)] text-[#ef4444]";
  }

  if (status === "watch") {
    return "border-[#f59e0b] bg-[rgba(245,158,11,0.08)] text-[#f59e0b]";
  }

  return "border-[var(--line)] bg-[rgba(15,111,136,0.05)] text-[var(--cool)]";
}

export default function Sidebar({ brief }: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col text-[var(--ink)] select-none">
      <div className="border-b border-[var(--line)] px-3 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Governor path</div>
            <h1 className="pt-1 text-[16px] font-bold tracking-[-0.03em] text-[var(--ink)]">
              Clear It Up Today
            </h1>
          </div>
          <div className="live-badge">LIVE</div>
        </div>
        <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
          Lead with island posture, then clear access, piers, public messaging, and
          tourism coordination before noise becomes disruption.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <section className="border-b border-[var(--line)] px-3 py-3">
          <div className="eyebrow mb-2 opacity-50">Governor concerns</div>
          <div className="space-y-2">
            {(brief?.topConcerns ?? []).map((concern) => (
              <article key={concern.id} className="border border-[var(--line)] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                      {concern.label}
                    </div>
                    <div className="pt-1 text-[13px] font-mono font-bold tracking-[-0.03em] text-[var(--ink)]">
                      {concern.metricValue}
                    </div>
                    <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                      {concern.metricLabel}
                    </div>
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${statusClasses(
                      concern.status,
                    )}`}
                  >
                    {concern.status}
                  </span>
                </div>
                <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                  {concern.whyNow}
                </p>
              </article>
            ))}

            {!brief ? (
              <div className="border border-[var(--line)] px-3 py-3 text-[10px] text-[var(--muted)]">
                Loading governor concern stack...
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-b border-[var(--line)] px-3 py-3">
          <div className="eyebrow mb-2 opacity-50">Intervention queue</div>
          <div className="space-y-2">
            {(brief?.nextActions ?? []).map((action, index) => (
              <div key={action} className="border border-[var(--line)] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-[var(--dim)]">
                  Action {String(index + 1).padStart(2, "0")}
                </div>
                <p className="pt-1 text-[11px] leading-5 text-[var(--ink)]">{action}</p>
              </div>
            ))}

            {!brief?.nextActions.length ? (
              <div className="border border-[var(--line)] px-3 py-3 text-[10px] text-[var(--muted)]">
                Intervention queue is building from marine, access, and narrative feeds.
              </div>
            ) : null}
          </div>
        </section>

        <section className="px-3 py-3">
          <div className="eyebrow mb-2 opacity-50">Why this view</div>
          <div className="space-y-2 text-[10px] leading-4 text-[var(--muted)]">
            <p className="border border-[var(--line)] px-3 py-2">
              `20 seconds`: island posture from six concern tiles.
            </p>
            <p className="border border-[var(--line)] px-3 py-2">
              `2 minutes`: corridor cards show where to watch, intervene, or stay calm.
            </p>
            <p className="border border-[var(--line)] px-3 py-2">
              `10 minutes`: bottom dossier combines cameras, TV, marine numbers, and public mood.
            </p>
          </div>
        </section>
      </div>
    </aside>
  );
}

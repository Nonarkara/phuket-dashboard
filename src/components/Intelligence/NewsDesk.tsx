"use client";

import type { ExecutiveStatus, GovernorBrief, MediaWatchResponse } from "../../types/dashboard";

interface NewsDeskProps {
  mediaWatch: MediaWatchResponse | null;
  brief: GovernorBrief | null;
}

function statusClasses(status: ExecutiveStatus) {
  if (status === "intervene") {
    return "bg-[rgba(239,68,68,0.15)] text-[#ef4444]";
  }

  if (status === "watch") {
    return "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]";
  }

  return "bg-[var(--line-bright)] text-[var(--cool)]";
}

export default function NewsDesk({ mediaWatch, brief }: NewsDeskProps) {
  const narrativeItems = mediaWatch
    ? [
        ...mediaWatch.peopleTalkAbout.slice(0, 2),
        ...mediaWatch.peopleShare.slice(0, 2),
        ...mediaWatch.broadcastWatch.slice(0, 1),
      ]
    : [];

  if (!mediaWatch) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
        <span className="eyebrow">Loading narrative watch</span>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-4 overflow-y-auto">
      <div className="border-b border-[var(--line)] pb-3">
        <div className="eyebrow">10-minute read</div>
        <div className="pt-1 text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Public narrative and recommended line
        </div>
        <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
          {mediaWatch.postureSummary}
        </p>
      </div>

      <div className="pt-3 border-b border-[var(--line)] pb-3">
        <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
          What the governor should do next
        </div>
        <div className="mt-2 space-y-2">
          {(brief?.nextActions ?? []).slice(0, 3).map((action) => (
            <div key={action} className="border border-[var(--line)] px-3 py-2 text-[11px] leading-5 text-[var(--ink)]">
              {action}
            </div>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[var(--line)] overflow-y-auto pt-2">
        {narrativeItems.map((item) => (
          <article key={item.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] ${statusClasses(
                    item.status,
                  )}`}
                >
                  {item.kind}
                </span>
                <span className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                  {item.zone}
                </span>
              </div>
              <span className="text-[9px] font-mono tabular-nums text-[var(--dim)]">
                {item.volumeLabel}
              </span>
            </div>
            <h3 className="pt-2 text-[13px] font-semibold leading-5 text-[var(--ink)]">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--cool)] hover:underline underline-offset-2"
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h3>
            <p className="pt-1 text-[11px] leading-5 text-[var(--muted)]">
              {item.summary}
            </p>
            <div className="pt-2 text-[9px] uppercase tracking-[0.16em] text-[var(--dim)]">
              {item.source}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

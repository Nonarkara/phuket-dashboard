"use client";

import type {
  ExecutiveStatus,
  GovernorBrief,
  GovernorCorridorPriority,
} from "../../types/dashboard";

interface BriefingPanelProps {
  brief: GovernorBrief | null;
  selectedCorridorId: string;
  onSelectCorridor: (corridorId: string) => void;
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

function CorridorCard({
  corridor,
  active,
  onSelect,
}: {
  corridor: GovernorCorridorPriority;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border px-3 py-3 text-left transition-colors ${
        active
          ? "border-[var(--ink)] bg-[rgba(17,17,17,0.04)]"
          : "border-[var(--line)] hover:border-[var(--line-bright)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {corridor.label}
          </div>
          <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
            {corridor.summary}
          </p>
        </div>
        <span
          className={`border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${statusClasses(
            corridor.status,
          )}`}
        >
          {corridor.status}
        </span>
      </div>

      <p className="pt-2 text-[10px] leading-4 text-[var(--ink)]">{corridor.whyNow}</p>

      <div className="pt-2 flex flex-wrap gap-1">
        {corridor.reasonTags.map((tag) => (
          <span
            key={tag}
            className="border border-[var(--line)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-[var(--dim)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function BriefingPanel({
  brief,
  selectedCorridorId,
  onSelectCorridor,
}: BriefingPanelProps) {
  if (!brief) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
        <span className="eyebrow">Loading corridor priorities</span>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-3 overflow-y-auto">
      <div className="border-b border-[var(--line)] pb-3">
        <div className="eyebrow">2-minute view</div>
        <h2 className="pt-1 text-[18px] font-bold tracking-[-0.03em] text-[var(--ink)]">
          Corridor cards
        </h2>
        <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
          Click a corridor to drive the bottom dossier and map focus.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {brief.corridorPriorities.map((corridor) => (
          <CorridorCard
            key={corridor.id}
            corridor={corridor}
            active={selectedCorridorId === corridor.id}
            onSelect={() => onSelectCorridor(corridor.id)}
          />
        ))}
      </div>
    </section>
  );
}

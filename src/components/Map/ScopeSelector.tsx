"use client";

/**
 * Scope selector — province → district → local government.
 *
 * A compact corner overlay, never a bar across the map (project CLAUDE.md rejects
 * full-width panels outright; the corridor selector was broken that way once and
 * fixed). Collapsed it is one pill showing the current scope; expanded it is a
 * grouped list of the 18 local governments.
 */
import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { DISTRICT_LABELS, DISTRICT_ORDER, type ScopeUnit } from "../../types/scope";

interface Props {
  scope: ScopeUnit;
  units: ScopeUnit[];
  onSelect: (id: string) => void;
  loaded: boolean;
}

export default function ScopeSelector({ scope, units, onSelect, loaded }: Props) {
  const [open, setOpen] = useState(false);

  const districts = units.filter((u) => u.kind === "district");
  const localGovs = units.filter((u) => u.kind === "localgov");
  const province = units.find((u) => u.kind === "province");

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const isActive = (id: string) => scope.id === id;

  return (
    /* Bottom-right: the operator info panel occupies the top of the map across ~660px
       and the legend holds bottom-left, so this is the only free corner. Column-reverse
       so the list opens upward instead of off the bottom edge. */
    /* z-50, not z-40: this is a control, and the project's documented scale puts
       controls above overlays. At z-40 the open list rendered behind the operator
       info panel. */
    <div className="pointer-events-none absolute bottom-3 right-3 z-50 flex w-[224px] flex-col-reverse items-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!loaded}
        aria-expanded={open}
        aria-label="Select administrative scope"
        className="pointer-events-auto flex min-h-[36px] w-full items-center justify-between gap-2 border border-[var(--line)] bg-[var(--bg-surface)]/90 px-2.5 py-1.5 text-left backdrop-blur-md transition-colors duration-150 ease-out hover:border-[var(--ink)] disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Layers size={11} className="shrink-0 text-[var(--cool)]" />
          <span className="min-w-0">
            <span className="block text-[7px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              {scope.kind === "province" ? "Province" : scope.kind === "district" ? "District" : scope.type}
            </span>
            <span className="block truncate text-[10px] font-semibold text-[var(--ink)]">
              {scope.nameEn}
            </span>
          </span>
        </span>
        <ChevronDown
          size={11}
          className="shrink-0 text-[var(--dim)] transition-transform duration-150 ease-out"
          style={{ transform: open ? "none" : "rotate(180deg)" }}
        />
      </button>

      {/* Precision caveat. Two units share a tambon with another local government,
          so the drawn polygon overstates them — say so rather than imply survey
          accuracy. */}
      {scope.boundaryPrecision === "shared-tambon" && (
        <div className="pointer-events-none mb-1 w-full border border-[#f59e0b]/40 bg-[var(--bg-surface)]/90 px-2 py-1 text-[7px] leading-[11px] tracking-wide text-[#7a3a00] backdrop-blur-md dark:text-[#f59e0b]">
          Boundary approximate — this tambon holds two local governments and no
          public polygon separates them.
        </div>
      )}

      {open && (
        <div className="pointer-events-auto mb-1 max-h-[52vh] w-full overflow-y-auto border border-[var(--line)] bg-[var(--bg-surface)]/95 backdrop-blur-md no-scrollbar">
          {province && (
            <button
              type="button"
              onClick={() => pick(province.id)}
              className={`flex min-h-[30px] w-full items-center px-2.5 py-1 text-left text-[10px] transition-colors duration-150 ease-out ${
                isActive(province.id)
                  ? "bg-[rgba(245,158,11,0.12)] font-semibold text-[var(--ink)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {province.nameEn}
            </button>
          )}

          {DISTRICT_ORDER.map((code) => {
            const district = districts.find((d) => d.id === code);
            const members = localGovs.filter((l) => l.districtCode === code);
            if (!district && !members.length) return null;
            return (
              <div key={code} className="border-t border-[var(--line)]">
                {district && (
                  <button
                    type="button"
                    onClick={() => pick(district.id)}
                    className={`flex min-h-[30px] w-full items-center justify-between px-2.5 py-1 text-left transition-colors duration-150 ease-out ${
                      isActive(district.id)
                        ? "bg-[rgba(245,158,11,0.12)] text-[var(--ink)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em]">
                      {DISTRICT_LABELS[code]?.en ?? district.nameEn}
                    </span>
                    <span className="font-mono text-[8px] text-[var(--dim)]">{members.length}</span>
                  </button>
                )}
                {members.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pick(u.id)}
                    title={u.nameTh}
                    className={`flex min-h-[30px] w-full items-center gap-1.5 py-1 pl-5 pr-2.5 text-left transition-colors duration-150 ease-out ${
                      isActive(u.id)
                        ? "bg-[rgba(245,158,11,0.12)] font-semibold text-[var(--ink)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span className="shrink-0 font-mono text-[7px] uppercase text-[var(--dim)]">
                      {u.type}
                    </span>
                    <span className="truncate text-[10px]">{u.nameEn}</span>
                    {u.boundaryPrecision === "shared-tambon" && (
                      <span className="ml-auto shrink-0 font-mono text-[7px] text-[#f59e0b]" title="Boundary approximate">
                        ~
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BookOpen, Database, Network } from "lucide-react";
import type { ExecutiveStatus, GovernorBrief } from "../../types/dashboard";

interface TopBarProps {
  brief: GovernorBrief | null;
  onOpenManual: () => void;
  onOpenArchitecture: () => void;
  onOpenDataExplorer: () => void;
}

function formatMainClock() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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

export default function TopBar({
  brief,
  onOpenManual,
  onOpenArchitecture,
  onOpenDataExplorer,
}: TopBarProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(formatMainClock());
    };

    tick();
    const clockInterval = setInterval(tick, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-4 py-2 backdrop-blur-xl sm:px-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0">
                <div className="eyebrow leading-none">Governor War Room</div>
                <div className="pt-1 text-[16px] font-bold tracking-tight text-[var(--ink)]">
                  Phuket Island Command Center
                </div>
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {brief?.posture.summary ??
                    "Loading island posture for Phuket, the Andaman ring, and the governor's priority corridors."}
                </p>
              </div>
              <div className="hidden h-10 w-[1px] bg-[var(--line)] sm:block" />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[22px] font-bold tracking-tighter text-[var(--ink)]">
                  {time || "--:--:--"}
                </span>
                <span className="text-[9px] font-mono text-[var(--dim)] uppercase tracking-wider">
                  HKT / LIVE
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 border border-[var(--line)] px-3 py-1.5">
                <span className="eyebrow !text-[8px]">Island posture</span>
                <span
                  className={`border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${statusClasses(
                    brief?.posture.level ?? "watch",
                  )}`}
                >
                  {brief?.posture.label ?? "Loading"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenArchitecture}
                  className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
                  title="APIs / Architecture"
                >
                  <Network size={16} />
                </button>
                <button
                  type="button"
                  onClick={onOpenDataExplorer}
                  className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
                  title="Data / Export"
                >
                  <Database size={16} />
                </button>
                <button
                  type="button"
                  onClick={onOpenManual}
                  className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
                  title="Help / Manual"
                >
                  <BookOpen size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {(brief?.topConcerns ?? Array.from({ length: 6 })).slice(0, 6).map((concern, index) => (
              <div
                key={typeof concern === "object" ? concern.id : `placeholder-${index}`}
                className="border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
              >
                {typeof concern === "object" ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
                        {concern.label}
                      </div>
                      <span
                        className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em] ${statusClasses(
                          concern.status,
                        )}`}
                      >
                        {concern.status}
                      </span>
                    </div>
                    <div className="pt-2 text-[18px] font-mono font-bold tracking-[-0.04em] text-[var(--ink)]">
                      {concern.metricValue}
                    </div>
                    <div className="pt-0.5 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                      {concern.metricLabel}
                    </div>
                    <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                      {concern.summary}
                    </p>
                  </>
                ) : (
                  <div className="h-[82px] animate-pulse bg-[rgba(17,17,17,0.04)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

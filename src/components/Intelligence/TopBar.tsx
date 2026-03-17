"use client";

import { useEffect, useState } from "react";
import { BookOpen, Database, Network } from "lucide-react";
import type {
  ExecutiveStatus,
  GovernorBrief,
} from "../../types/dashboard";

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

  const topConcerns = brief?.topConcerns ?? [];

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-4 py-1 backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title + posture */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">Phuket Dashboard v5.0</div>
            <div className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
              Governor War Room
            </div>
          </div>
          <div className="hidden h-8 w-[1px] bg-[var(--line)] sm:block" />
          <div className="hidden items-center gap-1.5 border border-[var(--line)] px-2 py-1 sm:flex">
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Posture</span>
            <span
              className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em] ${statusClasses(
                brief?.posture.level ?? "watch",
              )}`}
            >
              {brief?.posture.label ?? "Loading"}
            </span>
          </div>
        </div>

        {/* Center: Key metrics strip */}
        <div className="hidden items-center gap-3 lg:flex">
          {topConcerns.slice(0, 6).map((concern) => (
            <div key={concern.id} className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[var(--ink)]">{concern.metricValue}</span>
              <span className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">{concern.label}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  concern.status === "intervene"
                    ? "bg-[#ef4444]"
                    : concern.status === "watch"
                      ? "bg-[#f59e0b]"
                      : "bg-[var(--cool)]"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Right: Clock + utils */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[18px] font-bold tracking-tighter text-[var(--ink)]">
              {time || "--:--:--"}
            </span>
            <span className="text-[8px] font-mono text-[var(--dim)] uppercase tracking-wider">
              HKT
            </span>
          </div>
          <div className="hidden h-6 w-[1px] bg-[var(--line)] sm:block" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenArchitecture}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="APIs / Architecture"
            >
              <Network size={14} />
            </button>
            <button
              type="button"
              onClick={onOpenDataExplorer}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Data / Export"
            >
              <Database size={14} />
            </button>
            <button
              type="button"
              onClick={onOpenManual}
              className="p-1 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Help / Manual"
            >
              <BookOpen size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

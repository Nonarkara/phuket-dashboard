"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type {
  CityVibesResponse,
  ExecutiveStatus,
  GovernorBrief,
  MarineStatusResponse,
  MediaWatchResponse,
} from "../../types/dashboard";

interface SignalTickerProps {
  brief: GovernorBrief | null;
  marine: MarineStatusResponse | null;
  cityVibes: CityVibesResponse | null;
  mediaWatch: MediaWatchResponse | null;
}

function toneFromStatus(status: ExecutiveStatus) {
  if (status === "intervene") return "up";
  if (status === "watch") return "neutral";
  return "down";
}

export default function SignalTicker({
  brief,
  marine,
  cityVibes,
  mediaWatch,
}: SignalTickerProps) {
  const topMarine = marine?.corridors[0];
  const topVibe = cityVibes?.zones[0];
  const topMood = mediaWatch?.peopleTalkAbout[0] ?? mediaWatch?.peopleShare[0];

  const items = [
    {
      id: "posture",
      label: "Posture",
      value: brief?.posture.label ?? "Loading",
      delta: brief?.posture.level ?? "watch",
      tone: toneFromStatus(brief?.posture.level ?? "watch"),
    },
    {
      id: "marine",
      label: "Marine lead",
      value: topMarine?.label ?? "Patong coast",
      delta:
        topMarine?.waveHeightMeters !== null && topMarine?.waveHeightMeters !== undefined
          ? `${topMarine.waveHeightMeters.toFixed(1)}m`
          : "monitor",
      tone: toneFromStatus(topMarine?.status ?? "watch"),
    },
    {
      id: "city-vibe",
      label: "City vibe",
      value: topVibe?.label ?? "Patong",
      delta: topVibe ? `${topVibe.score}` : "pending",
      tone: toneFromStatus(topVibe?.status ?? "watch"),
    },
    {
      id: "mood",
      label: "Narrative",
      value: topMood?.zone ?? "Island-wide",
      delta: topMood?.kind ?? "watch",
      tone: toneFromStatus(topMood?.status ?? "watch"),
    },
  ];

  return (
    <section className="grid h-[38px] grid-cols-2 bg-[var(--bg-surface)] lg:grid-cols-4">
      {items.map((item) => {
        const toneClass =
          item.tone === "up"
            ? "text-[#f59e0b]"
            : item.tone === "down"
              ? "text-[var(--cool)]"
              : "text-[var(--dim)]";
        const Icon =
          item.tone === "up"
            ? ArrowUpRight
            : item.tone === "down"
              ? ArrowDownRight
              : ArrowRight;

        return (
          <div
            key={item.id}
            className="flex min-w-0 items-center justify-between gap-3 border-r border-[var(--line)] px-4 last:border-r-0"
          >
            <div className="min-w-0 flex items-center gap-3">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                {item.label}
              </span>
              <span className="truncate text-[12px] font-bold font-mono tabular-nums text-[var(--ink)]">
                {item.value}
              </span>
            </div>
            <div
              className={`flex items-center gap-1 text-[9px] font-mono tabular-nums ${toneClass}`}
            >
              <Icon size={10} />
              <span className="truncate">{item.delta}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import type {
  CityVibesResponse,
  DisasterFeedResponse,
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
  disaster?: DisasterFeedResponse | null;
  cameraCount?: number;
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
  disaster,
  cameraCount,
}: SignalTickerProps) {
  const is4K = useWarRoomScale();
  const topMarine = marine?.corridors[0];
  const topVibe = cityVibes?.zones[0];
  const topMood = mediaWatch
    ? [...mediaWatch.peopleTalkAbout, ...mediaWatch.peopleShare].sort((left, right) => {
        const weight = { intervene: 3, watch: 2, stable: 1 } as const;
        return weight[right.status] - weight[left.status];
      })[0]
    : null;

  const coreItems = [
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
        topMarine?.waveHeightMeters != null
          ? `${topMarine.waveHeightMeters.toFixed(1)}m`
          : "monitor",
      tone: toneFromStatus(topMarine?.status ?? "watch"),
    },
    {
      id: "city-vibe",
      label: "City vibe",
      value: topVibe?.label ?? "Patong",
      delta:
        topVibe?.pulseIndex != null
          ? `${topVibe.pulseIndex}`
          : "n/a",
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

  // Extra metrics for 4K war room display
  const extraItems = [
    {
      id: "alerts",
      label: "Alerts",
      value: disaster?.alerts?.length
        ? `${disaster.alerts.length} active`
        : "None",
      delta: disaster?.alerts?.some((a) => a.severity === "intervene") ? "warning" : "clear",
      tone: disaster?.alerts?.length ? "up" as const : "down" as const,
    },
    {
      id: "cameras",
      label: "CCTV",
      value: cameraCount ? `${cameraCount} feeds` : "0",
      delta: cameraCount && cameraCount > 0 ? "online" : "offline",
      tone: cameraCount && cameraCount > 0 ? "down" as const : "neutral" as const,
    },
    {
      id: "corridors",
      label: "Marine zones",
      value: marine?.corridors?.length
        ? `${marine.corridors.length} zones`
        : "N/A",
      delta: marine?.corridors?.some((c) => c.status === "intervene") ? "alert" : "normal",
      tone: marine?.corridors?.some((c) => c.status === "intervene") ? "up" as const : "down" as const,
    },
    {
      id: "vibes",
      label: "Tourism pulse",
      value: cityVibes?.zones?.length
        ? `${cityVibes.zones.length} zones`
        : "N/A",
      delta: topVibe?.pulseIndex != null
        ? topVibe.pulseIndex > 70 ? "busy" : "moderate"
        : "n/a",
      tone: topVibe?.pulseIndex != null && topVibe.pulseIndex > 70 ? "up" as const : "down" as const,
    },
  ];

  const items = is4K ? [...coreItems, ...extraItems] : coreItems;

  return (
    <section aria-live="polite" className="no-scrollbar flex h-[48px] overflow-x-auto bg-[var(--bg-raised)] min-[3000px]:h-[48px] sm:grid sm:h-[28px] sm:grid-cols-2 sm:overflow-visible sm:bg-[var(--bg-surface)] lg:grid-cols-4 min-[3000px]:grid-cols-8">
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
            className="flex w-[190px] shrink-0 items-center justify-between gap-2 border-r border-[var(--line)] px-3 last:border-r-0 sm:w-auto sm:min-w-0 sm:px-4"
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="text-[7px] font-bold uppercase tracking-[0.14em] text-[var(--dim)] min-[3000px]:text-[11px] sm:text-[8px] sm:tracking-[0.18em]">
                {item.label}
              </span>
              <span className="truncate font-mono text-[11px] font-bold tabular-nums text-[var(--ink)] min-[3000px]:text-[16px] sm:text-[12px]">
                {item.value}
              </span>
            </div>
            <div
              className={`flex shrink-0 items-center gap-1 font-mono text-[8px] tabular-nums min-[3000px]:text-[12px] sm:text-[9px] ${toneClass}`}
            >
              <Icon size={is4K ? 14 : 10} />
              <span className="truncate">{item.delta}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

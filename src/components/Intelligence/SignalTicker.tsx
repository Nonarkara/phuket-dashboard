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
    <section aria-live="polite" className={`grid bg-[var(--bg-surface)] h-[28px] min-[3000px]:h-[48px] grid-cols-2 lg:grid-cols-4 min-[3000px]:grid-cols-8`}>
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
              <span className="text-[8px] min-[3000px]:text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                {item.label}
              </span>
              <span className="truncate text-[12px] min-[3000px]:text-[16px] font-bold font-mono tabular-nums text-[var(--ink)]">
                {item.value}
              </span>
            </div>
            <div
              className={`flex items-center gap-1 text-[9px] min-[3000px]:text-[12px] font-mono tabular-nums ${toneClass}`}
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

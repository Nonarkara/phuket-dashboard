"use client";

import { ListTodo, Video } from "lucide-react";
import { SkeletonStrip } from "../Skeleton";
import type {
  DataFreshness,
  FeedMode,
  OperationsDashboardResponse,
  PublicCameraResponse,
} from "../../types/dashboard";

interface OpsControlStripProps {
  operations: OperationsDashboardResponse | null;
  cameraFeed: PublicCameraResponse | null;
}

interface FeedHealthItem {
  id: string;
  label: string;
  mode: FeedMode | "degraded";
  freshness?: DataFreshness;
  note: string;
}

function freshnessLabel(freshness?: DataFreshness) {
  if (!freshness) {
    return "freshness pending";
  }

  if (!freshness.isFresh) {
    return freshness.ageMinutes === null
      ? "stale"
      : `${freshness.ageMinutes}m stale`;
  }

  if (freshness.ageMinutes === null) {
    return "fresh";
  }

  if (freshness.ageMinutes < 1) {
    return "fresh now";
  }

  return `${freshness.ageMinutes}m old`;
}

function modeClasses(mode: FeedMode | "degraded", freshness?: DataFreshness) {
  if (mode === "degraded" || freshness?.isFresh === false) {
    return "border-[#ef4444] bg-[rgba(239,68,68,0.08)] text-[#ef4444]";
  }

  if (mode === "modeled" || mode === "hybrid") {
    return "border-[#f59e0b] bg-[rgba(245,158,11,0.08)] text-[#f59e0b]";
  }

  return "border-[rgba(15,111,136,0.22)] bg-[rgba(15,111,136,0.07)] text-[var(--cool)]";
}

function buildFeedHealth(
  operations: OperationsDashboardResponse | null,
  cameraFeed: PublicCameraResponse | null,
): FeedHealthItem[] {
  const items: FeedHealthItem[] = [];

  if (operations) {
    items.push(
      {
        id: "arrivals",
        label: "Arrivals",
        mode: operations.airportDemand.sourceSummary.mode,
        freshness: operations.airportDemand.sourceSummary.freshness,
        note: operations.airportDemand.sourceSummary.label,
      },
      {
        id: "transfer",
        label: "Transfer lift",
        mode: operations.cityTransferSupply.sourceSummary.mode,
        freshness: operations.cityTransferSupply.sourceSummary.freshness,
        note: operations.cityTransferSupply.sourceSummary.label,
      },
      {
        id: "weather",
        label: "Weather",
        mode: operations.weatherConstraint.sourceSummary.mode,
        freshness: operations.weatherConstraint.sourceSummary.freshness,
        note: operations.weatherConstraint.sourceSummary.label,
      },
      {
        id: "maritime",
        label: "Maritime",
        mode: operations.marineConstraint.sourceSummary.mode,
        freshness: operations.marineConstraint.sourceSummary.freshness,
        note: operations.marineConstraint.sourceSummary.label,
      },
    );
  }

  if (cameraFeed) {
    const cameraMode =
      cameraFeed.freshness.isFresh && cameraFeed.verifiedLiveCount > 0
        ? "live"
        : "degraded";

    items.push({
      id: "cameras",
      label: "Cameras",
      mode: cameraMode,
      freshness: cameraFeed.freshness,
      note: `${cameraFeed.verifiedLiveCount}/${cameraFeed.expectedVerifiedFeeds} verified feeds live`,
    });
  }

  return items;
}

export default function OpsControlStrip({
  operations,
  cameraFeed,
}: OpsControlStripProps) {
  const actions = operations?.actions.slice(0, 3) ?? [];
  const feedHealth = buildFeedHealth(operations, cameraFeed);

  return (
    <section className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-3 py-1.5 sm:bg-[var(--bg-surface)] sm:px-5">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="shrink-0 border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <ListTodo size={12} className="text-[var(--cool)]" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Action queue
            </span>
          </div>
        </div>
        {actions.length > 0 ? (
          actions.map((action, index) => (
            <div
              key={`${index + 1}-${action}`}
              className="max-w-[82vw] shrink-0 truncate border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[10px] text-[var(--muted)] sm:max-w-none sm:bg-[var(--panel)]"
              title={action}
            >
              <span className="font-mono font-bold text-[var(--ink)]">{index + 1}.</span>{" "}
              {action}
            </div>
          ))
        ) : (
          <SkeletonStrip />
        )}
        <div className="shrink-0 border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Video size={12} className="text-[var(--cool)]" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Feed health
            </span>
          </div>
        </div>
        {feedHealth.length > 0 ? (
          feedHealth.map((item) => (
            <div
              key={item.id}
              className={`shrink-0 border px-2.5 py-1.5 ${modeClasses(item.mode, item.freshness)}`}
              title={item.note}
            >
              <div className="text-[8px] font-bold uppercase tracking-[0.16em]">
                {item.label} {item.mode}
              </div>
              <div className="text-[8px] uppercase tracking-[0.14em] text-[var(--dim)]">
                {freshnessLabel(item.freshness)}
              </div>
            </div>
          ))
        ) : (
          <SkeletonStrip />
        )}
      </div>
    </section>
  );
}

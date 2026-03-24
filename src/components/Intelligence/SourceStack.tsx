"use client";

import { Anchor, CloudRain, MapPinned, MessageSquare, Radar, Waves } from "lucide-react";
import { findCorridorById } from "../../lib/governor-config";
import type {
  DisasterAlert,
  DisasterFeedResponse,
  GovernorBrief,
  MaritimeSecurityResponse,
  MaritimeVessel,
  MarineStatusResponse,
  MediaWatchResponse,
  NarrativeSignal,
  PublicCameraResponse,
  TourismHotspot,
  TourismHotspotsResponse,
} from "../../types/dashboard";

interface SourceStackProps {
  brief: GovernorBrief | null;
  disaster: DisasterFeedResponse | null;
  maritimeSecurity: MaritimeSecurityResponse | null;
  marine: MarineStatusResponse | null;
  tourismHotspots: TourismHotspotsResponse | null;
  mediaWatch: MediaWatchResponse | null;
  cameraPayload: PublicCameraResponse | null;
  selectedCorridorId: string;
}

export default function SourceStack({
  brief,
  disaster,
  maritimeSecurity,
  marine,
  tourismHotspots,
  mediaWatch,
  cameraPayload,
  selectedCorridorId,
}: SourceStackProps) {
  const compareByStatus = <
    T extends { status: "intervene" | "watch" | "stable" },
  >(
    left: T,
    right: T,
  ) => {
    const weight = { intervene: 3, watch: 2, stable: 1 } as const;
    return weight[right.status] - weight[left.status];
  };
  const compareDisasterAlerts = (left: DisasterAlert, right: DisasterAlert) => {
    const weight = { intervene: 3, watch: 2, stable: 1 } as const;
    return weight[right.severity] - weight[left.severity];
  };
  const corridor = findCorridorById(selectedCorridorId);
  const corridorBrief = brief?.corridorPriorities.find(
    (item) => item.id === selectedCorridorId,
  );
  const corridorMarine =
    marine?.corridors.filter(
      (item) =>
        corridor?.focusAreas.includes(item.focusArea) ||
        corridor?.aliases.some((alias) =>
          `${item.label} ${item.focusArea}`.toLowerCase().includes(alias.toLowerCase()),
        ),
    ).sort(compareByStatus) ?? [];
  const corridorSignals =
    mediaWatch
      ? [...mediaWatch.peopleTalkAbout, ...mediaWatch.peopleShare]
          .filter(
          (signal) =>
            corridor?.focusAreas.includes(signal.zone) ||
            corridor?.aliases.some((alias) =>
              `${signal.title} ${signal.zone} ${signal.summary}`
                .toLowerCase()
                .includes(alias.toLowerCase()),
            ),
          )
          .sort(compareByStatus as (left: NarrativeSignal, right: NarrativeSignal) => number)
      : [];
  const corridorDisasterAlerts =
    disaster?.alerts.filter(
      (alert) =>
        corridor?.focusAreas.includes(alert.area) ||
        corridor?.aliases.some((alias) =>
          `${alert.title} ${alert.summary} ${alert.area}`
            .toLowerCase()
            .includes(alias.toLowerCase()),
        ),
    ).sort(compareDisasterAlerts) ?? [];
  const corridorVessels =
    maritimeSecurity?.vessels.filter(
      (vessel) =>
        corridor?.aliases.some((alias) =>
          `${vessel.name} ${vessel.type} ${vessel.destination ?? ""} ${vessel.strategicNote}`
            .toLowerCase()
            .includes(alias.toLowerCase()),
        ) ||
        corridor?.focusAreas.some((focusArea) =>
          `${vessel.destination ?? ""} ${vessel.strategicNote}`
            .toLowerCase()
            .includes(focusArea.toLowerCase()),
        ),
    ).sort(compareByStatus as (left: MaritimeVessel, right: MaritimeVessel) => number) ?? [];
  const corridorTourismHotspots =
    tourismHotspots?.hotspots.filter(
      (hotspot) =>
        corridor?.focusAreas.includes(hotspot.area) ||
        corridor?.aliases.some((alias) =>
          `${hotspot.label} ${hotspot.area} ${hotspot.summary} ${hotspot.strategicNote}`
            .toLowerCase()
            .includes(alias.toLowerCase()),
        ),
    ).sort(compareByStatus as (left: TourismHotspot, right: TourismHotspot) => number) ?? [];
  const corridorCameras =
    cameraPayload?.cameras.filter((camera) =>
      camera.corridorIds?.includes(selectedCorridorId),
    ) ?? [];
  const verifiedCount = corridorCameras.filter(
    (camera) => camera.validationState === "verified",
  ).length;
  const scoutCount = corridorCameras.filter(
    (camera) => camera.validationState === "candidate",
  ).length;
  const leadDisaster = corridorDisasterAlerts[0];
  const leadVessel = corridorVessels[0];
  const leadMarine = corridorMarine[0];
  const leadTourism = corridorTourismHotspots[0];
  const leadSignal = corridorSignals[0];

  if (!corridor || !corridorBrief) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
        <span className="eyebrow">Loading corridor dossier</span>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] overflow-y-auto">
      <div className="p-4 border-b border-[var(--line)]">
        <div className="eyebrow">Selected corridor</div>
        <div className="pt-1 text-[16px] font-bold tracking-[-0.03em] text-[var(--ink)]">
          {corridorBrief.label}
        </div>
        <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
          {corridorBrief.whyNow}
        </p>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <Radar size={11} />
              Recommended action
            </div>
            <p className="pt-2 text-[11px] leading-5 text-[var(--ink)]">
              {corridorBrief.action}
            </p>
          </div>

          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <Anchor size={11} />
              Visual coverage
            </div>
            <p className="pt-2 text-[11px] leading-5 text-[var(--ink)]">
              {verifiedCount} verified feeds, {scoutCount} scout targets
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <Waves size={11} />
              Marine / weather
            </div>
            {leadMarine ? (
              <div className="pt-2 space-y-1 text-[10px] leading-4 text-[var(--muted)]">
                <div>
                  {leadMarine.label}: {leadMarine.alertPosture}
                </div>
                <div>
                  Wave {leadMarine.waveHeightMeters?.toFixed(1) ?? "--"}m / Wind{" "}
                  {leadMarine.windSpeedKph?.toFixed(0) ?? "--"}kph / Gust{" "}
                  {leadMarine.gustSpeedKph?.toFixed(0) ?? "--"}kph
                </div>
              </div>
            ) : (
              <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                No corridor-specific marine metric available yet.
              </p>
            )}
          </div>

          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <CloudRain size={11} />
              Disaster / alerts
            </div>
            {leadDisaster ? (
              <div className="pt-2">
                <div className="text-[10px] font-semibold text-[var(--ink)]">
                  {leadDisaster.title}
                </div>
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {leadDisaster.summary}
                </p>
              </div>
            ) : (
              <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                No corridor-specific disaster warning is active right now.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <Anchor size={11} />
              Maritime security
            </div>
            {leadVessel ? (
              <div className="pt-2 space-y-1 text-[10px] leading-4 text-[var(--muted)]">
                <div className="text-[10px] font-semibold text-[var(--ink)]">
                  {leadVessel.name}
                </div>
                <div>
                  {leadVessel.type} / {leadVessel.speedKnots.toFixed(1)} kn
                  {leadVessel.destination ? ` / ${leadVessel.destination}` : ""}
                </div>
                <div>{leadVessel.strategicNote}</div>
              </div>
            ) : (
              <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                No corridor-specific AIS pattern is active beyond baseline watch.
              </p>
            )}
          </div>

          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <MapPinned size={11} />
              Tourism hotspot
            </div>
            {leadTourism ? (
              <div className="pt-2">
                <div className="text-[10px] font-semibold text-[var(--ink)]">
                  {leadTourism.label}
                </div>
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {leadTourism.summary}
                </p>
              </div>
            ) : (
              <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                No corridor-specific tourism hotspot is outrunning the baseline.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="border border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <MessageSquare size={11} />
              Key headline
            </div>
            {leadSignal ? (
              <div className="pt-2">
                <div className="text-[10px] font-semibold text-[var(--ink)]">
                  {leadSignal.title}
                </div>
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {leadSignal.summary}
                </p>
              </div>
            ) : (
              <p className="pt-2 text-[10px] leading-4 text-[var(--muted)]">
                Narrative watch is quiet for this corridor.
              </p>
            )}
          </div>
        </div>

        <div className="border border-[var(--line)] px-3 py-3">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
            Why this corridor matters now
          </div>
          <p className="pt-2 text-[11px] leading-5 text-[var(--ink)]">
            {corridorBrief.summary} {corridorBrief.whyNow}
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  Anchor,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ExternalLink,
  MapPinned,
  MessageSquare,
  Tv,
  Waves,
} from "lucide-react";
import { findCorridorById, GOVERNOR_CORRIDORS } from "../../lib/governor-config";
import type {
  CityVibesResponse,
  DisasterAlert,
  DisasterFeedResponse,
  ExecutiveStatus,
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

interface BottomRailProps {
  brief: GovernorBrief | null;
  disaster: DisasterFeedResponse | null;
  maritimeSecurity: MaritimeSecurityResponse | null;
  marine: MarineStatusResponse | null;
  tourismHotspots: TourismHotspotsResponse | null;
  cityVibes: CityVibesResponse | null;
  mediaWatch: MediaWatchResponse | null;
  cameraPayload: PublicCameraResponse | null;
  selectedCorridorId: string;
  onSelectCorridor: (corridorId: string) => void;
  /** When true, renders as a vertical panel (4K right column) instead of horizontal bottom rail */
  verticalMode?: boolean;
}

function statusDot(status: ExecutiveStatus) {
  if (status === "intervene") return "bg-[#ef4444]";
  if (status === "watch") return "bg-[#f59e0b]";
  return "bg-[var(--cool)]";
}

export default function BottomRail({
  brief,
  disaster,
  maritimeSecurity,
  marine,
  tourismHotspots,
  cityVibes,
  mediaWatch,
  cameraPayload,
  selectedCorridorId,
  onSelectCorridor,
  verticalMode = false,
}: BottomRailProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = verticalMode || expanded;
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

  const allVerifiedCameras = cameraPayload?.cameras ?? [];
  const allScoutTargets = cameraPayload?.scoutTargets ?? [];
  const corridorVerifiedCameras = allVerifiedCameras.filter((camera) =>
    camera.corridorIds?.includes(selectedCorridorId),
  );
  const corridorScoutTargets = allScoutTargets.filter((camera) =>
    camera.corridorIds?.includes(selectedCorridorId),
  );
  const featuredCameras =
    corridorVerifiedCameras.length > 0 ? corridorVerifiedCameras : allVerifiedCameras;
  const featuredScouts =
    corridorScoutTargets.length > 0 ? corridorScoutTargets : allScoutTargets;
  const verifiedCount = featuredCameras.filter(
    (camera) => camera.operationalState === "live" || camera.operationalState === "reachable",
  ).length;

  const corridorMarine =
    marine?.corridors.filter(
      (item) =>
        corridor?.focusAreas.includes(item.focusArea) ||
        corridor?.aliases.some((alias) =>
          `${item.label} ${item.focusArea}`.toLowerCase().includes(alias.toLowerCase()),
        ),
    ).sort(compareByStatus) ?? [];

  const leadMarine = corridorMarine[0];

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
          `${hotspot.label} ${hotspot.area} ${hotspot.summary}`
            .toLowerCase()
            .includes(alias.toLowerCase()),
        ),
    ).sort(compareByStatus as (left: TourismHotspot, right: TourismHotspot) => number) ?? [];

  const vibeCards = cityVibes?.zones ?? [];
  const corridorVibes = corridor
    ? vibeCards.filter(
        (zone) =>
          corridor.focusAreas.some((focusArea) =>
            `${zone.label} ${zone.summary}`.toLowerCase().includes(focusArea.toLowerCase()),
          ) ||
          corridor.aliases.some((alias) =>
            `${zone.label} ${zone.summary}`.toLowerCase().includes(alias.toLowerCase()),
          ),
      ).sort(compareByStatus)
    : [];
  const featuredVibes = corridorVibes.length > 0 ? corridorVibes : vibeCards.slice(0, 2);

  const narrativeItems =
    mediaWatch && corridor
      ? [...mediaWatch.peopleTalkAbout, ...mediaWatch.peopleShare]
          .filter(
            (item) =>
              corridor.focusAreas.includes(item.zone) ||
              corridor.aliases.some((alias) =>
                `${item.title} ${item.zone} ${item.summary}`
                  .toLowerCase()
                  .includes(alias.toLowerCase()),
              ),
          )
          .sort(compareByStatus as (left: NarrativeSignal, right: NarrativeSignal) => number)
          .slice(0, 3)
      : [];

  // In vertical mode (4K right panel), show more items
  const camSlice = verticalMode ? 6 : 3;
  const alertSlice = verticalMode ? 4 : 2;
  const vesselSlice = verticalMode ? 4 : 2;
  const tourismSlice = verticalMode ? 4 : 2;

  return (
    <section className={`${verticalMode ? "flex-1" : "shrink-0 border-t border-[var(--line)]"} bg-[var(--bg-raised)]`}>
      {/* Collapsed compact bar — hidden in vertical mode */}
      {!verticalMode && (
        <div className="flex items-center gap-1.5 px-3 py-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)] hover:text-[var(--cool)] transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {corridor?.label ?? "Corridor dossier"}
          </button>

          <div className="h-3 w-[1px] bg-[var(--line)]" />

          {/* Corridor quick-switch */}
          <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {GOVERNOR_CORRIDORS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectCorridor(preset.id)}
                className={`whitespace-nowrap border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
                  selectedCorridorId === preset.id
                    ? "border-[var(--ink)] bg-[rgba(17,17,17,0.05)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Quick stats */}
          <div className="hidden items-center gap-3 text-[8px] font-mono uppercase tracking-wider text-[var(--dim)] sm:flex">
            <span className="flex items-center gap-1">
              <Camera size={9} /> {verifiedCount} live
            </span>
            <span className="flex items-center gap-1">
              <Waves size={9} /> {corridorMarine.length} marine
            </span>
            <span className="flex items-center gap-1">
              <CloudRain size={9} /> {corridorDisasterAlerts.length} alert
            </span>
            <span className="flex items-center gap-1">
              <Anchor size={9} /> {corridorVessels.length} vessel
            </span>
          </div>
        </div>
      )}

      {/* Vertical mode header */}
      {verticalMode && (
        <div className="px-4 py-2 border-b border-[var(--line)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">Intelligence Panel</div>
          <div className="text-[9px] text-[var(--dim)] mt-0.5">{corridor?.label ?? "Corridor dossier"} — {verifiedCount} cameras / {corridorDisasterAlerts.length} alerts / {corridorVessels.length} vessels</div>
          <div className="flex gap-1 mt-2 flex-wrap">
            {GOVERNOR_CORRIDORS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectCorridor(preset.id)}
                className={`whitespace-nowrap border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  selectedCorridorId === preset.id
                    ? "border-[var(--ink)] bg-[rgba(17,17,17,0.05)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {isExpanded && (
        <div className={`${verticalMode ? "flex-1 overflow-y-auto" : "max-h-[180px] overflow-y-auto border-t border-[var(--line)]"} bg-[var(--bg)]`}>
          <div className={`grid gap-px bg-[var(--line)] ${verticalMode ? "grid-cols-1" : "lg:grid-cols-4"}`}>
            {/* Column 1: Corridor brief + cameras */}
            <div className="bg-[var(--bg-raised)] p-3">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] flex items-center gap-1">
                <Tv size={9} /> Visual feeds
              </div>
              {corridorBrief && (
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {corridorBrief.action}
                </p>
              )}
              <div className="mt-2 space-y-1">
                {featuredCameras.slice(0, camSlice).map((camera) => (
                  <div key={camera.id} className="flex items-center justify-between gap-2 border border-[var(--line)] px-2 py-1">
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold text-[var(--ink)]">{camera.label}</div>
                      <div className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">{camera.locationLabel}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${(camera.operationalState === "live" || camera.operationalState === "reachable") ? "bg-[var(--cool)]" : "bg-[var(--dim)]"}`} />
                      {camera.accessUrl && (
                        <a href={camera.accessUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--dim)] hover:text-[var(--ink)]">
                          <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {featuredScouts.slice(0, 1).map((camera) => (
                  <div key={camera.id} className="flex items-center justify-between gap-2 border border-dashed border-[var(--line)] px-2 py-1">
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold text-[var(--ink)]">{camera.label}</div>
                      <div className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">Scout target</div>
                    </div>
                    <span className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">gap</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Marine + disaster */}
            <div className="bg-[var(--bg-raised)] p-3">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] flex items-center gap-1">
                <Waves size={9} /> Marine / Disaster
              </div>
              {leadMarine ? (
                <div className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  <div className="font-semibold text-[var(--ink)]">{leadMarine.label}: {leadMarine.alertPosture}</div>
                  <div>Wave {leadMarine.waveHeightMeters?.toFixed(1) ?? "--"}m / Wind {leadMarine.windSpeedKph?.toFixed(0) ?? "--"}kph</div>
                </div>
              ) : (
                <p className="pt-1 text-[10px] text-[var(--muted)]">No marine data for corridor</p>
              )}
              <div className="mt-2 space-y-1">
                {corridorDisasterAlerts.slice(0, alertSlice).map((alert) => (
                  <div key={alert.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="text-[9px] font-semibold text-[var(--ink)]">{alert.title}</div>
                    <div className="text-[8px] text-[var(--muted)]">{alert.area}</div>
                  </div>
                ))}
                {corridorVessels.slice(0, vesselSlice).map((vessel) => (
                  <div key={vessel.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="text-[9px] font-semibold text-[var(--ink)]">{vessel.name}</div>
                    <div className="text-[8px] text-[var(--muted)]">{vessel.type} / {vessel.speedKnots.toFixed(1)}kn</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: Tourism + mood */}
            <div className="bg-[var(--bg-raised)] p-3">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] flex items-center gap-1">
                <MapPinned size={9} /> Tourism / Mood
              </div>
              <div className="mt-1 space-y-1">
                {corridorTourismHotspots.slice(0, tourismSlice).map((hotspot) => (
                  <div key={hotspot.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="text-[9px] font-semibold text-[var(--ink)]">{hotspot.label}</div>
                    <div className="text-[8px] text-[var(--muted)]">{hotspot.summary}</div>
                  </div>
                ))}
                {featuredVibes.slice(0, 2).map((zone) => (
                  <div key={zone.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold text-[var(--ink)]">{zone.label}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(zone.status)}`} />
                    </div>
                    <div className="text-[8px] text-[var(--muted)]">{zone.summary}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 4: Narrative */}
            <div className="bg-[var(--bg-raised)] p-3">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] flex items-center gap-1">
                <MessageSquare size={9} /> Narrative watch
              </div>
              {mediaWatch && (
                <p className="pt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {mediaWatch.postureSummary}
                </p>
              )}
              <div className="mt-2 space-y-1">
                {narrativeItems.map((item) => (
                  <div key={item.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="flex items-center justify-between gap-1">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-semibold text-[var(--ink)] truncate hover:text-[var(--cool)] hover:underline underline-offset-2">{item.title}</a>
                      ) : (
                        <span className="text-[9px] font-semibold text-[var(--ink)] truncate">{item.title}</span>
                      )}
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(item.status)}`} />
                    </div>
                    <div className="text-[8px] text-[var(--dim)]">{item.zone} / {item.volumeLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

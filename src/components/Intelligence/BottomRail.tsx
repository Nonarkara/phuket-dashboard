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
  DisasterFeedResponse,
  ExecutiveStatus,
  GovernorBrief,
  MaritimeSecurityResponse,
  MarineStatusResponse,
  MediaWatchResponse,
  PublicCameraResponse,
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
}: BottomRailProps) {
  const [expanded, setExpanded] = useState(false);
  const corridor = findCorridorById(selectedCorridorId);
  const corridorBrief = brief?.corridorPriorities.find(
    (item) => item.id === selectedCorridorId,
  );

  const allCameras = cameraPayload?.cameras ?? [];
  const corridorCameras = allCameras.filter((camera) =>
    camera.corridorIds?.includes(selectedCorridorId),
  );
  const featuredCameras = corridorCameras.length > 0 ? corridorCameras : allCameras;
  const verifiedCount = featuredCameras.filter(
    (c) => c.validationState === "verified",
  ).length;

  const corridorMarine =
    marine?.corridors.filter(
      (item) =>
        corridor?.focusAreas.includes(item.focusArea) ||
        corridor?.aliases.some((alias) =>
          `${item.label} ${item.focusArea}`.toLowerCase().includes(alias.toLowerCase()),
        ),
    ) ?? [];

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
    ) ?? [];

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
    ) ?? [];

  const corridorTourismHotspots =
    tourismHotspots?.hotspots.filter(
      (hotspot) =>
        corridor?.focusAreas.includes(hotspot.area) ||
        corridor?.aliases.some((alias) =>
          `${hotspot.label} ${hotspot.area} ${hotspot.summary}`
            .toLowerCase()
            .includes(alias.toLowerCase()),
        ),
    ) ?? [];

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
      )
    : [];
  const featuredVibes = corridorVibes.length > 0 ? corridorVibes : vibeCards.slice(0, 2);

  const narrativeItems = mediaWatch
    ? [...mediaWatch.peopleTalkAbout, ...mediaWatch.peopleShare].slice(0, 3)
    : [];

  return (
    <section className="border-t border-[var(--line)] bg-[var(--bg-raised)]">
      {/* Collapsed compact bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
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
            <Camera size={9} /> {verifiedCount} cam
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

      {/* Expanded detail panel */}
      {expanded && (
        <div className="max-h-[280px] overflow-y-auto border-t border-[var(--line)] bg-[var(--bg)]">
          <div className="grid gap-px bg-[var(--line)] lg:grid-cols-4">
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
                {featuredCameras.slice(0, 4).map((camera) => (
                  <div key={camera.id} className="flex items-center justify-between gap-2 border border-[var(--line)] px-2 py-1">
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold text-[var(--ink)]">{camera.label}</div>
                      <div className="text-[7px] uppercase tracking-[0.14em] text-[var(--dim)]">{camera.locationLabel}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${camera.validationState === "verified" ? "bg-[var(--cool)]" : "bg-[var(--dim)]"}`} />
                      {camera.accessUrl && (
                        <a href={camera.accessUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--dim)] hover:text-[var(--ink)]">
                          <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
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
                {corridorDisasterAlerts.slice(0, 2).map((alert) => (
                  <div key={alert.id} className="border border-[var(--line)] px-2 py-1">
                    <div className="text-[9px] font-semibold text-[var(--ink)]">{alert.title}</div>
                    <div className="text-[8px] text-[var(--muted)]">{alert.area}</div>
                  </div>
                ))}
                {corridorVessels.slice(0, 2).map((vessel) => (
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
                {corridorTourismHotspots.slice(0, 2).map((hotspot) => (
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
                      <span className="text-[9px] font-semibold text-[var(--ink)] truncate">{item.title}</span>
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

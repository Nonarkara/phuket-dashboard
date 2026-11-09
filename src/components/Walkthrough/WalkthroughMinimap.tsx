"use client";

import { useMemo } from "react";
import { Locate } from "lucide-react";
import type { WalkthroughPlace, WalkthroughNeighborhood } from "../../lib/phuket-walkthrough-data";

interface WalkthroughMinimapProps {
  neighborhood: WalkthroughNeighborhood;
  places: WalkthroughPlace[];
  selectedPlace: WalkthroughPlace | null;
  cameraPosition: [number, number]; // [lat, lng]
  cameraBearing: number; // degrees
  cameraPitch: number; // degrees
  onSelectPlace: (place: WalkthroughPlace) => void;
  onTeleportToCoord: (lat: number, lng: number) => void;
}

export default function WalkthroughMinimap({
  neighborhood,
  places,
  selectedPlace,
  cameraPosition,
  cameraBearing,
  onSelectPlace,
  onTeleportToCoord,
}: WalkthroughMinimapProps) {
  // Bounding box calculation for the neighborhood
  const { minLat, maxLat, minLng, maxLng } = useMemo(() => {
    let minLat = neighborhood.center[0] - 0.0035;
    let maxLat = neighborhood.center[0] + 0.0035;
    let minLng = neighborhood.center[1] - 0.005;
    let maxLng = neighborhood.center[1] + 0.005;

    for (const p of places) {
      if (p.lat < minLat) minLat = p.lat - 0.001;
      if (p.lat > maxLat) maxLat = p.lat + 0.001;
      if (p.lng < minLng) minLng = p.lng - 0.001;
      if (p.lng > maxLng) maxLng = p.lng + 0.001;
    }

    return { minLat, maxLat, minLng, maxLng };
  }, [neighborhood, places]);

  // Project [lat, lng] to SVG percentage coordinates (0% to 100%)
  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const playerPos = project(cameraPosition[0], cameraPosition[1]);

  // Generate SVG viewing cone arc from camera bearing
  const coneLength = 18; // length of cone in SVG coordinate space
  const halfFovRad = (40 * Math.PI) / 180; // 80 deg FOV
  const bearingRad = ((cameraBearing - 90) * Math.PI) / 180;

  const leftAngle = bearingRad - halfFovRad;
  const rightAngle = bearingRad + halfFovRad;

  const coneP1 = {
    x: playerPos.x + Math.cos(leftAngle) * coneLength,
    y: playerPos.y + Math.sin(leftAngle) * coneLength,
  };
  const coneP2 = {
    x: playerPos.x + Math.cos(rightAngle) * coneLength,
    y: playerPos.y + Math.sin(rightAngle) * coneLength,
  };

  const conePath = `M ${playerPos.x} ${playerPos.y} L ${coneP1.x} ${coneP1.y} A ${coneLength} ${coneLength} 0 0 1 ${coneP2.x} ${coneP2.y} Z`;

  // Handle map click to walk there
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const clickedLng = minLng + (clickX / 100) * (maxLng - minLng);
    const clickedLat = maxLat - (clickY / 100) * (maxLat - minLat);

    onTeleportToCoord(clickedLat, clickedLng);
  };

  return (
    <div className="relative flex flex-col border border-[var(--line)] bg-[var(--bg-raised)] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-[9px]">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--ink)]">
          <Locate size={11} className="text-[var(--cool)] animate-pulse" />
          <span>Neighborhood Radar (เรดาร์ย่าน)</span>
        </div>
        <span className="text-[8px] text-[var(--dim)]">
          {cameraPosition[0].toFixed(5)}, {cameraPosition[1].toFixed(5)}
        </span>
      </div>

      {/* Interactive Map SVG Canvas */}
      <div className="relative aspect-[4/3] w-full bg-[#f6f4ee] dark:bg-[#151922] cursor-crosshair">
        {/* Subtle grid pattern for comic drafting look */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleMapClick}
        >
          <defs>
            <pattern id="radar-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.3"
                className="text-stone-300 dark:text-stone-700/60"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#radar-grid)" />

          {/* Key Street lines */}
          {neighborhood.keyStreets.map((street, idx) => {
            const pos = project(street.center[0], street.center[1]);
            return (
              <g key={street.name}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="1.5"
                  className="fill-stone-400 dark:fill-stone-600"
                />
                <text
                  x={pos.x}
                  y={pos.y + (idx % 2 === 0 ? -3 : 4)}
                  textAnchor="middle"
                  className="fill-stone-500 text-[3.2px] font-mono font-bold uppercase tracking-wider dark:fill-stone-400 pointer-events-none select-none"
                >
                  {street.name}
                </text>
              </g>
            );
          })}

          {/* Camera Viewing Cone */}
          <path
            d={conePath}
            className="fill-[var(--cool)] opacity-25 pointer-events-none transition-all duration-150"
          />

          {/* Player Position Dot & Heading Line */}
          <circle
            cx={playerPos.x}
            cy={playerPos.y}
            r="2.8"
            className="fill-[var(--cool)] stroke-white stroke-[0.8] shadow-sm pointer-events-none"
          />
          <line
            x1={playerPos.x}
            y1={playerPos.y}
            x2={playerPos.x + Math.cos(bearingRad) * 7}
            y2={playerPos.y + Math.sin(bearingRad) * 7}
            className="stroke-[var(--cool)] stroke-[1.2] pointer-events-none"
          />

          {/* POI Place Pins */}
          {places.map((place) => {
            const pos = project(place.lat, place.lng);
            const isSelected = selectedPlace?.id === place.id;

            return (
              <g
                key={place.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPlace(place);
                }}
                className="cursor-pointer transition-transform hover:scale-125"
              >
                {/* Ping circle if selected */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="5"
                    className="animate-ping fill-red-500 opacity-40"
                  />
                )}
                {/* Pin base */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? "3" : "2.2"}
                  className={
                    isSelected
                      ? "fill-red-500 stroke-white stroke-[0.8]"
                      : "fill-stone-800 stroke-white stroke-[0.5] dark:fill-stone-200"
                  }
                  style={!isSelected ? { fill: place.comicBubbleColor } : {}}
                />
                {/* Pin tiny label */}
                <text
                  x={pos.x}
                  y={pos.y - 3.5}
                  textAnchor="middle"
                  className={`text-[2.8px] font-mono font-bold select-none pointer-events-none ${
                    isSelected
                      ? "fill-red-600 dark:fill-red-400 font-extrabold"
                      : "fill-stone-600 dark:fill-stone-300"
                  }`}
                >
                  {place.name.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Quick Controls on Minimap */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 px-1 py-0.5 text-[8px] font-mono text-white backdrop-blur-xs">
          <span>Click radar to walk</span>
        </div>

        <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onTeleportToCoord(neighborhood.center[0], neighborhood.center[1])}
            className="flex h-5 w-5 items-center justify-center border border-[var(--line)] bg-[var(--bg-raised)] text-[var(--ink)] shadow-xs transition-colors hover:bg-[var(--cool)] hover:text-white"
            title="Reset to neighborhood center"
          >
            <Locate size={10} />
          </button>
        </div>
      </div>

      {/* Legend strip */}
      <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 font-mono text-[8px] text-[var(--dim)]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--cool)]" /> You
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Focus Place
          </span>
        </div>
        <span>Bearing: {Math.round(cameraBearing)}°</span>
      </div>
    </div>
  );
}

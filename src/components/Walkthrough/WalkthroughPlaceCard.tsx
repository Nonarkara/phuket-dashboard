"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MapPin,
  Footprints,
  Compass,
  ExternalLink,
  Award,
  Sparkles,
  Camera,
  Layers,
  UtensilsCrossed,
  Clock,
} from "lucide-react";
import type { WalkthroughPlace } from "../../lib/phuket-walkthrough-data";

interface WalkthroughPlaceCardProps {
  place: WalkthroughPlace;
  cameraPosition: [number, number]; // [lat, lng]
  cameraBearing: number;
  onTeleportToDoorstep: (place: WalkthroughPlace) => void;
  onClose?: () => void;
}

// Computes haversine distance in meters
function computeDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Computes bearing from point 1 to point 2
function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const b = (Math.atan2(y, x) * 180) / Math.PI;
  return (b + 360) % 360;
}

export default function WalkthroughPlaceCard({
  place,
  cameraPosition,
  cameraBearing,
  onTeleportToDoorstep,
  onClose,
}: WalkthroughPlaceCardProps) {
  const [viewMode, setViewMode] = useState<"comic" | "photo">("comic");

  const distanceM = computeDistanceM(
    cameraPosition[0],
    cameraPosition[1],
    place.lat,
    place.lng,
  );
  // Average walking speed ~1.2 m/s or 72 m/min
  const walkMinutes = Math.max(1, Math.round(distanceM / 70));

  const targetBearing = computeBearing(
    cameraPosition[0],
    cameraPosition[1],
    place.lat,
    place.lng,
  );
  const relativeAngle = ((targetBearing - cameraBearing + 540) % 360) - 180;

  return (
    <div className="flex flex-col border border-[var(--line-bright)] bg-[var(--bg-raised)] p-3 text-[var(--ink)] shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-[var(--cool)] bg-[rgba(15,111,136,0.1)] px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase tracking-wider text-[var(--cool)]">
              {place.categoryLabel}
            </span>
            {place.badge && (
              <span className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Award size={10} />
                {place.badge}
              </span>
            )}
            <span className="font-mono text-[9px] font-bold text-[var(--dim)]">
              {place.priceRange}
            </span>
          </div>
          <h3 className="mt-1 font-mono text-[14px] font-bold leading-tight tracking-tight text-[var(--ink)]">
            {place.name}
          </h3>
          <p className="font-mono text-[11px] text-[var(--dim)]">
            {place.nameTh} · {place.streetName}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
            aria-label="Close place card"
          >
            ✕
          </button>
        )}
      </div>

      {/* Comic Speech Sound Effect Banner */}
      <div className="my-2 flex items-center justify-between border border-dashed border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 items-center justify-center px-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm"
            style={{ backgroundColor: place.comicBubbleColor }}
          >
            {place.soundEffectRom}
          </div>
          <span className="font-mono text-[11px] font-semibold text-[var(--ink)]">
            {place.soundEffectTh}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-[var(--dim)]">
          <Sparkles size={11} className="text-amber-500" />
          <span>Vibe Radar</span>
        </div>
      </div>

      {/* Visual Scene / Photo Toggle */}
      <div className="relative mb-2 overflow-hidden border border-[var(--line)] bg-black/5">
        <div className="relative aspect-[16/9] w-full">
          {viewMode === "photo" ? (
            <Image
              src={place.photoScene.heroUrl}
              alt={place.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 420px"
            />
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center bg-stone-100 p-4 text-center dark:bg-stone-900">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(#000 1.5px, transparent 1.5px)",
                  backgroundSize: "8px 8px",
                }}
              />
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className="mb-1 border border-stone-800 bg-white px-2 py-0.5 font-mono text-[11px] font-black uppercase tracking-widest text-stone-900 shadow-[2px_2px_0px_#000] dark:border-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:shadow-[2px_2px_0px_#fff]"
                >
                  3D SCENE · {place.streetNameTh}
                </div>
                <p className="max-w-[280px] font-mono text-[10px] text-stone-600 dark:text-stone-300">
                  {place.architecturalContext}
                </p>
              </div>
            </div>
          )}

          {/* Mode Switcher buttons */}
          <div className="absolute bottom-2 right-2 z-20 flex gap-1 bg-black/70 p-0.5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setViewMode("comic")}
              className={`flex items-center gap-1 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${
                viewMode === "comic"
                  ? "bg-white text-black"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Layers size={10} />
              Comic 3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("photo")}
              className={`flex items-center gap-1 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${
                viewMode === "photo"
                  ? "bg-white text-black"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Camera size={10} />
              Real Scene
            </button>
          </div>
        </div>
        <div className="border-t border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-mono text-[8px] text-[var(--dim)]">
          {place.photoScene.caption}
        </div>
      </div>

      {/* Neighborhood Orientation & Finding It */}
      <div className="mb-2 space-y-1.5 border border-[var(--line)] bg-[var(--bg)] p-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--dim)]">
            Neighborhood Orientation (ตำแหน่งในย่าน)
          </span>
          <span className="font-mono text-[8px] text-[var(--cool)]">
            {place.neighborhoodOrientation.entrySide}
          </span>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-[var(--ink)]">
          <strong>How to find it:</strong> {place.neighborhoodOrientation.relativePosition}
        </p>
        <p className="font-mono text-[9px] text-[var(--muted)]">
          <strong>Visual cue:</strong> {place.neighborhoodOrientation.visualCue}
        </p>
      </div>

      {/* Signature Dishes / Highlights */}
      {place.signatureDishes.length > 0 && (
        <div className="mb-3 border border-[var(--line)] p-2">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--dim)]">
            <UtensilsCrossed size={11} className="text-[var(--cool)]" />
            <span>Must-Try / Signature Order (เมนูเด็ด)</span>
          </div>
          <ul className="space-y-1 pl-1 font-mono text-[10px] text-[var(--ink)]">
            {place.signatureDishes.map((dish) => (
              <li key={dish} className="flex items-start gap-1.5 leading-snug">
                <span className="text-[var(--cool)]">•</span>
                <span>{dish}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Distance & Action Footer */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-[var(--ink)]">
            <MapPin size={12} className="text-red-500" />
            <span>{distanceM} m</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-[var(--dim)]">
            <Footprints size={12} />
            <span>~{walkMinutes} min walk</span>
          </div>
          <div
            className="flex items-center gap-1 font-mono text-[9px] text-[var(--dim)]"
            title={`Relative heading: ${Math.round(relativeAngle)}°`}
          >
            <Compass
              size={12}
              className="text-[var(--cool)]"
              style={{ transform: `rotate(${relativeAngle}deg)` }}
            />
            <span>{relativeAngle > 0 ? `+${Math.round(relativeAngle)}°` : `${Math.round(relativeAngle)}°`}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={place.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 border border-[var(--line)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--dim)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
          >
            <ExternalLink size={10} />
            Google Maps
          </a>
          <button
            type="button"
            onClick={() => onTeleportToDoorstep(place)}
            className="flex items-center gap-1.5 border border-[var(--cool)] bg-[var(--cool)] px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
          >
            <Clock size={10} />
            Stand at Doorstep (F)
          </button>
        </div>
      </div>
    </div>
  );
}

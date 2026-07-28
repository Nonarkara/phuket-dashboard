"use client";

/**
 * Map scale bar with an explicit unit — kilometres in the flat 2D chart,
 * nautical miles in the nautical view.
 *
 * The whole point is honesty about units: the two view modes exist so an
 * operator reading marine distances (NM) and one reading road distances (km)
 * are never silently looking at the same unlabelled bar. In the pitched views
 * the ground scale varies across the screen, so the bar is computed at the
 * viewport centre and labelled "≈".
 */

interface Props {
  zoom: number;
  latitude: number;
  pitch: number;
  unit: "km" | "nm";
}

const NM_IN_METERS = 1852;
// Web-mercator ground resolution at the equator for MapLibre/deck's 512px world.
const EQUATOR_M_PER_PX_Z0 = 40075016.686 / 512;
// 1-2-5 series, in the bar's own unit.
const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

export default function MapScaleBar({ zoom, latitude, pitch, unit }: Props) {
  const metersPerPixel =
    (EQUATOR_M_PER_PX_Z0 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  const unitMeters = unit === "nm" ? NM_IN_METERS : 1000;
  const unitsPerPixel = metersPerPixel / unitMeters;

  // Aim for a bar around 90px; snap to the nearest nice round distance.
  const target = unitsPerPixel * 90;
  const dist = NICE_STEPS.find((s) => s >= target) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const widthPx = Math.round(dist / unitsPerPixel);
  if (!Number.isFinite(widthPx) || widthPx <= 0) return null;

  const label = `${dist < 1 ? dist.toFixed(1) : dist} ${unit === "nm" ? "NM" : "km"}`;

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-0.5"
      aria-label={`Map scale: ${label}${unit === "nm" ? " (nautical miles)" : " (kilometres)"}`}
    >
      <div className="flex items-end gap-1.5 border border-[var(--line)] bg-[var(--bg-surface)]/85 px-2 py-1 backdrop-blur-md">
        <div
          className="h-[5px] border-b-2 border-l-2 border-r-2 border-[var(--ink)]"
          style={{ width: `${widthPx}px` }}
        />
        <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[var(--ink)]">
          {pitch > 5 ? "≈ " : ""}{label}
        </span>
        <span className="text-[7px] font-bold uppercase leading-none tracking-[0.16em] text-[var(--dim)]">
          {unit === "nm" ? "nautical" : "metric"}
        </span>
      </div>
    </div>
  );
}

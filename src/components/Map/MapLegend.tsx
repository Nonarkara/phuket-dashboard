"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";

interface LegendItem {
  label: string;
  color: string;
  shape: "circle" | "line" | "gradient";
}

const LEGEND_ITEMS: LegendItem[] = [
  { label: "Incidents", color: "#ef4444", shape: "circle" },
  { label: "Fire hotspots", color: "#f97316", shape: "circle" },
  { label: "Maritime traffic", color: "#0f6f88", shape: "line" },
  { label: "Flight paths", color: "#8b5cf6", shape: "line" },
  { label: "Tourism hotspots", color: "#22c55e", shape: "circle" },
  { label: "Public cameras", color: "#3b82f6", shape: "circle" },
  { label: "Bus routes", color: "#06b6d4", shape: "line" },
  { label: "Rainfall", color: "#60a5fa", shape: "circle" },
];

function Swatch({ item }: { item: LegendItem }) {
  if (item.shape === "line") {
    return (
      <svg width="16" height="10" aria-hidden="true">
        <line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill={item.color} />
    </svg>
  );
}

export default function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 z-20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 border border-[var(--line-bright)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--ink)] backdrop-blur-xl transition-colors hover:border-[var(--ink)]"
        aria-expanded={open}
        aria-label="Toggle map legend"
      >
        <Layers size={12} />
        Legend
        {open ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
      </button>

      {open && (
        <div className="mt-1 border border-[var(--line-bright)] bg-[var(--panel-strong)] px-3 py-2.5 backdrop-blur-xl">
          <div className="space-y-1.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <Swatch item={item} />
                <span className="text-[9px] font-medium tracking-[0.06em] text-[var(--muted)]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-[var(--line)] pt-2 text-[7px] leading-3 text-[var(--dim)]">
            Sources: OpenSky, Open-Meteo, ACLED, NASA FIRMS, PKSB
          </div>
        </div>
      )}
    </div>
  );
}

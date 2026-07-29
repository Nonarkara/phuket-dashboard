"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";

interface LegendItem {
  label: string;
  color: string;
  shape: "circle" | "line" | "box" | "plane" | "ship";
  description: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { label: "Administrative Focus Scope", color: "#38bdf8", shape: "box", description: "Selected Tambon or District boundary polygon" },
  { label: "Live Traffic Congestion", color: "#ef4444", shape: "line", description: "Longdo/ITIC flow (Green: free, Amber: slow, Red: jam)" },
  { label: "Real Waterway Network", color: "#06b6d4", shape: "line", description: "ThaiWater 2,200 vector line features (Rivers, Canals, Drains)" },
  { label: "ThaiWater Telemetry", color: "#eab308", shape: "circle", description: "Water level & rainfall monitoring (Normal, Watch, Warning, Critical)" },
  { label: "Aircraft in Sky", color: "#a855f7", shape: "plane", description: "Live international & domestic flights approaching/climbing out of HKT" },
  { label: "Maritime AIS Vessels", color: "#0ea5e9", shape: "ship", description: "Cruise Liners (Queen Elizabeth, etc.), Ferries, Patrol & Cargo ships" },
  { label: "Phuket Smart Bus", color: "#22c55e", shape: "circle", description: "Real-time PKSB transit movement (Airport - Patong - Rawai)" },
  { label: "Accident Hazard Blackspots", color: "#ef4444", shape: "circle", description: "High-risk slope descents & bypass intersections" },
];

function Swatch({ item }: { item: LegendItem }) {
  if (item.shape === "line") {
    return (
      <svg width="18" height="10" aria-hidden="true" className="shrink-0">
        <line x1="0" y1="5" x2="18" y2="5" stroke={item.color} strokeWidth="2.5" />
      </svg>
    );
  }
  if (item.shape === "box") {
    return (
      <svg width="14" height="10" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="12" height="8" fill="none" stroke={item.color} strokeWidth="1.5" strokeDasharray="2,2" />
      </svg>
    );
  }
  if (item.shape === "plane") {
    return (
      <span className="shrink-0 text-[10px] text-[#a855f7]">✈</span>
    );
  }
  if (item.shape === "ship") {
    return (
      <span className="shrink-0 text-[10px] text-[#0ea5e9]">🚢</span>
    );
  }
  return (
    <svg width="10" height="10" aria-hidden="true" className="shrink-0">
      <circle cx="5" cy="5" r="4" fill={item.color} />
    </svg>
  );
}

export default function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 z-20 max-w-[320px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 border border-[var(--line-bright)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--ink)] backdrop-blur-xl transition-colors hover:border-[var(--ink)] shadow-md"
        aria-expanded={open}
        aria-label="Toggle map legend"
      >
        <Layers size={12} className="text-[var(--cool)]" />
        Map Legend & Explanations
        {open ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
      </button>

      {open && (
        <div className="mt-1 border border-[var(--line-bright)] bg-[var(--panel-strong)] p-3 backdrop-blur-xl shadow-2xl rounded-sm">
          <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--cool)] mb-2 border-b border-[var(--line)] pb-1">
            Map Symbols & Layers
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <div className="mt-0.5">
                  <Swatch item={item} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold tracking-[0.04em] text-[var(--ink)]">
                    {item.label}
                  </div>
                  <div className="text-[8px] leading-3 text-[var(--dim)]">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 border-t border-[var(--line)] pt-2 text-[7px] leading-3 text-[var(--dim)]">
            Telemetry Providers: HII / ThaiWater, Longdo ITIC, OpenSky Network, AIS Marine, PKSB Transit
          </div>
        </div>
      )}
    </div>
  );
}

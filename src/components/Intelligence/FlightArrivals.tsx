"use client";

import { useEffect, useState } from "react";
import { Plane, RefreshCw } from "lucide-react";

interface FlightArrival {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCode: string;
  originLat: number;
  originLon: number;
  scheduledTime: string;
  estimatedTime: string;
  status: "landed" | "on-time" | "delayed" | "en-route" | "scheduled";
  gate?: string;
  terminal?: string;
  aircraft?: string;
  paxEstimate: number;
  country: string;
  countryCode: string;
  distance: number;
}

interface ArrivalsData {
  airport: string;
  totalFlights: number;
  arrivals: FlightArrival[];
  byCountry: Record<string, number>;
  source: "live" | "simulation";
}

// HKT coordinates
const HKT = { lat: 8.11, lon: 98.32 };

// Simple Mercator projection for the mini world map
function project(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (mercN / Math.PI) * (h / 2);
  return [x, y];
}

const STATUS_COLORS: Record<string, string> = {
  "en-route": "#22c55e",
  "on-time": "var(--cool)",
  delayed: "#f59e0b",
  landed: "var(--dim)",
  scheduled: "var(--line-bright)",
};

const STATUS_LABELS: Record<string, string> = {
  "en-route": "EN ROUTE",
  "on-time": "ON TIME",
  delayed: "DELAYED",
  landed: "LANDED",
  scheduled: "SCHED",
};

export default function FlightArrivals() {
  const [data, setData] = useState<ArrivalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/flights/arrivals");
        if (res.ok) {
          const json = (await res.json()) as ArrivalsData;
          setData(json);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    void load();
    const interval = setInterval(() => void load(), 2 * 60 * 1000); // 2 min refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-[10px] text-[var(--dim)]">
        <RefreshCw size={12} className="animate-spin mr-2" /> Loading flights...
      </div>
    );
  }

  if (!data) return null;

  const enRoute = data.arrivals.filter((f) => f.status === "en-route");
  const upcoming = data.arrivals.filter((f) => f.status === "on-time" || f.status === "scheduled");
  const delayed = data.arrivals.filter((f) => f.status === "delayed");
  const landed = data.arrivals.filter((f) => f.status === "landed");

  // Hourly distribution for bar chart
  const hourlyArrivals = new Array(24).fill(0);
  const hourlyDepartures = new Array(24).fill(0);
  for (const f of data.arrivals) {
    const h = parseInt(f.scheduledTime.split(":")[0], 10);
    if (!isNaN(h)) hourlyArrivals[h]++;
  }
  // Simulate departures as ~85% of arrivals shifted +2 hours
  for (let i = 0; i < 24; i++) {
    hourlyDepartures[(i + 2) % 24] = Math.round(hourlyArrivals[i] * 0.85);
  }
  const maxHourly = Math.max(...hourlyArrivals, ...hourlyDepartures, 1);
  const nowHour = new Date().getHours();

  // Estimate total pax
  const totalPax = data.arrivals.reduce((sum, f) => sum + f.paxEstimate, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
            <Plane size={10} className="inline mr-1" />
            HKT Arrivals
          </div>
          <div className="text-[8px] text-[var(--dim)] mt-0.5 flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--ink)]">{data.totalFlights}</span> flights today
            {data.source === "simulation" && (
              <span className="text-[7px] px-1 py-0.5 bg-[rgba(15,111,136,0.08)] text-[var(--cool)]">SIM</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono font-bold text-[var(--ink)]">
            ~{totalPax.toLocaleString()}
          </div>
          <div className="text-[7px] text-[var(--dim)] uppercase">est. pax</div>
        </div>
      </div>

      {/* Mini world map with flight routes */}
      <div className="border-b border-[var(--line)] bg-[var(--bg-surface)] relative overflow-hidden" style={{ height: 140 }}>
        <MiniWorldMap
          arrivals={data.arrivals.filter((f) => f.originLat !== 0)}
          selected={selectedFlight}
          onSelect={setSelectedFlight}
        />
      </div>

      {/* Status summary strip */}
      <div className="flex items-center gap-0 border-b border-[var(--line)] bg-[var(--bg-surface)]">
        {[
          { label: "En route", count: enRoute.length, color: "#22c55e" },
          { label: "On time", count: upcoming.length, color: "var(--cool)" },
          { label: "Delayed", count: delayed.length, color: "#f59e0b" },
          { label: "Landed", count: landed.length, color: "var(--dim)" },
        ].map((s) => (
          <div key={s.label} className="flex-1 text-center py-1.5 border-r border-[var(--line)] last:border-r-0">
            <div className="text-[12px] font-mono font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[7px] uppercase tracking-wider text-[var(--dim)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Hourly arrivals/departures chart */}
      <div className="border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
            Hourly traffic
          </span>
          <div className="flex items-center gap-2 text-[7px]">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: "var(--cool)" }} /> Arr</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: "#f59e0b" }} /> Dep</span>
          </div>
        </div>
        <svg width="100%" height={40} viewBox="0 0 240 40" preserveAspectRatio="none">
          {Array.from({ length: 24 }, (_, i) => {
            const x = (i / 24) * 240;
            const barW = 240 / 24 - 1;
            const arrH = (hourlyArrivals[i] / maxHourly) * 30;
            const depH = (hourlyDepartures[i] / maxHourly) * 30;
            const isNow = i === nowHour;
            return (
              <g key={i}>
                <rect x={x} y={35 - arrH} width={barW / 2} height={arrH}
                  fill={isNow ? "#22c55e" : "var(--cool)"} opacity={isNow ? 1 : 0.6} />
                <rect x={x + barW / 2} y={35 - depH} width={barW / 2} height={depH}
                  fill={isNow ? "#ef4444" : "#f59e0b"} opacity={isNow ? 1 : 0.4} />
                {i % 3 === 0 && (
                  <text x={x + barW / 2} y={40} textAnchor="middle" fontSize={5}
                    fill="var(--dim)">{i}</text>
                )}
              </g>
            );
          })}
          {/* Current time indicator */}
          <line x1={(nowHour / 24) * 240} y1={0} x2={(nowHour / 24) * 240} y2={35}
            stroke="#22c55e" strokeWidth={0.5} strokeDasharray="2,1" />
        </svg>
      </div>

      {/* Flight list */}
      <div className="flex-1 overflow-y-auto">
        {data.arrivals
          .filter((f) => f.status !== "landed")
          .slice(0, 15)
          .map((flight) => (
          <button
            key={flight.flightNumber}
            type="button"
            onClick={() => setSelectedFlight(
              selectedFlight === flight.flightNumber ? null : flight.flightNumber
            )}
            className={`w-full text-left border-b border-[var(--line)] px-3 py-1.5 hover:bg-[rgba(15,111,136,0.03)] transition-colors ${
              selectedFlight === flight.flightNumber ? "bg-[rgba(15,111,136,0.06)]" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-[var(--ink)]">
                  {flight.flightNumber}
                </span>
                <span className="text-[8px] text-[var(--dim)]">{flight.airline}</span>
              </div>
              <span
                className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                style={{
                  color: STATUS_COLORS[flight.status],
                  background: flight.status === "delayed" ? "rgba(245,158,11,0.1)"
                    : flight.status === "en-route" ? "rgba(34,197,94,0.1)" : "transparent",
                }}
              >
                {STATUS_LABELS[flight.status]}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <div className="text-[9px] text-[var(--dim)]">
                {flight.originCode} → HKT
                <span className="ml-1 text-[8px]">{flight.origin}</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--ink)]">
                {flight.estimatedTime !== flight.scheduledTime ? (
                  <>
                    <span className="line-through text-[var(--dim)] text-[8px] mr-1">{flight.scheduledTime}</span>
                    <span className="text-[#f59e0b]">{flight.estimatedTime}</span>
                  </>
                ) : (
                  flight.scheduledTime
                )}
              </div>
            </div>
            {selectedFlight === flight.flightNumber && (
              <div className="mt-1 flex gap-3 text-[8px] text-[var(--dim)]">
                <span>Gate {flight.gate}</span>
                <span>{flight.aircraft}</span>
                <span>~{flight.paxEstimate} pax</span>
                <span>{flight.distance.toLocaleString()} km</span>
              </div>
            )}
          </button>
        ))}

        {/* Landed flights (collapsed) */}
        {landed.length > 0 && (
          <div className="px-3 py-2 bg-[var(--bg-surface)]">
            <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--dim)] mb-1">
              Landed ({landed.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {landed.slice(0, 8).map((f) => (
                <span key={f.flightNumber} className="text-[8px] font-mono text-[var(--dim)] border border-[var(--line)] px-1.5 py-0.5">
                  {f.flightNumber} {f.scheduledTime}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini World Map with flight routes ───────────────────────────

function MiniWorldMap({
  arrivals,
  selected,
  onSelect,
}: {
  arrivals: FlightArrival[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const W = 400;
  const H = 200;
  const [hktX, hktY] = project(HKT.lat, HKT.lon, W, H);

  // Simple world outline (very simplified continents)
  const continentPaths = [
    // Europe + Africa
    "M195,40 L210,38 L220,42 L225,55 L220,65 L215,80 L210,95 L205,110 L200,120 L195,130 L190,115 L192,100 L190,85 L188,70 L190,55 Z",
    // Asia
    "M225,30 L260,25 L290,35 L300,45 L295,55 L285,60 L275,65 L265,70 L255,65 L245,55 L235,48 L230,42 Z",
    // SE Asia / Indonesia
    "M275,70 L285,72 L295,75 L300,80 L295,85 L285,82 L275,78 Z",
    // Australia
    "M300,110 L320,108 L330,112 L328,120 L318,125 L305,122 L300,115 Z",
    // India
    "M245,55 L255,50 L260,60 L255,75 L248,68 L245,60 Z",
  ];

  return (
    <svg width="100%" height="100%" viewBox={`120 10 200 140`} className="opacity-90">
      {/* Dark background is set by parent div */}

      {/* Simplified continent outlines — light theme */}
      {continentPaths.map((d, i) => (
        <path key={i} d={d} fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.15)" strokeWidth={0.4} />
      ))}

      {/* Flight route lines */}
      {arrivals.map((flight) => {
        const [ox, oy] = project(flight.originLat, flight.originLon, W, H);
        const isSelected = selected === flight.flightNumber;
        const isActive = flight.status === "en-route" || flight.status === "on-time";
        const isDelayed = flight.status === "delayed";
        return (
          <g key={flight.flightNumber}>
            {/* Route line */}
            <line
              x1={ox} y1={oy} x2={hktX} y2={hktY}
              stroke={isSelected ? "#0f6f88" : isActive ? "rgba(15,111,136,0.4)" : isDelayed ? "rgba(245,158,11,0.3)" : "rgba(0,0,0,0.06)"}
              strokeWidth={isSelected ? 1.5 : isActive ? 0.8 : 0.3}
              strokeDasharray={isActive || isSelected ? "none" : "2,2"}
            />
            {/* Origin dot */}
            <circle
              cx={ox} cy={oy} r={isSelected ? 3 : isActive ? 2 : 1.2}
              fill={isSelected ? "#0f6f88" : isActive ? "#0f6f88" : isDelayed ? "#f59e0b" : "rgba(0,0,0,0.15)"}
              className="cursor-pointer"
              onClick={() => onSelect(isSelected ? null : flight.flightNumber)}
            />
            {/* Label for active or selected */}
            {(isSelected || isActive) && (
              <text x={ox + 4} y={oy - 3} fontSize={5} fill="#0f6f88" fontWeight="bold">
                {flight.originCode}
              </text>
            )}
          </g>
        );
      })}

      {/* HKT destination marker */}
      <circle cx={hktX} cy={hktY} r={3.5} fill="#ef4444" opacity={0.9} />
      <circle cx={hktX} cy={hktY} r={5} fill="none" stroke="#ef4444" strokeWidth={0.6} opacity={0.5}>
        <animate attributeName="r" from="3.5" to="9" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={hktX + 6} y={hktY + 2} fontSize={6} fill="#ef4444" fontWeight="bold">HKT</text>
    </svg>
  );
}

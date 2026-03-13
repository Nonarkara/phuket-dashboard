"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import AseanEconomicsPanel from "./AseanEconomicsPanel";
import ConvergenceAlerts from "./ConvergenceAlerts";
import SatelliteStatusPanel from "./SatelliteStatusPanel";
import type { IncidentFeature } from "../../types/dashboard";

interface Incident {
    id: number | string;
    type: string;
    location: string;
    time: string;
    severity: string;
    notes: string;
}

export default function Sidebar() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/incidents");
        const payload: unknown = await res.json();
        if (!Array.isArray(payload)) {
          setIncidents([]);
          return;
        }

        const items = (payload as IncidentFeature[]).map((d) => ({
          id: d.id,
          type: d.properties.type,
          location: d.properties.location || "Phuket area",
          time: d.properties.eventDate || "--",
          severity: d.properties.fatalities > 0 ? "high" : "medium",
          notes: d.properties.notes,
        }));
        setIncidents(items);
      } catch {
        setIncidents([]);
      }
    };
    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="flex h-full w-full flex-col text-[var(--ink)] select-none">
      {/* Header — compact */}
      <div className="border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Command</div>
            <h1 className="pt-1 text-[16px] font-bold tracking-[-0.03em] text-[var(--ink)]">
              Phuket Ops
            </h1>
          </div>
          <div className="live-badge">LIVE</div>
        </div>
        <p className="pt-1 text-[9px] leading-3.5 text-[var(--muted)]">
          Map-led operating view for Phuket, Phang Nga, Krabi, Ranong, Surat Thani, and Trang.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Convergence */}
        <section className="border-b border-[var(--line)] px-3 py-2">
          <div className="eyebrow mb-1.5 opacity-50">Andaman convergence</div>
          <ConvergenceAlerts />
        </section>

        {/* Data Pipeline */}
        <section className="border-b border-[var(--line)] px-3 py-2">
          <div className="eyebrow mb-1.5 opacity-50">Data pipeline</div>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              { name: "Tourism arrivals", status: "live", interval: "90s", source: "dashboard cache" },
              { name: "Road safety feed", status: "live", interval: "2 min", source: "event cache" },
              { name: "OpenSky Flights", status: "live", interval: "30s", source: "opensky-network.org" },
              { name: "Open-Meteo Weather", status: "live", interval: "5 min", source: "open-meteo.com" },
              { name: "Open-Meteo AQI", status: "live", interval: "5 min", source: "open-meteo.com" },
              { name: "NASA GIBS / FIRMS", status: "live", interval: "daily", source: "earthdata.nasa.gov" },
              { name: "Google Trends TH", status: "live", interval: "5 min", source: "trends.google.com" },
            ].map((feed) => (
              <div key={feed.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      feed.status === "live" ? "bg-[#22c55e] animate-pulse" : "bg-[#ef4444]"
                    }`}
                  />
                  <span className="text-[9px] font-medium text-[var(--ink)]">{feed.name}</span>
                </div>
                <span className="text-[7px] font-mono tracking-[0.1em] text-[var(--dim)]">{feed.interval}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Satellite */}
        <section className="border-b border-[var(--line)] px-3 py-2">
          <div className="eyebrow mb-1.5 opacity-50">Satellite constellation</div>
          <SatelliteStatusPanel />
        </section>

        {/* Recent Signals */}
        <section className="border-b border-[var(--line)] px-3 py-2">
          <div className="eyebrow mb-1.5 opacity-50">Recent signals</div>
          <div className="space-y-2">
            {incidents.slice(0, 6).map((incident, idx) => (
              <article key={incident.id} className="border-b border-[var(--line)] pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <span className="pt-0.5 text-[8px] font-mono tabular-nums text-[var(--dim)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${
                          incident.severity === "high" ? "text-[#f59e0b]" : "text-[var(--cool)]"
                        }`}
                      >
                        {incident.type}
                      </span>
                      <span className="text-[7px] font-mono tabular-nums text-[var(--dim)]">{incident.time}</span>
                    </div>
                    <p className="pt-0.5 text-[9px] leading-3.5 text-[var(--muted)]">
                      {incident.notes.length > 80 ? `${incident.notes.substring(0, 80)}...` : incident.notes}
                    </p>
                    <div className="pt-0.5 flex items-center gap-1 text-[8px] text-[var(--dim)]">
                      <MapPin size={8} />
                      <span>{incident.location}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Regional Economics */}
        <section className="px-3 py-2">
          <div className="eyebrow mb-1.5 opacity-50">Regional economics</div>
          <AseanEconomicsPanel />
        </section>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Info, MapPin } from "lucide-react";
import AseanEconomicsPanel from "./AseanEconomicsPanel";
import ConvergenceAlerts from "./ConvergenceAlerts";
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
    const interval = setInterval(load, 2 * 60 * 1000); // Refresh every 2 min
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="flex h-full w-full flex-col text-[var(--ink)] select-none">
      <div className="border-b border-[var(--line)] p-5">
        <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Command</div>
              <h1 className="pt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--ink)]">
                Phuket Ops
              </h1>
            </div>
          <div className="live-badge">LIVE</div>
        </div>
        <p className="pt-3 text-[12px] leading-5 text-[var(--muted)]">
          Map-led operating view for Phuket, Phang Nga, Krabi, Ranong, Surat
          Thani, and Trang. Read weather, tourism, safety, and economy together
          instead of in isolation.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="eyebrow">Andaman convergence</div>
            <div className="h-px w-full bg-[var(--bg-raised)]" />
          </div>
          <ConvergenceAlerts />
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <div className="eyebrow">Regional economics</div>
            <div className="h-px w-full bg-[var(--bg-raised)]" />
          </div>
          <AseanEconomicsPanel />
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <div className="eyebrow">Data pipeline</div>
            <div className="h-px w-full bg-[var(--bg-raised)]" />
          </div>

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
              <div
                key={feed.name}
                className="flex items-center justify-between px-0 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      feed.status === "live" ? "bg-[#22c55e] animate-pulse" : "bg-[#ef4444]"
                    }`}
                  />
                  <span className="text-[10px] font-medium text-[var(--ink)]">
                    {feed.name}
                  </span>
                </div>
                <span className="text-[8px] font-mono tracking-[0.1em] text-[var(--dim)]">
                  {feed.interval}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <div className="eyebrow">Recent signals</div>
            <div className="h-px w-full bg-[var(--bg-raised)]" />
          </div>

          <div className="space-y-4">
            {incidents.slice(0, 4).map((incident, idx) => (
              <article
                key={incident.id}
                className="border-b border-[var(--line)] pb-4 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <span className="pt-0.5 text-[10px] font-mono tabular-nums text-[var(--dim)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${
                          incident.severity === "high"
                            ? "text-[#f59e0b]"
                            : "text-[var(--cool)]"
                        }`}
                      >
                        {incident.type}
                      </span>
                      <span className="text-[9px] font-mono tabular-nums text-[var(--dim)]">
                        {incident.time}
                      </span>
                    </div>
                    <p className="pt-2 text-[12px] leading-5 text-[var(--muted)]">
                      {incident.notes.length > 100
                        ? `${incident.notes.substring(0, 100)}...`
                        : incident.notes}
                    </p>
                    <div className="pt-2 flex items-center gap-2 text-[10px] text-[var(--dim)]">
                      <MapPin size={10} />
                      <span>{incident.location}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-[var(--line)] p-5">
        <div className="flex items-start gap-3">
          <Info size={14} className="mt-0.5 text-[var(--cool)]" />
          <div>
            <div className="text-[11px] font-medium text-[var(--ink)]">
              Data from weather, air-quality, mapping, mobility, and regional economics feeds
            </div>
            <p className="pt-1 text-[11px] leading-4 text-[var(--dim)]">
              Phuket and Andaman operating starter system
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

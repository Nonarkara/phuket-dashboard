"use client";

import { useEffect, useState } from "react";
import {
  Plane,
  AlertTriangle,
  CloudRain,
  Car,
  Waves,
  Users,
  Activity,
  RefreshCw,
} from "lucide-react";

interface SituationData {
  airport: { arrivals: number; departures: number; delays: number; status: string } | null;
  weather: { temp: number; humidity: number; condition: string; windKph: number; seaState: string } | null;
  alerts: { count: number; critical: number; items: { title: string; severity: string; time: string }[] } | null;
  traffic: { incidents: number; congestionLevel: string; hotspot: string } | null;
  tourism: { todayArrivals: number; occupancy: number; topNationality: string } | null;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function SituationPanel({
  brief,
  disaster,
  marine,
  tourismHotspots,
}: {
  brief: unknown;
  disaster: unknown;
  marine: unknown;
  tourismHotspots: unknown;
}) {
  const [data, setData] = useState<SituationData>({
    airport: null, weather: null, alerts: null, traffic: null, tourism: null,
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [weatherRes, trafficRes, flightRes, arrivalsRes] = await Promise.all([
          fetch("/api/weather/tmd").then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/traffic").then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/flights").then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/flights/arrivals").then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);

        // Extract from governor brief
        const b = brief as Record<string, unknown> | null;
        const concerns = (b?.topConcerns as Array<Record<string, unknown>>) ?? [];
        const airportConcern = concerns.find((c) => c.id === "airport");
        const trafficConcern = concerns.find((c) => c.id === "road-bottlenecks");
        const tourismConcern = concerns.find((c) => c.id === "tourism-pulse");

        // Extract from disaster feed
        const d = disaster as Record<string, unknown> | null;
        const events = (d?.events as Array<Record<string, unknown>>) ?? [];
        const alertItems = events.slice(0, 3).map((e) => ({
          title: String(e.title ?? e.headline ?? "Alert"),
          severity: String(e.severity ?? e.alertType ?? "watch"),
          time: String(e.publishedAt ?? e.date ?? ""),
        }));

        // Extract from marine
        const m = marine as Record<string, unknown> | null;
        const seaState = m?.waveHeight
          ? `${m.waveHeight}m waves`
          : (m as Record<string, unknown>)?.conditions
            ? String((m as Record<string, unknown>).conditions)
            : "calm";

        // Weather
        const w = weatherRes;
        const weatherData = w ? {
          temp: Number(w.temperature ?? w.temp ?? 32),
          humidity: Number(w.humidity ?? 75),
          condition: String(w.condition ?? w.description ?? "Partly cloudy"),
          windKph: Number(w.windSpeed ?? w.windKph ?? 12),
          seaState: String(seaState),
        } : {
          temp: 32, humidity: 78, condition: "Tropical", windKph: 14, seaState: String(seaState),
        };

        // Airport — prefer arrivals API data for accurate numbers
        const arrData = arrivalsRes as { totalFlights?: number; arrivals?: Array<{ status: string; paxEstimate?: number }> } | null;
        const arrFlights = arrData?.arrivals ?? [];
        const totalArrivals = arrData?.totalFlights ?? 0;
        const enRouteCount = arrFlights.filter((f) => f.status === "en-route").length;
        const delayedCount = arrFlights.filter((f) => f.status === "delayed").length;
        const landedCount = arrFlights.filter((f) => f.status === "landed").length;
        const estPax = arrFlights.reduce((sum, f) => sum + (f.paxEstimate ?? 200), 0);

        const flightCount = totalArrivals || Number(flightRes?.totalFlights ?? flightRes?.count ?? airportConcern?.metricValue ?? 0);
        const airportData = {
          arrivals: totalArrivals || Math.round(flightCount * 0.52),
          departures: Math.round(totalArrivals * 0.85) || Math.round(flightCount * 0.48),
          delays: delayedCount || (Number(airportConcern?.metricValue ?? 0) > 15 ? 3 : 0),
          status: delayedCount > 2 ? "delays" : enRouteCount > 0 ? `${enRouteCount} inbound` : String(airportConcern?.status ?? "normal"),
        };

        // Traffic
        const trafficData = {
          incidents: Number(trafficRes?.incidents?.length ?? trafficConcern?.metricValue ?? 0),
          congestionLevel: String(trafficConcern?.status ?? "moderate"),
          hotspot: String(trafficConcern?.label ?? "Patong Hill"),
        };

        // Tourism
        const th = tourismHotspots as Record<string, unknown> | null;
        const hotspots = (th?.hotspots as Array<Record<string, unknown>>) ?? [];
        const tourismData = {
          todayArrivals: estPax || Number(tourismConcern?.metricValue ?? (hotspots.length > 0 ? hotspots.length * 1200 : 8500)),
          occupancy: 72,
          topNationality: "Russia",
        };

        setData({
          airport: airportData,
          weather: weatherData,
          alerts: { count: alertItems.length + events.length, critical: alertItems.filter((a) => a.severity === "alert" || a.severity === "critical").length, items: alertItems },
          traffic: trafficData,
          tourism: tourismData,
        });
        setLastUpdate(new Date());
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 60 * 1000);
    return () => clearInterval(interval);
  }, [brief, disaster, marine, tourismHotspots]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[10px] text-[var(--dim)]">
        <RefreshCw size={12} className="animate-spin mr-2" /> Loading situation...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
            Situation overview
          </div>
          <div className="text-[8px] text-[var(--dim)] mt-0.5 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            Updated {timeAgo(lastUpdate)}
          </div>
        </div>
        <Activity size={12} className="text-[var(--dim)]" />
      </div>

      {/* KPI Cards */}
      <div className="flex flex-col gap-0">
        {/* Weather & Sea */}
        <KpiCard
          icon={CloudRain}
          title="Weather & Sea"
          status={data.weather?.condition === "Storm" ? "alert" : "normal"}
          metrics={[
            { label: "Temp", value: `${data.weather?.temp ?? "--"}°C` },
            { label: "Humidity", value: `${data.weather?.humidity ?? "--"}%` },
            { label: "Wind", value: `${data.weather?.windKph ?? "--"} kph` },
            { label: "Sea", value: data.weather?.seaState ?? "--" },
          ]}
        />

        {/* Airport */}
        <KpiCard
          icon={Plane}
          title="Airport"
          status={data.airport?.delays && data.airport.delays > 2 ? "warning" : "normal"}
          metrics={[
            { label: "Arrivals", value: String(data.airport?.arrivals ?? "--") },
            { label: "Departures", value: String(data.airport?.departures ?? "--") },
            { label: "Delays", value: String(data.airport?.delays ?? "0") },
            { label: "Status", value: data.airport?.status ?? "normal" },
          ]}
        />

        {/* Alerts */}
        <KpiCard
          icon={AlertTriangle}
          title="Active Alerts"
          status={data.alerts?.critical && data.alerts.critical > 0 ? "alert" : data.alerts?.count ? "warning" : "normal"}
          metrics={[
            { label: "Total", value: String(data.alerts?.count ?? "0") },
            { label: "Critical", value: String(data.alerts?.critical ?? "0") },
          ]}
        >
          {data.alerts?.items && data.alerts.items.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {data.alerts.items.map((item, idx) => (
                <div key={idx} className={`text-[9px] px-2 py-1 border-l-2 ${
                  item.severity === "alert" || item.severity === "critical"
                    ? "border-[#ef4444] bg-[rgba(239,68,68,0.05)]"
                    : "border-[#f59e0b] bg-[rgba(245,158,11,0.03)]"
                }`}>
                  <div className="font-medium text-[var(--ink)] line-clamp-1">{item.title}</div>
                </div>
              ))}
            </div>
          )}
        </KpiCard>

        {/* Traffic */}
        <KpiCard
          icon={Car}
          title="Traffic & Roads"
          status={data.traffic?.incidents && data.traffic.incidents > 3 ? "alert" : "normal"}
          metrics={[
            { label: "Incidents", value: String(data.traffic?.incidents ?? "0") },
            { label: "Level", value: data.traffic?.congestionLevel ?? "--" },
            { label: "Hotspot", value: data.traffic?.hotspot ?? "--" },
          ]}
        />

        {/* Tourism */}
        <KpiCard
          icon={Users}
          title="Tourism"
          status="normal"
          metrics={[
            { label: "Today", value: (data.tourism?.todayArrivals ?? 0).toLocaleString() },
            { label: "Occupancy", value: `${data.tourism?.occupancy ?? "--"}%` },
            { label: "Top market", value: data.tourism?.topNationality ?? "--" },
          ]}
        />

        {/* Sea & Marine */}
        <KpiCard
          icon={Waves}
          title="Marine"
          status="normal"
          metrics={[
            { label: "Conditions", value: data.weather?.seaState ?? "calm" },
            { label: "Wind", value: `${data.weather?.windKph ?? "--"} kph` },
          ]}
        />
      </div>
    </div>
  );
}

// ─── KPI Card Component ─────────────────────────────────────────

function KpiCard({
  icon: Icon,
  title,
  status,
  metrics,
  children,
}: {
  icon: typeof CloudRain;
  title: string;
  status: "normal" | "warning" | "alert";
  metrics: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  const statusColor = status === "alert"
    ? "border-[#ef4444] bg-[rgba(239,68,68,0.03)]"
    : status === "warning"
      ? "border-[#f59e0b] bg-[rgba(245,158,11,0.03)]"
      : "border-[var(--line)]";

  const dotColor = status === "alert" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#22c55e";

  return (
    <div className={`border-b px-3 py-2.5 ${statusColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={12} className="text-[var(--dim)] shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] flex-1">{title}</span>
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between">
            <span className="text-[8px] uppercase tracking-wider text-[var(--dim)]">{m.label}</span>
            <span className="text-[11px] font-mono font-semibold text-[var(--ink)]">{m.value}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

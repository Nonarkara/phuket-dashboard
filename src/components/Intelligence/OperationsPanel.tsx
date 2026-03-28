"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  BusFront,
  CloudRain,
  Ship,
  PlaneLanding,
  Route,
} from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import type {
  DemandSupplySnapshot,
  ExecutiveStatus,
  InterchangeTouchpoint,
  OperationalWeatherResponse,
  OperationsConstraint,
  OperationsDashboardResponse,
} from "../../types/dashboard";

interface OperationsPanelProps {
  data: OperationsDashboardResponse | null;
}

function statusTheme(status: ExecutiveStatus) {
  if (status === "intervene") {
    return {
      border: "border-[#ef4444]",
      text: "text-[#ef4444]",
      bg: "bg-[rgba(239,68,68,0.08)]",
    };
  }

  if (status === "watch") {
    return {
      border: "border-[#f59e0b]",
      text: "text-[#f59e0b]",
      bg: "bg-[rgba(245,158,11,0.08)]",
    };
  }

  return {
    border: "border-[var(--line)]",
    text: "text-[var(--cool)]",
    bg: "bg-[rgba(15,111,136,0.06)]",
  };
}

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
}

function formatRate(value: number, unit: string) {
  return `${value.toLocaleString()} ${unit}`;
}

function modeLabel(mode: OperationsDashboardResponse["mode"]) {
  if (mode === "live") return "LIVE";
  if (mode === "modeled") return "MODELED";
  if (mode === "degraded") return "DEGRADED";
  return "HYBRID";
}

function SnapshotCard({
  title,
  icon,
  snapshot,
}: {
  title: string;
  icon: ReactNode;
  snapshot: DemandSupplySnapshot;
}) {
  const theme = statusTheme(snapshot.status);
  return (
    <section className={`border ${theme.border} ${theme.bg} px-3 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center border ${theme.border}`}>
            {icon}
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              {title}
            </div>
            <div className={`text-[15px] font-bold tracking-tight ${theme.text}`}>
              {snapshot.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-mono font-bold text-[var(--ink)]">
            {snapshot.gapRate > 0 ? "+" : ""}
            {snapshot.gapRate}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--dim)]">
            gap {snapshot.unit}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-2 text-[10px]">
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Demand</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {formatRate(snapshot.demandRate, snapshot.unit)}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Supply</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {formatRate(snapshot.supplyRate, snapshot.unit)}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Window</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {snapshot.windowLabel}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
        {snapshot.summary}
      </p>
    </section>
  );
}

function ConstraintCard({
  title,
  icon,
  constraint,
}: {
  title: string;
  icon: ReactNode;
  constraint: OperationsConstraint | OperationalWeatherResponse;
}) {
  const theme = statusTheme(constraint.status);
  const metrics = "metrics" in constraint
    ? constraint.metrics
    : [
        { label: "Temp", value: constraint.temperatureC !== null ? `${constraint.temperatureC.toFixed(0)}C` : "--" },
        { label: "Rain", value: constraint.rainfallMm !== null ? `${constraint.rainfallMm.toFixed(1)} mm` : "--" },
        { label: "Wind", value: constraint.windKph !== null ? `${constraint.windKph.toFixed(0)} kph` : "--" },
      ];
  const label = "metrics" in constraint ? constraint.label : constraint.condition;

  return (
    <section className={`border ${theme.border} px-3 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center border ${theme.border}`}>
            {icon}
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              {title}
            </div>
            <div className={`text-[15px] font-bold tracking-tight ${theme.text}`}>
              {label}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-2 text-[10px]">
        {metrics.slice(0, 3).map((metric) => (
          <div key={`${title}-${metric.label}`}>
            <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
              {metric.label}
            </div>
            <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
      {"seaState" in constraint && (
        <div className="mt-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
          Sea state: <span className="font-mono text-[var(--ink)]">{constraint.seaState}</span>
        </div>
      )}
      <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
        {constraint.summary}
      </p>
    </section>
  );
}

function TouchpointCard({ touchpoint }: { touchpoint: InterchangeTouchpoint }) {
  const theme = statusTheme(touchpoint.status);

  return (
    <section className={`border ${theme.border} bg-[var(--bg)] px-3 py-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
            {touchpoint.area}
          </div>
          <div className={`mt-0.5 text-[15px] font-bold tracking-tight ${theme.text}`}>
            {touchpoint.label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
            Slack
          </div>
          <div className="text-[16px] font-mono font-bold text-[var(--ink)]">
            {touchpoint.transferSlackMinutes !== null
              ? `${touchpoint.transferSlackMinutes}m`
              : "--"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-2 text-[10px]">
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Demand</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {formatRate(touchpoint.demandRate, touchpoint.unit)}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Boat lift</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {formatRate(touchpoint.supplyRate, touchpoint.unit)}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">Departure</div>
          <div className="mt-0.5 font-mono font-bold text-[var(--ink)]">
            {touchpoint.nextDepartureAt
              ? formatGeneratedAt(touchpoint.nextDepartureAt)
              : "--"}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
        {touchpoint.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {touchpoint.vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className={`border px-2 py-1 text-[9px] ${
              vehicle.kind === "ferry"
                ? "border-[rgba(15,111,136,0.24)] bg-[rgba(15,111,136,0.06)]"
                : "border-[var(--line)] bg-[var(--bg-raised)]"
            }`}
          >
            <div className="font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
              {vehicle.kind === "ferry" ? "Ferry" : "Bus"} {vehicle.label}
            </div>
            <div className="mt-0.5 font-mono text-[var(--dim)]">
              {vehicle.etaMinutes !== null ? `ETA ${vehicle.etaMinutes}m` : "On stand"}
              {vehicle.routeLabel ? ` | ${vehicle.routeLabel}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function OperationsPanel({ data }: OperationsPanelProps) {
  const is4K = useWarRoomScale();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center border-l border-[var(--line)] bg-[var(--bg-raised)] px-6 text-[11px] uppercase tracking-[0.18em] text-[var(--dim)]">
        Loading operations desk
      </div>
    );
  }

  return (
    <aside className="flex h-full flex-col border-l border-[var(--line)] bg-[var(--bg-raised)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              Operations desk
            </div>
            <div className="mt-0.5 text-[18px] font-bold tracking-tight text-[var(--ink)]">
              Airport to city to pier
            </div>
          </div>
          <div className="text-right">
            <div className="border border-[var(--line)] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
              {modeLabel(data.mode)}
            </div>
            <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              {formatGeneratedAt(data.generatedAt)} HKT
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
          The operator wall is following one chain: arrival banks, transfer lift, road friction, and pier handoff timing.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className={`grid gap-3 p-4 ${is4K ? "grid-cols-2" : "grid-cols-1"}`}>
          <SnapshotCard
            title="Demand"
            icon={<PlaneLanding size={15} className="text-[var(--ink)]" />}
            snapshot={data.airportDemand}
          />
          <SnapshotCard
            title="Supply"
            icon={<BusFront size={15} className="text-[var(--ink)]" />}
            snapshot={data.cityTransferSupply}
          />
          <ConstraintCard
            title="Roads"
            icon={<Route size={15} className="text-[var(--ink)]" />}
            constraint={data.trafficFriction}
          />
          <ConstraintCard
            title="Weather"
            icon={<CloudRain size={15} className="text-[var(--ink)]" />}
            constraint={data.weatherConstraint}
          />
          <div className={is4K ? "col-span-2" : ""}>
            <ConstraintCard
              title="Marine"
              icon={<Ship size={15} className="text-[var(--ink)]" />}
              constraint={data.marineConstraint}
            />
          </div>
        </div>

        <div className="border-t border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[var(--cool)]" />
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              Bus to boat touchpoints
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {data.touchpoints.map((touchpoint) => (
              <TouchpointCard key={touchpoint.id} touchpoint={touchpoint} />
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--line)] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
            Immediate actions
          </div>
          <div className="mt-3 space-y-2">
            {data.actions.map((action, index) => (
              <div key={action} className="flex gap-2 border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
                <div className="w-5 shrink-0 text-[10px] font-mono font-bold text-[var(--cool)]">
                  {index + 1}
                </div>
                <p className="text-[10px] leading-4 text-[var(--muted)]">
                  {action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

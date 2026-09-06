"use client";

// Right bar — "Where the water goes". The routing chain as six stages
// with live metrics and ETAs, the Tha Ngiu split as a share bar, the
// city fill zones in the order they pond, the tidal outlets, and a
// what-if water-level slider that paints the map.

import { ArrowDownToLine, Droplets, Waves } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import { SkeletonOpsPanel } from "../Skeleton";
import type { NstStage, NstWatershedResponse, NstZoneState } from "../../types/nst";

const STAGE_HEX: Record<NstStage["state"], string> = { clear: "#22c55e", watch: "#f59e0b", active: "#f97316", alert: "#ef4444" };
export const ZONE_HEX: Record<NstZoneState["status"], string> = { dry: "var(--dim)", watch: "#f59e0b", ponding: "#0ea5e9", flooded: "#ef4444" };

function fmtEta(h: number | null) {
  if (h === null) return null;
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h} h`;
}

export default function FlowRoutingPanel({
  data, whatIfLevel, onWhatIfLevel, onSelectZone,
}: {
  data: NstWatershedResponse | null;
  whatIfLevel: number;
  onWhatIfLevel: (m: number) => void;
  onSelectZone: (z: NstZoneState) => void;
}) {
  const is4K = useWarRoomScale();
  if (!data) return <div className="h-full border-l border-[var(--line)] bg-[var(--bg-surface)]"><SkeletonOpsPanel /></div>;

  const { routing, zones, outlets } = data;
  const postureHex = routing.posture === "severe" ? "#ef4444" : routing.posture === "elevated" ? "#f59e0b" : "#22c55e";
  const eta = fmtEta(routing.cityEtaHours);
  const sortedZones = [...zones].sort((a, b) => a.fillOrder - b.fillOrder);
  const t = (a: string, b: string) => (is4K ? a : b);

  return (
    <aside className="flex h-full w-full flex-col border-l border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={is4K ? 18 : 13} className="text-[var(--cool)]" />
            <div>
              <div className={`${t("text-[11px]", "text-[8px]")} font-bold uppercase tracking-[0.16em] text-[var(--dim)]`}>City routing</div>
              <div className={`${t("text-[18px]", "text-[13px]")} font-bold tracking-[-0.02em]`}>Where the water goes</div>
            </div>
          </div>
          <span className="live-badge">{data.source === "live" ? "LIVE" : data.source === "scenario" ? "SCENARIO" : "MODEL"}</span>
        </div>
        <div className={`mt-2 grid grid-cols-4 divide-x divide-[var(--line)] border border-[var(--line)] text-center font-mono ${t("text-[12px]", "text-[9px]")}`}>
          {[
            { v: `${routing.catchmentRain24h}`, l: "mm catchment" },
            { v: `${routing.thaDiDischarge}`, l: "m3/s Tha Di" },
            { v: eta ?? "—", l: "city ETA", c: eta ? "#ef4444" : undefined },
            { v: routing.posture.toUpperCase(), l: "posture", c: postureHex },
          ].map((k) => (
            <div key={k.l} className="px-1 py-1.5">
              <div className="font-bold" style={{ color: k.c ?? "var(--ink)" }}>{k.v}</div>
              <div className={`uppercase tracking-wider text-[var(--dim)] ${t("text-[9px]", "text-[6px]")}`}>{k.l}</div>
            </div>
          ))}
        </div>
        <p className={`mt-2 text-[var(--muted)] ${t("text-[13px] leading-5", "text-[9px] leading-4")}`}>{routing.headline}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {/* Stages */}
        <div className="border-b border-[var(--line)] px-3 py-2">
          <div className={`font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${t("text-[11px]", "text-[8px]")}`}>Routing chain</div>
          <ol className="mt-1.5">
            {routing.stages.map((s, i) => (
              <li key={s.id} className="flex gap-2 py-1.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center border font-mono font-bold ${t("text-[11px] h-6 w-6", "text-[8px]")}`} style={{ borderColor: STAGE_HEX[s.state], color: STAGE_HEX[s.state] }}>{s.step}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-semibold ${t("text-[14px]", "text-[10px]")}`}>{s.title}</span>
                    <span className={`shrink-0 font-mono ${t("text-[12px]", "text-[8px]")}`} style={{ color: s.state === "clear" ? "var(--muted)" : STAGE_HEX[s.state] }}>{s.metric}</span>
                  </div>
                  <div className={`text-[var(--muted)] ${t("text-[12px] leading-5", "text-[8px] leading-[13px]")}`}>{s.detail}</div>
                  {s.etaHours !== null && (
                    <div className={`mt-0.5 font-mono uppercase tracking-[0.14em] text-[#ef4444] ${t("text-[10px]", "text-[7px]")}`}>ETA {fmtEta(s.etaHours)}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Split share */}
        <div className="border-b border-[var(--line)] px-3 py-2">
          <div className={`flex items-center justify-between font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${t("text-[11px]", "text-[8px]")}`}>
            <span>Tha Ngiu split</span>
            <span className="font-mono" style={{ color: routing.diversionOpen ? "#0ea5e9" : "var(--dim)" }}>diversion {routing.diversionOpen ? "OPEN" : "closed"}</span>
          </div>
          <div className="mt-1.5 flex h-2 w-full border border-[var(--line)]">
            <div style={{ width: `${routing.split.north * 100}%`, background: "#58a6ff" }} title="North — Khlong Tha Sak" />
            <div style={{ width: `${routing.split.city * 100}%`, background: routing.split.city * routing.thaDiDischarge > routing.cityChannelCapacity ? "#ef4444" : "#0f6f88" }} title="City — Khlong Pak Nakhon" />
            <div style={{ width: `${routing.split.south * 100}%`, background: "#22c55e" }} title="South — diversion canal" />
          </div>
          <div className={`mt-1 grid grid-cols-3 font-mono text-[var(--muted)] ${t("text-[10px]", "text-[7px]")}`}>
            <span>N {Math.round(routing.split.north * 100)}% · {Math.round(routing.thaDiDischarge * routing.split.north)} m3/s</span>
            <span className="text-center">CITY {Math.round(routing.split.city * 100)}% · {Math.round(routing.thaDiDischarge * routing.split.city)}/{routing.cityChannelCapacity}</span>
            <span className="text-right">S {Math.round(routing.split.south * 100)}% · {Math.round(routing.thaDiDischarge * routing.split.south)} m3/s</span>
          </div>
        </div>

        {/* Zones */}
        <div className="border-b border-[var(--line)] px-3 py-2">
          <div className={`font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${t("text-[11px]", "text-[8px]")}`}>City fill order</div>
          {sortedZones.map((z) => (
            <button key={z.id} type="button" onClick={() => onSelectZone(z)} className="flex w-full items-start gap-2 border-t border-[var(--line)] py-1.5 text-left first:border-t-0 hover:bg-[rgba(15,111,136,0.05)]">
              <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 border`} style={{ background: z.status === "dry" ? "transparent" : ZONE_HEX[z.status], borderColor: ZONE_HEX[z.status] }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate font-semibold ${t("text-[13px]", "text-[10px]")}`}>{z.fillOrder}. {z.name.split(" — ")[0]}</span>
                  <span className={`shrink-0 font-mono uppercase ${t("text-[10px]", "text-[7px]")}`} style={{ color: ZONE_HEX[z.status] }}>{z.status}{z.etaHours !== null ? ` · ${fmtEta(z.etaHours)}` : ""}</span>
                </div>
                <div className={`truncate text-[var(--muted)] ${t("text-[11px]", "text-[8px]")}`}>{z.name.split(" — ")[1]} · {z.elevationM} m MSL · out via {z.outlet}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Outlets */}
        <div className="border-b border-[var(--line)] px-3 py-2">
          <div className={`flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${t("text-[11px]", "text-[8px]")}`}><Waves size={is4K ? 12 : 9} /> Outlets to the Gulf</div>
          {outlets.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-2 border-t border-[var(--line)] py-1.5 first:border-t-0">
              <div className="min-w-0">
                <div className={`font-semibold ${t("text-[13px]", "text-[10px]")}`}>{o.name}</div>
                <div className={`text-[var(--muted)] ${t("text-[11px] leading-4", "text-[8px] leading-[13px]")}`}>{o.note}</div>
              </div>
              <span className={`shrink-0 border px-1 py-px font-mono font-bold uppercase tracking-[0.1em] ${t("text-[10px]", "text-[7px]")}`} style={{ color: o.constrained ? "#ef4444" : "#22c55e", borderColor: o.constrained ? "#ef4444" : "#22c55e" }}>
                {o.constrained ? "held" : "draining"}
              </span>
            </div>
          ))}
        </div>

        {/* What-if */}
        <div className="px-3 py-2">
          <div className={`flex items-center justify-between font-bold uppercase tracking-[0.14em] text-[var(--dim)] ${t("text-[11px]", "text-[8px]")}`}>
            <span className="flex items-center gap-1.5"><Droplets size={is4K ? 12 : 9} /> What-if water plane</span>
            <span className="font-mono text-[var(--ink)]">{whatIfLevel === 0 ? "off" : `+${whatIfLevel.toFixed(1)} m MSL`}</span>
          </div>
          <input type="range" min={0} max={8} step={0.5} value={whatIfLevel} onChange={(e) => onWhatIfLevel(parseFloat(e.target.value))} className="mt-1.5 h-1 w-full cursor-pointer accent-[#0ea5e9]" aria-label="What-if water level" />
          <div className={`mt-1 text-[var(--muted)] ${t("text-[11px] leading-4", "text-[8px] leading-[13px]")}`}>
            Paints every zone whose plain sits below this level. {whatIfLevel > 0 ? `${zones.filter((z) => z.elevationM <= whatIfLevel).length} of ${zones.length} zones under water.` : "Drag to see which parts of the city go under first."}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5">
        <div className={`uppercase tracking-[0.16em] text-[var(--dim)] ${t("text-[10px]", "text-[7px]")}`}>City channel {routing.cityChannelCapacity} m3/s · diversion 750 m3/s design (RID)</div>
      </div>
    </aside>
  );
}

"use client";

// Left bar — the water system as a schematic. Nodes run top to bottom
// from Khao Luang to the Gulf on a vertical rail; the Tha Ngiu split
// fans into three branches with their share of the flow. Every row
// carries the live sensor reading for that point on the route.

import { Mountain, Radio, TrendingDown, TrendingUp, Minus, Waves } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import { SkeletonRow } from "../Skeleton";
import type { Branch, NstNodeState, NstWatershedResponse, WaterStatus } from "../../types/nst";

export const STATUS_HEX: Record<WaterStatus, string> = {
  normal: "#22c55e",
  watch: "#f59e0b",
  warning: "#f97316",
  critical: "#ef4444",
};

function Trend({ t, size }: { t: NstNodeState["trend"]; size: number }) {
  if (t === "rising") return <TrendingUp size={size} className="text-[#ef4444]" />;
  if (t === "falling") return <TrendingDown size={size} className="text-[#22c55e]" />;
  return <Minus size={size} className="text-[var(--dim)]" />;
}

function metric(n: NstNodeState): { label: string; value: string } {
  switch (n.kind) {
    case "catchment":
      return { label: "RAIN 24H", value: n.rainfall24h !== null ? `${n.rainfall24h} mm` : "—" };
    case "outlet":
      return { label: "TIDE", value: n.waterLevelMsl !== null ? `${n.waterLevelMsl >= 0 ? "+" : ""}${n.waterLevelMsl} m` : "—" };
    case "gate":
      return { label: "PASSING", value: n.discharge !== null ? `${n.discharge} m3/s` : "—" };
    case "split":
      return { label: "FLOW", value: n.discharge !== null ? `${n.discharge} m3/s` : "—" };
    default:
      return {
        label: n.capacityPct !== null ? "BANK" : "FLOW",
        value: n.capacityPct !== null ? `${n.capacityPct}%` : n.discharge !== null ? `${n.discharge} m3/s` : "—",
      };
  }
}

function NodeRow({ n, is4K, last, onSelect }: { n: NstNodeState; is4K: boolean; last: boolean; onSelect: (n: NstNodeState) => void }) {
  const m = metric(n);
  const color = STATUS_HEX[n.status];
  return (
    <button type="button" onClick={() => onSelect(n)} className="flex w-full items-stretch text-left transition-colors hover:bg-[rgba(15,111,136,0.05)]">
      {/* rail */}
      <div className="relative flex w-7 shrink-0 flex-col items-center">
        <div className={`w-px flex-1 ${last ? "bg-transparent" : "bg-[var(--line-bright)]"}`} style={{ marginTop: 14 }} />
        <span
          className={`absolute top-2.5 ${n.kind === "outlet" || n.kind === "catchment" ? "h-3 w-3 rounded-full border-2" : n.kind === "gate" || n.kind === "split" ? "h-2.5 w-2.5 border-2" : "h-2.5 w-2.5 rounded-full"}`}
          style={{ background: n.kind === "outlet" || n.kind === "catchment" ? "var(--bg-surface)" : color, borderColor: color }}
        />
      </div>
      <div className="min-w-0 flex-1 border-b border-[var(--line)] py-1.5 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`truncate font-semibold text-[var(--ink)] ${is4K ? "text-[14px]" : "text-[10px]"}`}>{n.name}</div>
            <div className={`truncate uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`} lang="th">
              {n.nameTh} · {n.district}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className={`font-mono font-bold ${is4K ? "text-[14px]" : "text-[11px]"}`} style={{ color: n.status === "normal" ? "var(--ink)" : color }}>{m.value}</span>
            <span className={`flex items-center gap-1 uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>
              {m.label} <Trend t={n.trend} size={is4K ? 12 : 8} />
            </span>
          </div>
        </div>
        {n.capacityPct !== null && (
          <div className="mt-1 h-[3px] w-full border border-[var(--line)]">
            <div className="h-full" style={{ width: `${Math.min(100, n.capacityPct)}%`, background: color }} />
          </div>
        )}
        {(n.kind === "gate" || n.status !== "normal") && (
          <div className={`mt-1 leading-[13px] text-[var(--muted)] ${is4K ? "text-[11px] leading-4" : "text-[8px]"}`}>{n.note}</div>
        )}
      </div>
    </button>
  );
}

const BRANCH_META: Record<Exclude<Branch, "main">, { label: string; key: "north" | "city" | "south" }> = {
  north: { label: "North — Khlong Tha Sak", key: "north" },
  city: { label: "City — Khlong Pak Nakhon", key: "city" },
  south: { label: "South — RID diversion canal", key: "south" },
};

export default function WatershedSidebar({ data, onSelectNode }: { data: NstWatershedResponse | null; onSelectNode: (n: NstNodeState) => void }) {
  const is4K = useWarRoomScale();
  const onNet = (data?.nodes ?? []).filter((n) => n.onNetwork);
  const off = (data?.nodes ?? []).filter((n) => !n.onNetwork);
  const main = onNet.filter((n) => n.branch === "main").sort((a, b) => a.order - b.order);
  const branch = (b: Branch) => onNet.filter((n) => n.branch === b).sort((a, b2) => a.order - b2.order);

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves size={is4K ? 18 : 13} className="text-[var(--cool)]" />
            <div>
              <div className={`${is4K ? "text-[11px]" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-[var(--dim)]`}>Khao Luang to the Gulf</div>
              <div className={`${is4K ? "text-[18px]" : "text-[13px]"} font-bold tracking-[-0.02em]`}>Water system</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="live-badge">{data?.source === "live" ? "LIVE" : data?.source === "scenario" ? "SCENARIO" : "MODEL"}</span>
            {data && (
              <span className={`font-mono uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[7px]"}`}>
                {data.stationsReporting} sensors · {data.stationsWarning} warn+
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {!data && <div className="px-3 py-3"><SkeletonRow count={8} gap="14px" /></div>}
        {data && (
          <>
            <div className={`flex items-center gap-1.5 px-3 pt-2 pb-1 font-bold uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>
              <Mountain size={is4K ? 12 : 9} /> Main stem — Khlong Tha Di
            </div>
            {main.map((n) => <NodeRow key={n.id} n={n} is4K={is4K} last={false} onSelect={onSelectNode} />)}

            {(["city", "north", "south"] as const).map((b) => {
              const list = branch(b);
              const share = Math.round(data.routing.split[BRANCH_META[b].key] * 100);
              return (
                <div key={b}>
                  <div className={`flex items-center justify-between px-3 pt-2.5 pb-1 font-bold uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>
                    <span className="flex items-center gap-1.5"><Radio size={is4K ? 12 : 9} /> {BRANCH_META[b].label}</span>
                    <span className="font-mono text-[var(--cool)]">{share}% of flow</span>
                  </div>
                  {list.map((n, i) => <NodeRow key={n.id} n={n} is4K={is4K} last={i === list.length - 1} onSelect={onSelectNode} />)}
                </div>
              );
            })}

            {off.length > 0 && (
              <div>
                <div className={`px-3 pt-2.5 pb-1 font-bold uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>Other telemetry in province</div>
                {off.map((n, i) => <NodeRow key={n.id} n={n} is4K={is4K} last={i === off.length - 1} onSelect={onSelectNode} />)}
              </div>
            )}
          </>
        )}
      </div>

      {data && (
        <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5">
          <div className={`uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>{data.attribution}</div>
        </div>
      )}
    </aside>
  );
}

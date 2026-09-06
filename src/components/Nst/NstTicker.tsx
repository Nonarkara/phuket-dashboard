"use client";

import { useMemo } from "react";
import type { CctvFeedResponse, NstWatershedResponse } from "../../types/nst";

export default function NstTicker({ data, cctv }: { data: NstWatershedResponse | null; cctv: CctvFeedResponse | null }) {
  const items = useMemo(() => {
    const out: { text: string; color: string }[] = [];
    if (data) {
      const r = data.routing;
      out.push({ text: `SYSTEM ${r.posture.toUpperCase()} — ${r.headline}`, color: r.posture === "severe" ? "#ef4444" : r.posture === "elevated" ? "#f59e0b" : "var(--ink)" });
      for (const s of r.stages.filter((x) => x.state !== "clear")) out.push({ text: `${s.step}. ${s.title.toUpperCase()} · ${s.metric}${s.etaHours !== null ? ` · ETA ${s.etaHours} h` : ""}`, color: s.state === "alert" ? "#ef4444" : s.state === "active" ? "#f97316" : "#f59e0b" });
      for (const n of data.nodes.filter((x) => x.status === "critical" || x.status === "warning").slice(0, 5)) out.push({ text: `${n.status.toUpperCase()} · ${n.name}${n.capacityPct !== null ? ` ${n.capacityPct}% bank` : n.rainfall24h !== null ? ` ${n.rainfall24h} mm/24h` : ""}`, color: n.status === "critical" ? "#ef4444" : "#f59e0b" });
      for (const o of data.outlets.filter((x) => x.constrained)) out.push({ text: `OUTLET HELD · ${o.name} · tide ${o.tideState} +${o.seaLevelM} m`, color: "#f59e0b" });
    }
    if (cctv) out.push({ text: `CCTV ${cctv.liveCount} live / ${cctv.standbyCount} slots awaiting wiring`, color: "var(--ink)" });
    if (out.length === 0) out.push({ text: "Waiting for watershed telemetry…", color: "var(--dim)" });
    return out;
  }, [data, cctv]);

  const row = (k: string) => (
    <div className="flex shrink-0 items-center" aria-hidden={k === "b"}>
      {items.map((it, i) => (
        <span key={`${k}-${i}`} className="flex items-center whitespace-nowrap px-6 text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: it.color }}>
          <span className="mr-6 text-[var(--line-bright)]">{"///"}</span>{it.text}
        </span>
      ))}
    </div>
  );
  return (
    <div className="flex h-[30px] items-center overflow-hidden bg-[var(--bg-surface)]">
      <div className="flex animate-marquee">{row("a")}{row("b")}</div>
    </div>
  );
}

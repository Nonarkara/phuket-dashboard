"use client";

// Bottom signal ticker — same slot and marquee mechanics as the
// Phuket signal ticker. Streams flood telemetry, dam state, social
// alerts, and CCTV posture as one continuous line.

import { useMemo } from "react";
import type {
  CctvFeedResponse,
  LopburiFloodResponse,
  SocialListeningResponse,
} from "../../types/lopburi";

interface TickerItem {
  text: string;
  color: string;
}

export default function LopburiTicker({
  flood,
  social,
  cctv,
}: {
  flood: LopburiFloodResponse | null;
  social: SocialListeningResponse | null;
  cctv: CctvFeedResponse | null;
}) {
  const items = useMemo<TickerItem[]>(() => {
    const out: TickerItem[] = [];

    if (flood) {
      out.push({
        text: `BASIN ${flood.summary.basinPosture.toUpperCase()} — ${flood.summary.headline}`,
        color:
          flood.summary.basinPosture === "severe"
            ? "#ef4444"
            : flood.summary.basinPosture === "elevated"
              ? "#f59e0b"
              : "var(--ink)",
      });
      out.push({
        text: `PA SAK JOLASID ${flood.dam.storagePct}% (${flood.dam.storageMcm}/${flood.dam.capacityMcm} MCM) · release ${flood.dam.releaseMcm} MCM/d`,
        color: flood.dam.spillwayOpen ? "#f59e0b" : "var(--ink)",
      });
      for (const s of flood.stations.filter((x) => x.status === "critical" || x.status === "warning").slice(0, 4)) {
        out.push({
          text: `${s.status.toUpperCase()} · ${s.name} (${s.district}) ${s.bankLevelMsl > 0 ? `${s.capacityPct}% bank` : `${s.rainfall24h}mm/24h`}`,
          color: s.status === "critical" ? "#ef4444" : "#f59e0b",
        });
      }
    }

    if (social) {
      out.push({
        text: `SOCIAL ${social.counts.total} mentions · ${social.counts.negative} neg / ${social.counts.positive} pos · ${social.counts.alerts} alert`,
        color: social.counts.alerts > 0 ? "#f59e0b" : "var(--ink)",
      });
      for (const m of social.mentions.filter((x) => x.severity === "alert").slice(0, 3)) {
        out.push({ text: `${m.category} · ${m.title}`, color: "#ef4444" });
      }
    }

    if (cctv) {
      out.push({
        text: `CCTV ${cctv.liveCount} live / ${cctv.standbyCount} slots awaiting wiring`,
        color: "var(--ink)",
      });
    }

    if (out.length === 0) {
      out.push({ text: "Waiting for basin telemetry…", color: "var(--dim)" });
    }
    return out;
  }, [flood, social, cctv]);

  const row = (keyPrefix: string) => (
    <div className="flex shrink-0 items-center" aria-hidden={keyPrefix === "b"}>
      {items.map((item, i) => (
        <span key={`${keyPrefix}-${i}`} className="flex items-center whitespace-nowrap px-6 text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: item.color }}>
          <span className="mr-6 text-[var(--line-bright)]">{"///"}</span>
          {item.text}
        </span>
      ))}
    </div>
  );

  return (
    <div className="flex h-[30px] items-center overflow-hidden border-t-0 bg-[var(--bg-surface)]">
      <div className="flex animate-marquee">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

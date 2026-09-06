"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import type { CctvFeedResponse, NstWatershedResponse } from "../../types/nst";

function Clock({ is4K }: { is4K: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return (
    <div className={`font-mono tabular-nums text-[var(--ink)] ${is4K ? "text-[20px]" : "text-[13px]"}`}>
      {now ? now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Bangkok" }) : "--:--:--"}
      <span className={`ml-1.5 uppercase tracking-[0.14em] text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>ICT</span>
    </div>
  );
}

function Chip({ label, value, color, is4K }: { label: string; value: string; color?: string; is4K: boolean }) {
  return (
    <div className={`hidden shrink-0 flex-col justify-center border-l border-[var(--line)] px-3 md:flex ${is4K ? "min-w-[140px]" : ""}`}>
      <span className={`uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>{label}</span>
      <span className={`font-mono font-bold ${is4K ? "text-[15px]" : "text-[10px]"}`} style={{ color: color ?? "var(--ink)" }}>{value}</span>
    </div>
  );
}

export default function NstTopBar({ data, cctv, scenarioId, isDark, onToggleDark }: { data: NstWatershedResponse | null; cctv: CctvFeedResponse | null; scenarioId: string | null; isDark: boolean; onToggleDark: () => void }) {
  const is4K = useWarRoomScale();
  const r = data?.routing ?? null;
  const posture = r?.posture ?? null;
  const postureColor = posture === "severe" ? "#ef4444" : posture === "elevated" ? "#f59e0b" : "#22c55e";
  const tide = data?.outlets[0] ?? null;
  return (
    <header className="flex items-stretch border-b border-[var(--line)] bg-[var(--bg-surface)]">
      <div className={`flex min-w-0 flex-col justify-center px-3 py-2 ${is4K ? "pr-6" : ""}`}>
        <span className={`uppercase tracking-[0.22em] text-[var(--dim)] ${is4K ? "text-[11px]" : "text-[7px]"} font-bold`}>Nakhon Si Thammarat · watershed command</span>
        <h1 className={`truncate font-bold tracking-[-0.02em] text-[var(--ink)] ${is4K ? "text-[26px]" : "text-[16px]"}`}>NST Water War Room</h1>
      </div>
      <div className="min-w-0 flex-1" />
      <Chip label="Posture" value={posture ? posture.toUpperCase() : "—"} color={posture ? postureColor : undefined} is4K={is4K} />
      <Chip label="Catchment 24h" value={r ? `${r.catchmentRain24h} mm` : "—"} color={r && r.catchmentRain24h >= 90 ? "#ef4444" : undefined} is4K={is4K} />
      <Chip label="Tha Di" value={r ? `${r.thaDiDischarge} m3/s` : "—"} color={r && r.thaDiDischarge * r.split.city > r.cityChannelCapacity ? "#ef4444" : undefined} is4K={is4K} />
      <Chip label="City ETA" value={r?.cityEtaHours != null ? `${r.cityEtaHours} h` : "—"} color={r?.cityEtaHours != null ? "#ef4444" : undefined} is4K={is4K} />
      <Chip label="Outlet tide" value={tide ? `${tide.seaLevelM >= 0 ? "+" : ""}${tide.seaLevelM} m ${tide.tideState}` : "—"} color={tide?.constrained ? "#f59e0b" : undefined} is4K={is4K} />
      <Chip label="CCTV" value={cctv ? `${cctv.liveCount}/${cctv.slots.length}` : "—"} is4K={is4K} />
      <div className="flex items-center gap-3 border-l border-[var(--line)] px-3">
        <div className="flex flex-col items-end">
          <Clock is4K={is4K} />
          {scenarioId && <span className={`border border-[var(--cool)] px-1 py-px font-bold uppercase tracking-[0.12em] text-[var(--cool)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>scenario: {scenarioId}</span>}
        </div>
        <button type="button" onClick={onToggleDark} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="flex h-8 w-8 items-center justify-center border border-[var(--line)] text-[var(--dim)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]">
          {isDark ? <Sun size={is4K ? 18 : 13} /> : <Moon size={is4K ? 18 : 13} />}
        </button>
      </div>
    </header>
  );
}

"use client";

// CCTV slot strip — sits under the top bar, same slot as the Phuket
// ops control strip. Every card is a physical camera slot: wired slots
// render a refreshing snapshot; standby slots show wiring metadata so
// the integration path is visible on the wall.

import { useEffect, useState } from "react";
import { Cctv } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import { SkeletonStrip } from "../Skeleton";
import type { CctvFeedResponse, CctvSlot } from "../../types/lopburi";

function SlotCard({
  slot,
  tick,
  is4K,
  onSelect,
}: {
  slot: CctvSlot;
  tick: number;
  is4K: boolean;
  onSelect: (slot: CctvSlot) => void;
}) {
  const live = slot.status === "live" && slot.snapshotUrl;
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={`flex shrink-0 flex-col border border-[var(--line)] text-left transition-colors hover:border-[var(--line-bright)] ${
        is4K ? "w-[280px]" : "w-[172px]"
      }`}
      title={slot.wiring.note}
    >
      <div className={`relative w-full overflow-hidden bg-[var(--bg-raised)] ${is4K ? "h-[104px]" : "h-[64px]"}`}>
        {live ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${slot.snapshotUrl}${slot.snapshotUrl!.includes("?") ? "&" : "?"}t=${tick}`}
            alt={slot.label}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <Cctv size={is4K ? 22 : 14} className="text-[var(--dim)]" />
            <span className={`font-mono uppercase tracking-[0.18em] text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>
              slot — awaiting feed
            </span>
          </div>
        )}
        <span
          className={`absolute left-1 top-1 border px-1 py-px font-bold uppercase tracking-[0.12em] ${
            is4K ? "text-[9px]" : "text-[6px]"
          } ${live ? "border-[#ef4444] text-[#ef4444]" : "border-[var(--line-bright)] text-[var(--dim)]"}`}
          style={{ background: "var(--bg-surface)" }}
        >
          {live ? "LIVE" : slot.wiring.protocol.toUpperCase()}
        </span>
      </div>
      <div className="px-2 py-1">
        <div className={`truncate font-semibold text-[var(--ink)] ${is4K ? "text-[12px]" : "text-[8px]"}`}>
          {slot.label}
        </div>
        <div className={`truncate uppercase tracking-[0.12em] text-[var(--dim)] ${is4K ? "text-[9px]" : "text-[6px]"}`}>
          {slot.district} · {slot.wiring.owner}
        </div>
      </div>
    </button>
  );
}

export default function CctvStrip({
  feed,
  onSelectSlot,
}: {
  feed: CctvFeedResponse | null;
  onSelectSlot: (slot: CctvSlot) => void;
}) {
  const is4K = useWarRoomScale();
  const [tick, setTick] = useState(() => Date.now());

  // Refresh wired snapshots once a minute.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!feed) {
    return (
      <div className="border-b border-[var(--line)] bg-[var(--bg-surface)]">
        <SkeletonStrip />
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--line)] bg-[var(--bg-surface)]">
      <div className="flex items-stretch">
        <div className={`flex shrink-0 flex-col justify-center border-r border-[var(--line)] px-3 ${is4K ? "w-[190px]" : "w-[120px]"}`}>
          <div className={`flex items-center gap-1.5 font-bold uppercase tracking-[0.16em] text-[var(--dim)] ${is4K ? "text-[11px]" : "text-[7px]"}`}>
            <Cctv size={is4K ? 15 : 10} className="text-[var(--cool)]" /> CCTV grid
          </div>
          <div className={`mt-0.5 font-mono text-[var(--ink)] ${is4K ? "text-[15px]" : "text-[10px]"}`}>
            {feed.liveCount} live · {feed.standbyCount} slots
          </div>
        </div>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar px-1.5 py-1.5">
          {feed.slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} tick={tick} is4K={is4K} onSelect={onSelectSlot} />
          ))}
        </div>
      </div>
    </div>
  );
}

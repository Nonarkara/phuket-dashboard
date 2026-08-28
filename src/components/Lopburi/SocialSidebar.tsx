"use client";

// Left bar of the Lopburi war room — social listening stream.
// Same slot and format as the Phuket dashboard's news sidebar:
// header + LIVE badge, filter chips, feed cards, footer counts —
// with a sentiment split bar and trending-topic chips on top.

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Radio } from "lucide-react";
import { useWarRoomScale } from "../../hooks/useWarRoomScale";
import { SkeletonRow } from "../Skeleton";
import { buildScenarioUrl, fetchJsonOrNull } from "../../lib/client-requests";
import type {
  SocialChannel,
  SocialListeningResponse,
  SocialMention,
} from "../../types/lopburi";

type ChannelFilter = "all" | SocialChannel;

const CHANNEL_META: Record<SocialChannel, { label: string; flag: string; name: string }> = {
  "news-th": { label: "TH", flag: "🇹🇭", name: "Thai news mentions" },
  "news-en": { label: "EN", flag: "🌐", name: "English news mentions" },
  gdelt: { label: "GDELT", flag: "🛰️", name: "GDELT global media" },
};

function sentimentDot(m: SocialMention) {
  if (m.sentiment === "negative") return "bg-[#ef4444]";
  if (m.sentiment === "positive") return "bg-[#22c55e]";
  return "bg-[var(--dim)]";
}

function severityBorder(m: SocialMention) {
  if (m.severity === "alert") return "border-l-[#ef4444]";
  if (m.severity === "watch") return "border-l-[#f59e0b]";
  return "border-l-[var(--line)]";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MentionCard({ item, is4K }: { item: SocialMention; is4K: boolean }) {
  return (
    <article
      className={`border-l-2 ${severityBorder(item)} px-3 py-2 transition-colors hover:bg-[rgba(15,111,136,0.05)]`}
      style={{ background: item.severity === "alert" ? "rgba(239,68,68,0.06)" : "transparent" }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`shrink-0 ${is4K ? "text-[13px]" : "text-[10px]"}`} title={CHANNEL_META[item.channel].name}>
              {CHANNEL_META[item.channel].flag}
            </span>
            <span
              className={`shrink-0 rounded-full ${sentimentDot(item)} ${is4K ? "h-2.5 w-2.5" : "h-1.5 w-1.5"}`}
              title={`Sentiment: ${item.sentiment} (lexicon)`}
            />
            <span
              className={`${is4K ? "text-[9px] px-1.5 py-0.5" : "text-[7px] px-1 py-px"} font-bold uppercase tracking-[0.1em] border`}
              style={{ color: item.categoryColor, borderColor: item.categoryColor, opacity: 0.85 }}
            >
              {item.category}
            </span>
          </div>
          <div className={`mt-1 ${is4K ? "text-[14px]" : "text-[10px]"} font-semibold leading-4 text-[var(--ink)]`} lang={item.lang}>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--cool)] hover:underline underline-offset-2"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </div>
          <div className={`mt-1 flex flex-wrap items-center gap-2 ${is4K ? "text-[10px]" : "text-[7px]"} uppercase tracking-[0.16em] text-[var(--dim)]`}>
            <span>{item.source}</span>
            {item.publishedAt && <span className="font-mono">{formatTime(item.publishedAt)}</span>}
          </div>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[var(--dim)] hover:text-[var(--ink)]"
          >
            <ExternalLink size={is4K ? 14 : 9} />
          </a>
        )}
      </div>
    </article>
  );
}

export default function SocialSidebar({ scenarioId }: { scenarioId: string | null }) {
  const [data, setData] = useState<SocialListeningResponse | null>(null);
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [tick, setTick] = useState(0);
  const is4K = useWarRoomScale();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchJsonOrNull<SocialListeningResponse>(
        buildScenarioUrl("/api/lopburi/social", scenarioId),
      );
      if (!cancelled && next) setData(next);
    };
    void load();
    const interval = setInterval(() => void load(), 3 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scenarioId]);

  // Keep the relative-time labels fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const mentions = data?.mentions ?? [];
  const counts = data?.counts;
  const shown = filter === "all" ? mentions : mentions.filter((m) => m.channel === filter);
  const presentChannels = (Object.keys(CHANNEL_META) as SocialChannel[]).filter(
    (c) => (counts?.byChannel[c] ?? 0) > 0,
  );

  const total = counts?.total ?? 0;
  const pctPos = total > 0 ? Math.round(((counts?.positive ?? 0) / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round(((counts?.negative ?? 0) / total) * 100) : 0;
  const pctNeu = Math.max(0, 100 - pctPos - pctNeg);

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink)] select-none">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={is4K ? 18 : 13} className="text-[var(--cool)]" />
            <div>
              <div className={`${is4K ? "text-[11px]" : "text-[8px]"} font-bold uppercase tracking-[0.16em] text-[var(--dim)]`}>
                Lopburi mention stream
              </div>
              <div className={`${is4K ? "text-[18px]" : "text-[13px]"} font-bold tracking-[-0.02em] text-[var(--ink)]`}>
                Social listening
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="live-badge">{data?.source === "live" ? "LIVE" : data?.source === "scenario" ? "SCENARIO" : "MODEL"}</span>
            {data?.generatedAt && (
              <span className={`${is4K ? "text-[9px]" : "text-[7px]"} font-mono uppercase tracking-[0.16em] text-[var(--dim)]`}>
                updated {formatTime(data.generatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Sentiment split bar */}
        {counts && total > 0 && (
          <div className="mt-2">
            <div className="flex h-1.5 w-full overflow-hidden border border-[var(--line)]">
              <div style={{ width: `${pctPos}%` }} className="bg-[#22c55e]" />
              <div style={{ width: `${pctNeu}%` }} className="bg-[var(--line-bright)]" />
              <div style={{ width: `${pctNeg}%` }} className="bg-[#ef4444]" />
            </div>
            <div className={`mt-1 flex items-center justify-between font-mono uppercase tracking-wider text-[var(--dim)] ${is4K ? "text-[10px]" : "text-[7px]"}`}>
              <span className="text-[#22c55e]">{pctPos}% pos</span>
              <span>{pctNeu}% neutral</span>
              <span className="text-[#ef4444]">{pctNeg}% neg</span>
            </div>
          </div>
        )}

        {(counts?.alerts ?? 0) > 0 && (
          <div className={`mt-1.5 flex items-center gap-2 font-mono uppercase tracking-wider ${is4K ? "text-[10px]" : "text-[8px]"}`}>
            <span className="flex items-center gap-1 text-[#ef4444]">
              <AlertTriangle size={is4K ? 12 : 8} /> {counts?.alerts} alert
            </span>
          </div>
        )}

        {/* Trending topics */}
        {data && data.topTopics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.topTopics.map((t) => (
              <span
                key={t.label}
                className={`${is4K ? "text-[9px] px-1.5" : "text-[7px] px-1"} border py-px font-bold uppercase tracking-[0.1em]`}
                style={{ color: t.color, borderColor: t.color, opacity: 0.85 }}
              >
                {t.label} <span className="font-mono opacity-70">{t.count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Channel filter */}
        <div className="mt-2 flex flex-wrap gap-1">
          {(["all", ...presentChannels] as ChannelFilter[]).map((c) => {
            const active = filter === c;
            const n = c === "all" ? total : counts?.byChannel[c as SocialChannel] ?? 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                aria-pressed={active}
                className={`flex min-h-[28px] items-center gap-1 border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors duration-150 ease-out ${
                  active
                    ? "border-[var(--ink)] bg-[rgba(17,17,17,0.05)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                }`}
              >
                {c === "all" ? "ALL" : `${CHANNEL_META[c as SocialChannel].flag} ${CHANNEL_META[c as SocialChannel].label}`}
                <span className="font-mono opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mention feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {!data && (
          <div className="px-3 py-3">
            <SkeletonRow count={7} gap="14px" />
          </div>
        )}
        {data && shown.length === 0 && (
          <div className="flex h-full items-center justify-center px-3">
            <span className="text-[10px] text-[var(--muted)]">No mentions for selected channel</span>
          </div>
        )}
        <div className="divide-y divide-[var(--line)]">
          {shown.map((item, idx) => (
            <MentionCard key={`${item.id}-${idx}`} item={item} is4K={is4K} />
          ))}
        </div>
      </div>

      {/* Footer */}
      {data && (
        <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5">
          <div className={`${is4K ? "text-[10px]" : "text-[7px]"} uppercase tracking-[0.16em] text-[var(--dim)]`}>
            {total} mentions / {presentChannels.length} channels / sentiment: keyword lexicon
          </div>
        </div>
      )}
    </aside>
  );
}

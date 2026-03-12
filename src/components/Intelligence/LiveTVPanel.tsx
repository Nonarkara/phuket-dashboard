"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Tv, ExternalLink } from "lucide-react";

/**
 * Live TV channels from SE Asian countries.
 * Uses YouTube live stream embeds (muted by default).
 * Each has a speaker toggle for audio and an external link.
 */
interface TVChannel {
  country: string;
  code: string;
  name: string;
  /** YouTube permanent channel ID for live_stream embed */
  ytChannelId?: string;
  /** YouTube handle to scrape the live video ID from /streams (for channels that block channel embed) */
  ytHandle?: string;
  externalUrl: string;
  color: string;
}

const CHANNELS: TVChannel[] = [
  {
    country: "Thailand",
    code: "PBS",
    name: "Thai PBS News",
    ytHandle: "@ThaiPBSNews",
    externalUrl: "https://www.youtube.com/@ThaiPBSNews",
    color: "#38bdf8",
  },
  {
    country: "Thailand",
    code: "NBT",
    name: "NBT Connext",
    ytHandle: "@NBTConnext",
    externalUrl: "https://www.youtube.com/@NBTConnext",
    color: "#f59e0b",
  },
  {
    country: "Thailand",
    code: "TNN",
    name: "TNN Online",
    ytHandle: "@TNNOnline",
    externalUrl: "https://www.youtube.com/@TNNOnline",
    color: "#22c55e",
  },
  {
    country: "Thailand",
    code: "PPTV",
    name: "PPTV HD 36",
    ytHandle: "@PPTVHD36",
    externalUrl: "https://www.youtube.com/@PPTVHD36",
    color: "#a855f7",
  },
  {
    country: "Thailand",
    code: "NAT",
    name: "NationTV",
    ytHandle: "@NationTV22",
    externalUrl: "https://www.youtube.com/@NationTV22",
    color: "#ef4444",
  },
  {
    country: "Thailand",
    code: "AMR",
    name: "Amarin TV",
    ytHandle: "@AMARINTVHD",
    externalUrl: "https://www.youtube.com/@AMARINTVHD",
    color: "#f97316",
  },
];

function TVSlot({ channel }: { channel: TVChannel }) {
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [dynamicId, setDynamicId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // Lazy-load: only render iframe when visible
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (channel.ytHandle && !dynamicId) {
      fetch(`/api/live-tv?handle=${encodeURIComponent(channel.ytHandle)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.videoId) setDynamicId(data.videoId);
          else setError(true);
        })
        .catch(() => setError(true));
    }
  }, [visible, channel.ytHandle, dynamicId]);

  // Build YouTube resilient embed URL
  let embedUrl = "";
  const baseParams = "autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1&enablejsapi=1";
  
  if (channel.ytChannelId) {
    embedUrl = `https://www.youtube.com/embed/live_stream?channel=${channel.ytChannelId}&${baseParams}`;
  } else if (dynamicId) {
    embedUrl = `https://www.youtube.com/embed/${dynamicId}?${baseParams}`;
  }

  const toggleMute = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    
    // Toggle state
    const nextMuted = !muted;
    setMuted(nextMuted);
    
    // Send postMessage to YouTube iframe to mute/unmute without reloading the src
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: nextMuted ? "mute" : "unMute", args: [] }),
      "*"
    );
    
    // Also enforce play command just in case browser autoplay was initially blocked
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "*"
    );
  }, [muted]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col overflow-hidden rounded-md border border-[var(--line-bright)] bg-[var(--bg)]"
    >
      {/* Video area */}
      <div className="relative aspect-video w-full bg-black">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Tv size={16} className="text-[#ef4444]" />
            <span className="text-[9px] text-[var(--muted)]">Offline</span>
          </div>
        ) : visible && embedUrl ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`${channel.name} Live`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen={false}
            className="absolute inset-0 h-full w-full origin-center scale-[1.35] transform-gpu pointer-events-none"
            style={{ border: "none" }}
            onLoad={() => {
              setLoaded(true);
              // Force play when loaded
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  JSON.stringify({ event: "command", func: "playVideo", args: [] }),
                  "*"
                );
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Tv size={16} className="text-[var(--dim)]" />
          </div>
        )}

        {/* Loading state */}
        {visible && !loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="h-3 w-3 animate-spin rounded-full border border-[var(--cool)] border-t-transparent" />
          </div>
        )}

      </div>

      {/* Label bar */}
      <div className="flex items-center justify-between px-1.5 py-1 bg-[var(--bg-surface)]">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span
              className="text-[7px] font-bold uppercase tracking-[0.1em]"
              style={{ color: channel.color }}
            >
              {channel.code}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] truncate">
              {channel.name}
            </span>
          </div>
          <span className="flex items-center gap-0.5 mt-0.5">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#ef4444]" />
            <span className="text-[6px] font-bold uppercase tracking-[0.15em] text-[var(--dim)]">
              LIVE
            </span>
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--bg-raised)] text-[var(--ink)] transition-colors hover:bg-[var(--bg-surface)] hover:text-white border border-[var(--line-bright)]"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          <a
            href={channel.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--bg-raised)] text-[var(--ink)] transition-colors hover:bg-[var(--bg-surface)] hover:text-white border border-[var(--line-bright)]"
            title="Open Stream"
          >
            <ExternalLink size={9} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LiveTVPanel() {
  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-3 overflow-visible">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Tv size={12} className="text-[var(--cool)]" />
          <div className="eyebrow">Thailand / south</div>
        </div>
        <span className="text-[7px] font-mono uppercase tracking-[0.12em] text-[var(--dim)]">
          6 channels
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {CHANNELS.map((ch) => (
          <TVSlot key={ch.code} channel={ch} />
        ))}
      </div>

      <div className="mt-1 text-[7px] font-mono tracking-[0.1em] text-[var(--dim)]">
        Source: YouTube Live feeds with strong Phuket and southern Thailand coverage
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, Tv, Volume2, VolumeX } from "lucide-react";
import { findCorridorById } from "../../lib/governor-config";
import { LIVE_TV_CHANNELS } from "../../lib/live-tv-channels";
import type { PublicCameraResponse } from "../../types/dashboard";

interface LiveTVPanelProps {
  cameraPayload: PublicCameraResponse | null;
  selectedCorridorId: string;
}

function TVSlot({
  channelId,
  channelName,
  channelHandle,
  channelColor,
  externalUrl,
}: {
  channelId?: string;
  channelName: string;
  channelHandle?: string;
  channelColor: string;
  externalUrl: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [dynamicId, setDynamicId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (channelHandle && !dynamicId) {
      fetch(`/api/live-tv?handle=${encodeURIComponent(channelHandle)}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.videoId) {
            setDynamicId(data.videoId);
            return;
          }

          setError(true);
        })
        .catch(() => setError(true));
    }
  }, [channelHandle, dynamicId]);

  const embedUrl = channelId
    ? `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`
    : dynamicId
      ? `https://www.youtube.com/embed/${dynamicId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`
      : "";

  return (
    <div className="border border-[var(--line)] bg-[var(--bg)]">
      <div className="relative aspect-video w-full bg-black">
        {error || !embedUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Tv size={14} className="text-[var(--dim)]" />
            <span className="text-[9px] text-[var(--muted)]">TV source loading</span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={channelName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            style={{ border: "none" }}
            onLoad={() => {
              setLoaded(true);
            }}
          />
        )}

        {!loaded && !error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-2 py-1.5">
        <div>
          <div
            className="text-[8px] font-bold uppercase tracking-[0.16em]"
            style={{ color: channelColor }}
          >
            {channelName}
          </div>
          <div className="text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
            Live wall
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({
                  event: "command",
                  func: nextMuted ? "mute" : "unMute",
                  args: [],
                }),
                "*",
              );
            }}
            className="flex h-6 w-6 items-center justify-center border border-[var(--line)] text-[var(--ink)]"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-6 w-6 items-center justify-center border border-[var(--line)] text-[var(--ink)]"
            title="Open channel"
          >
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LiveTVPanel({
  cameraPayload,
  selectedCorridorId,
}: LiveTVPanelProps) {
  const corridor = findCorridorById(selectedCorridorId);
  const allCameras = cameraPayload?.cameras ?? [];
  const corridorCameras = allCameras.filter((camera) =>
    camera.corridorIds?.includes(selectedCorridorId),
  );
  const featuredCameras = corridorCameras.length > 0 ? corridorCameras : allCameras;
  const verifiedCameras = featuredCameras.filter(
    (camera) => camera.validationState === "verified",
  );
  const scoutCameras = featuredCameras.filter(
    (camera) => camera.validationState === "candidate",
  );

  return (
    <section className="flex h-full flex-col bg-[var(--bg-surface)] p-3 overflow-hidden">
      <div className="flex items-center justify-between gap-3 pb-2">
        <div>
          <div className="eyebrow">Visual confirmation</div>
          <div className="pt-0.5 text-[13px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {corridor?.label ?? "Governor feed mix"}
          </div>
        </div>
        <div className="text-right text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
          {verifiedCameras.length} verified / {scoutCameras.length} scout
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-2">
          {LIVE_TV_CHANNELS.slice(0, 2).map((channel) => (
            <TVSlot
              key={channel.code}
              channelId={channel.ytChannelId}
              channelName={channel.name}
              channelHandle={channel.ytHandle}
              channelColor={channel.color}
              externalUrl={channel.externalUrl}
            />
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto border border-[var(--line)] bg-[var(--bg)]">
          <div className="border-b border-[var(--line)] px-3 py-2">
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Camera stack
            </div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {featuredCameras.slice(0, 6).map((camera) => (
              <div key={camera.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold text-[var(--ink)]">
                      {camera.label}
                    </div>
                    <div className="pt-0.5 flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                      <MapPin size={8} />
                      {camera.locationLabel}
                    </div>
                  </div>
                  <span
                    className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em] ${
                      camera.validationState === "verified"
                        ? "border-[var(--cool)] bg-[rgba(15,111,136,0.08)] text-[var(--cool)]"
                        : "border-[var(--line)] bg-[rgba(17,17,17,0.03)] text-[var(--dim)]"
                    }`}
                  >
                    {camera.validationState}
                  </span>
                </div>
                <p className="pt-1 text-[9px] leading-4 text-[var(--muted)]">
                  {camera.strategicNote}
                </p>

                {camera.accessUrl ? (
                  <a
                    href={camera.accessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 border border-[var(--line)] px-2 py-1 text-[8px] uppercase tracking-[0.16em] text-[var(--ink)]"
                  >
                    Open feed
                    <ExternalLink size={9} />
                  </a>
                ) : (
                  <div className="mt-2 text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
                    {camera.candidateSourceNote ?? "Candidate source pending validation"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ShowcaseCorridorStory,
  ShowcaseLensState,
} from "../../types/dashboard";

interface ShowcaseScrollStoryProps {
  corridors: ShowcaseCorridorStory[];
  lenses: ShowcaseLensState[];
}

const STATUS_CLASS_MAP = {
  intervene: "border-[#ef4444] bg-[rgba(239,68,68,0.14)] text-[#ef4444]",
  watch: "border-[#f59e0b] bg-[rgba(245,158,11,0.14)] text-[#9a5b00]",
  stable: "border-[rgba(15,111,136,0.28)] bg-[rgba(15,111,136,0.12)] text-[var(--cool)]",
} as const;

export default function ShowcaseScrollStory({
  corridors,
  lenses,
}: ShowcaseScrollStoryProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(corridors[0]?.id ?? "");

  const activeCorridor = useMemo(
    () => corridors.find((corridor) => corridor.id === activeId) ?? corridors[0],
    [activeId, corridors],
  );

  useEffect(() => {
    if (!rootRef.current || corridors.length === 0) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let mounted = true;
    let cleanup = () => {};

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (!mounted || !rootRef.current) {
          return;
        }

        const gsap = gsapModule.gsap;
        const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          gsap.fromTo(
            "[data-story-stage]",
            { opacity: 0.68, y: 28 },
            { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" },
          );

          rootRef.current
            ?.querySelectorAll<HTMLElement>("[data-story-step]")
            .forEach((step, index) => {
              const corridor = corridors[index];

              gsap.fromTo(
                step,
                { opacity: 0.3, y: 24 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.7,
                  ease: "power2.out",
                  scrollTrigger: {
                    trigger: step,
                    start: "top 82%",
                  },
                },
              );

              ScrollTrigger.create({
                trigger: step,
                start: "top center+=100",
                end: "bottom center",
                onEnter: () => setActiveId(corridor.id),
                onEnterBack: () => setActiveId(corridor.id),
              });
            });
        }, rootRef);

        cleanup = () => ctx.revert();
      },
    );

    return () => {
      mounted = false;
      cleanup();
    };
  }, [corridors]);

  if (!activeCorridor) {
    return null;
  }

  const connectionPoints = corridors
    .map((corridor) => `${corridor.mapPosition.x},${corridor.mapPosition.y}`)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start"
    >
      <ol className="space-y-8 lg:space-y-16">
        {corridors.map((corridor, index) => {
          const isActive = corridor.id === activeCorridor.id;
          return (
            <li
              key={corridor.id}
              data-story-step
              className={`border px-5 py-5 transition-colors duration-300 ${
                isActive
                  ? "border-[var(--ink)] bg-[rgba(255,247,230,0.88)]"
                  : "border-[rgba(17,17,17,0.1)] bg-[rgba(255,255,255,0.68)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--dim)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-[var(--ink)] [font-family:var(--font-display)]">
                    {corridor.label}
                  </h3>
                </div>
                <div
                  className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${
                    STATUS_CLASS_MAP[corridor.status]
                  }`}
                >
                  {corridor.lensId}
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-7 text-[var(--muted)]">
                {corridor.summary}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[rgba(17,17,17,0.1)] bg-[rgba(255,255,255,0.68)] px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                    Signal
                  </div>
                  <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
                    {corridor.signalValue}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
                    {corridor.signalLabel}
                  </div>
                </div>
                <div className="border border-[rgba(17,17,17,0.1)] bg-[rgba(255,255,255,0.68)] px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                    Action
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--ink)]">
                    {corridor.action}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        data-story-stage
        className="top-24 space-y-5 lg:sticky"
      >
        <div className="overflow-hidden border border-[rgba(17,17,17,0.12)] bg-[linear-gradient(160deg,rgba(6,15,28,0.98),rgba(10,30,48,0.94)_55%,rgba(24,68,83,0.88))] px-6 py-6 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {lenses.map((lens) => {
              const active = lens.id === activeCorridor.lensId;
              return (
                <div
                  key={lens.id}
                  className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    active
                      ? "border-white bg-white text-[#081424]"
                      : "border-white/25 text-white/70"
                  }`}
                >
                  {lens.label}
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/60">
                Active corridor
              </div>
              <h3 className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.05em] [font-family:var(--font-display)]">
                {activeCorridor.label}
              </h3>
              <p className="mt-4 max-w-[36ch] text-[14px] leading-7 text-white/74">
                {activeCorridor.summary}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/16 bg-white/6 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/56">
                    Signal
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-white">
                    {activeCorridor.signalValue}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/56">
                    {activeCorridor.signalLabel}
                  </div>
                </div>
                <div className="border border-white/16 bg-white/6 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/56">
                    Focus areas
                  </div>
                  <div className="mt-2 text-[14px] leading-6 text-white/82">
                    {activeCorridor.focusAreas.join(" / ")}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%),rgba(255,255,255,0.04)] px-4 py-4">
              <svg
                viewBox="0 0 100 100"
                className="h-[320px] w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="corridor-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,223,166,1)" />
                    <stop offset="100%" stopColor="rgba(87,220,208,1)" />
                  </linearGradient>
                </defs>

                <path
                  d="M14 20C22 16 30 12 40 16C51 20 57 28 66 32C78 37 84 45 88 57C92 69 84 82 72 84C59 86 49 82 39 75C29 68 18 57 15 44C13 36 9 26 14 20Z"
                  fill="rgba(255,255,255,0.06)"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="0.8"
                />
                <polyline
                  points={connectionPoints}
                  fill="none"
                  stroke="url(#corridor-glow)"
                  strokeOpacity="0.65"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {corridors.map((corridor) => {
                  const active = corridor.id === activeCorridor.id;
                  return (
                    <g
                      key={corridor.id}
                      transform={`translate(${corridor.mapPosition.x} ${corridor.mapPosition.y})`}
                    >
                      <circle
                        r={active ? 7.5 : 4.7}
                        fill={active ? "rgba(255,223,166,0.24)" : "rgba(255,255,255,0.08)"}
                        stroke={active ? "#ffdfa6" : "rgba(255,255,255,0.24)"}
                        strokeWidth={active ? 1.4 : 1}
                      />
                      <circle
                        r={active ? 2.4 : 1.9}
                        fill={active ? "#ffdfa6" : "#9fe1db"}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {lenses.map((lens) => {
            const active = lens.id === activeCorridor.lensId;
            return (
              <div
                key={lens.id}
                className={`border px-4 py-4 transition-colors duration-300 ${
                  active
                    ? "border-[var(--ink)] bg-[rgba(255,248,235,0.92)]"
                    : "border-[rgba(17,17,17,0.1)] bg-[rgba(255,255,255,0.72)]"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                  {lens.label}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                  {lens.summary}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

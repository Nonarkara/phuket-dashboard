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

          const polyline = rootRef.current?.querySelector("polyline");
          if (polyline) {
            const length = (polyline as SVGPolylineElement).getTotalLength();
            gsap.set(polyline, { strokeDasharray: length, strokeDashoffset: length });
            gsap.to(polyline, {
              strokeDashoffset: 0,
              duration: 2.4,
              ease: "power2.inOut",
              scrollTrigger: { trigger: polyline, start: "top 80%" },
            });
          }

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
      <ol className="space-y-4 lg:space-y-6">
        {corridors.map((corridor, index) => {
          const isActive = corridor.id === activeCorridor.id;
          return (
            <li
              key={corridor.id}
              data-story-step
              className={`border px-4 py-4 transition-colors duration-300 backdrop-blur-sm ${
                isActive
                  ? "border-[var(--cool)] bg-[var(--panel-strong)]"
                  : "border-[var(--line)] bg-[var(--panel)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--dim)] [font-family:var(--font-mono)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
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
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                {corridor.summary}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                    Signal
                  </div>
                  <div className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[var(--ink)] [font-family:var(--font-mono)]">
                    {corridor.signalValue}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--dim)]">
                    {corridor.signalLabel}
                  </div>
                </div>
                <div className="border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                    Action
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--ink)]">
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
        className="top-24 space-y-4 lg:sticky"
      >
        <div className="overflow-hidden border border-[var(--line-bright)] bg-[var(--ink)] px-5 py-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {lenses.map((lens) => {
              const active = lens.id === activeCorridor.lensId;
              return (
                <div
                  key={lens.id}
                  className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    active
                      ? "border-[var(--cool)] bg-[var(--cool)] text-white"
                      : "border-white/20 text-white/60"
                  }`}
                >
                  {lens.label}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                Active corridor
              </div>
              <h3 className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
                {activeCorridor.label}
              </h3>
              <p className="mt-3 max-w-[36ch] text-[13px] leading-6 text-white/70">
                {activeCorridor.summary}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/12 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    Signal
                  </div>
                  <div className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em] text-white [font-family:var(--font-mono)]">
                    {activeCorridor.signalValue}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
                    {activeCorridor.signalLabel}
                  </div>
                </div>
                <div className="border border-white/12 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    Focus areas
                  </div>
                  <div className="mt-1.5 text-[13px] leading-5 text-white/80">
                    {activeCorridor.focusAreas.join(" / ")}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-white/3 px-4 py-4">
              <svg
                viewBox="0 0 100 100"
                className="h-[280px] w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="corridor-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(15,111,136,1)" />
                    <stop offset="100%" stopColor="rgba(87,220,208,1)" />
                  </linearGradient>
                </defs>

                <path
                  d="M14 20C22 16 30 12 40 16C51 20 57 28 66 32C78 37 84 45 88 57C92 69 84 82 72 84C59 86 49 82 39 75C29 68 18 57 15 44C13 36 9 26 14 20Z"
                  fill="rgba(255,255,255,0.04)"
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="0.8"
                />
                <polyline
                  points={connectionPoints}
                  fill="none"
                  stroke="url(#corridor-glow)"
                  strokeOpacity="0.6"
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
                        r={active ? 7 : 4.5}
                        fill={active ? "rgba(15,111,136,0.3)" : "rgba(255,255,255,0.06)"}
                        stroke={active ? "var(--cool)" : "rgba(255,255,255,0.20)"}
                        strokeWidth={active ? 1.4 : 1}
                      />
                      <circle
                        r={active ? 2.2 : 1.8}
                        fill={active ? "#57dcd0" : "rgba(255,255,255,0.40)"}
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
                className={`border px-4 py-3 transition-colors duration-300 backdrop-blur-sm ${
                  active
                    ? "border-[var(--cool)] bg-[var(--panel-strong)]"
                    : "border-[var(--line)] bg-[var(--panel)]"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
                  {lens.label}
                </div>
                <p className="mt-1.5 text-[12px] leading-5 text-[var(--muted)]">
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

"use client";

// Lopburi war room shell — same format as the Phuket WarRoomApp:
//   TopBar
//   CctvStrip (slot wiring row)
//   [ SocialSidebar 260px | LopburiMap flex-1 | FloodOpsPanel 360px ]
//   LopburiTicker
// Sidebars hidden below xl; mobile stacks map + tabbed panels.

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDarkMode } from "../../hooks/useDarkMode";
import {
  buildScenarioUrl,
  fetchJsonOrNull,
  isAbortError,
} from "../../lib/client-requests";
import type {
  CctvFeedResponse,
  CctvSlot,
  LopburiFloodResponse,
  SocialListeningResponse,
} from "../../types/lopburi";
import SocialSidebar from "./SocialSidebar";
import FloodOpsPanel from "./FloodOpsPanel";
import CctvStrip from "../Province/CctvStrip";
import LopburiTopBar from "./LopburiTopBar";
import LopburiTicker from "./LopburiTicker";
import LopburiMap from "./LopburiMap";

export default function LopburiApp() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  return (
    <>
      <Suspense fallback={null}>
        <ScenarioParamBridge onScenarioChange={setScenarioId} />
      </Suspense>
      <LopburiShell scenarioId={scenarioId} />
    </>
  );
}

function ScenarioParamBridge({
  onScenarioChange,
}: {
  onScenarioChange: (scenarioId: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");

  useEffect(() => {
    onScenarioChange(scenarioId);
  }, [onScenarioChange, scenarioId]);

  return null;
}

function LopburiShell({ scenarioId }: { scenarioId: string | null }) {
  const [isDark, toggleDark] = useDarkMode();
  const [flood, setFlood] = useState<LopburiFloodResponse | null>(null);
  const [social, setSocial] = useState<SocialListeningResponse | null>(null);
  const [cctv, setCctv] = useState<CctvFeedResponse | null>(null);
  const [mobileTab, setMobileTab] = useState<"flood" | "social">("flood");
  const [selectedCorridorId, setSelectedCorridorId] = useState("old-town");
  const [stripCamera, setStripCamera] = useState<CctvSlot | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const requestId = ++requestIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const [nextFlood, nextCctv] = await Promise.all([
          fetchJsonOrNull<LopburiFloodResponse>(
            buildScenarioUrl("/api/lopburi/flood", scenarioId),
            { signal: controller.signal },
          ),
          fetchJsonOrNull<CctvFeedResponse>("/api/lopburi/cctv", {
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (nextFlood) setFlood(nextFlood);
        if (nextCctv) setCctv(nextCctv);
      } catch (error) {
        if (isAbortError(error)) return;
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 60 * 1000);
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  // Social payload is also polled by the sidebar; this copy feeds the
  // top bar chips and the ticker.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchJsonOrNull<SocialListeningResponse>(
        buildScenarioUrl("/api/lopburi/social", scenarioId),
      );
      if (!cancelled && next) setSocial(next);
    };
    void load();
    const interval = window.setInterval(() => void load(), 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-surface="phuket-dashboard"
      className="relative flex min-h-[100dvh] w-screen flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--ink)] xl:h-[100dvh] xl:overflow-hidden"
    >
      <LopburiTopBar
        flood={flood}
        social={social}
        cctv={cctv}
        scenarioId={scenarioId}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <CctvStrip feed={cctv} onSelectSlot={setStripCamera} />

      <section className="relative flex min-h-0 flex-none overflow-hidden border-t border-[var(--line)] xl:flex-1">
        <aside
          aria-label="Social listening stream"
          className="hidden w-[260px] shrink-0 xl:block 2xl:w-[300px] min-[3000px]:w-[520px]"
        >
          <SocialSidebar scenarioId={scenarioId} />
        </aside>

        <section
          aria-label="Operational map"
          className="relative h-[44dvh] min-h-[330px] min-w-0 flex-none overflow-hidden sm:h-[48dvh] sm:min-h-[380px] xl:h-auto xl:min-h-0 xl:flex-1"
        >
          <LopburiMap
            flood={flood}
            cameras={cctv?.slots ?? []}
            selectedCorridorId={selectedCorridorId}
            onCorridorSelect={setSelectedCorridorId}
            externalCameraSelection={stripCamera}
            onClearExternalCamera={() => setStripCamera(null)}
          />
        </section>

        <aside
          aria-label="FloodDash operations desk"
          className="hidden w-[360px] shrink-0 xl:block 2xl:w-[420px] min-[3000px]:w-[520px]"
        >
          <FloodOpsPanel data={flood} />
        </aside>
      </section>

      {/* Mobile stack */}
      <section
        aria-label="Mobile intelligence stack"
        className="flex h-[68dvh] min-h-[560px] max-h-[760px] flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--bg-raised)] xl:hidden"
      >
        <div
          role="tablist"
          aria-label="Switch panel"
          className="flex shrink-0 border-b border-[var(--line)] bg-[var(--bg-raised)]"
        >
          {(
            [
              { id: "flood", label: "FloodDash" },
              { id: "social", label: "Social" },
            ] as const
          ).map((tab, i) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                i === 0 ? "border-r border-[var(--line)]" : ""
              } ${
                mobileTab === tab.id
                  ? "bg-[var(--bg-raised)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mobileTab === tab.id ? "bg-[var(--cool)]" : "bg-[var(--line)]"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--bg-raised)]">
          {mobileTab === "flood" ? (
            <FloodOpsPanel data={flood} />
          ) : (
            <SocialSidebar scenarioId={scenarioId} />
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-50 shrink-0 border-t border-[var(--line)] xl:static">
        <LopburiTicker flood={flood} social={social} cctv={cctv} />
      </div>
    </main>
  );
}

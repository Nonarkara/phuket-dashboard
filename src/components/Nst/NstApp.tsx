"use client";

// NST water war room shell — same grammar as Phuket / Lopburi:
//   NstTopBar
//   CctvStrip (water control-point cameras)
//   [ WatershedSidebar 260px | NstMap flex-1 | FlowRoutingPanel 360px ]
//   NstTicker

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDarkMode } from "../../hooks/useDarkMode";
import { buildScenarioUrl, fetchJsonOrNull, isAbortError } from "../../lib/client-requests";
import type { CctvFeedResponse, NstWatershedResponse } from "../../types/nst";
import CctvStrip from "../Province/CctvStrip";
import WatershedSidebar from "./WatershedSidebar";
import FlowRoutingPanel from "./FlowRoutingPanel";
import NstTopBar from "./NstTopBar";
import NstTicker from "./NstTicker";
import NstMap, { type MapSelection } from "./NstMap";

export default function NstApp() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  return (
    <>
      <Suspense fallback={null}><ScenarioParamBridge onScenarioChange={setScenarioId} /></Suspense>
      <NstShell scenarioId={scenarioId} />
    </>
  );
}

function ScenarioParamBridge({ onScenarioChange }: { onScenarioChange: (s: string | null) => void }) {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  useEffect(() => { onScenarioChange(scenarioId); }, [onScenarioChange, scenarioId]);
  return null;
}

function NstShell({ scenarioId }: { scenarioId: string | null }) {
  const [isDark, toggleDark] = useDarkMode();
  const [data, setData] = useState<NstWatershedResponse | null>(null);
  const [cctv, setCctv] = useState<CctvFeedResponse | null>(null);
  const [mobileTab, setMobileTab] = useState<"routing" | "system">("routing");
  const [selectedCorridorId, setSelectedCorridorId] = useState("whole-system");
  const [whatIfLevel, setWhatIfLevel] = useState(0);
  const [external, setExternal] = useState<MapSelection | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const requestId = ++requestIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const [next, nextCctv] = await Promise.all([
          fetchJsonOrNull<NstWatershedResponse>(buildScenarioUrl("/api/nst/watershed", scenarioId), { signal: controller.signal }),
          fetchJsonOrNull<CctvFeedResponse>("/api/nst/cctv", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (next) setData(next);
        if (nextCctv) setCctv(nextCctv);
      } catch (error) {
        if (isAbortError(error)) return;
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60 * 1000);
    return () => { requestIdRef.current += 1; controllerRef.current?.abort(); controllerRef.current = null; window.clearInterval(interval); };
  }, [scenarioId]);

  const tabBtn = (id: "routing" | "system", label: string, first: boolean) => (
    <button key={id} type="button" role="tab" aria-selected={mobileTab === id} onClick={() => setMobileTab(id)}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${first ? "border-r border-[var(--line)]" : ""} ${mobileTab === id ? "bg-[var(--bg-raised)] text-[var(--ink)]" : "text-[var(--dim)] hover:text-[var(--ink)]"}`}>
      {label}<span className={`h-1.5 w-1.5 rounded-full ${mobileTab === id ? "bg-[var(--cool)]" : "bg-[var(--line)]"}`} />
    </button>
  );

  return (
    <main id="main-content" tabIndex={-1} data-surface="phuket-dashboard" className="relative flex min-h-[100dvh] w-screen flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--ink)] xl:h-[100dvh] xl:overflow-hidden">
      <NstTopBar data={data} cctv={cctv} scenarioId={scenarioId} isDark={isDark} onToggleDark={toggleDark} />
      <CctvStrip feed={cctv} onSelectSlot={(camera) => setExternal({ kind: "camera", camera })} />

      <section className="relative flex min-h-0 flex-none overflow-hidden border-t border-[var(--line)] xl:flex-1">
        <aside aria-label="Water system schematic" className="hidden w-[260px] shrink-0 xl:block 2xl:w-[300px] min-[3000px]:w-[520px]">
          <WatershedSidebar data={data} onSelectNode={(node) => setExternal({ kind: "node", node })} />
        </aside>
        <section aria-label="Operational map" className="relative h-[44dvh] min-h-[330px] min-w-0 flex-none overflow-hidden sm:h-[48dvh] sm:min-h-[380px] xl:h-auto xl:min-h-0 xl:flex-1">
          <NstMap data={data} cameras={cctv?.slots ?? []} selectedCorridorId={selectedCorridorId} onCorridorSelect={setSelectedCorridorId} whatIfLevel={whatIfLevel} externalSelection={external} onClearExternalSelection={() => setExternal(null)} />
        </section>
        <aside aria-label="Where the water goes" className="hidden w-[360px] shrink-0 xl:block 2xl:w-[420px] min-[3000px]:w-[520px]">
          <FlowRoutingPanel data={data} whatIfLevel={whatIfLevel} onWhatIfLevel={setWhatIfLevel} onSelectZone={(zone) => setExternal({ kind: "zone", zone })} />
        </aside>
      </section>

      <section aria-label="Mobile intelligence stack" className="flex h-[68dvh] min-h-[560px] max-h-[760px] flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--bg-raised)] xl:hidden">
        <div role="tablist" aria-label="Switch panel" className="flex shrink-0 border-b border-[var(--line)] bg-[var(--bg-raised)]">
          {tabBtn("routing", "Where it goes", true)}{tabBtn("system", "Water system", false)}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--bg-raised)]">
          {mobileTab === "routing"
            ? <FlowRoutingPanel data={data} whatIfLevel={whatIfLevel} onWhatIfLevel={setWhatIfLevel} onSelectZone={(zone) => setExternal({ kind: "zone", zone })} />
            : <WatershedSidebar data={data} onSelectNode={(node) => setExternal({ kind: "node", node })} />}
        </div>
      </section>

      <div className="sticky bottom-0 z-50 shrink-0 border-t border-[var(--line)] xl:static"><NstTicker data={data} cctv={cctv} /></div>
    </main>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardArchitectureModal from "../Intelligence/DashboardArchitectureModal";
import DatabaseExplorerModal from "../Intelligence/DatabaseExplorerModal";
import DashboardManualModal from "../Intelligence/DashboardManualModal";
import OperationsPanel from "../Intelligence/OperationsPanel";
import OpsControlStrip from "../Intelligence/OpsControlStrip";
import SignalTicker from "../Intelligence/SignalTicker";
import TopBar from "../Intelligence/TopBar";
import ProvinceDashboard from "../Analytics/ProvinceDashboard";
import BorderMap from "../Map/BorderMap";
import NewsSidebar from "../Intelligence/NewsSidebar";
import ModuleSelector from "../Modules/ModuleSelector";
import { useDarkMode } from "../../hooks/useDarkMode";
import {
  buildScenarioUrl,
  fetchJsonOrNull,
  isAbortError,
} from "../../lib/client-requests";
import {
  glanceLangFromParam,
  glancePresentation,
  type GlanceLang,
  type OperatorGlance,
} from "../../lib/phone-glance";
import type {
  CityVibesResponse,
  DisasterFeedResponse,
  GovernorBrief,
  MaritimeSecurityResponse,
  MarineStatusResponse,
  MediaWatchResponse,
  OperationsDashboardResponse,
  PhuketVisitorOriginsResponse,
  ProvinceSelection,
  PublicCameraResponse,
  TourismHotspotsResponse,
} from "../../types/dashboard";

export default function WarRoomApp() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [glanceLang, setGlanceLang] = useState<GlanceLang>("en");

  return (
    <>
      <Suspense fallback={null}>
        <ScenarioParamBridge onScenarioChange={setScenarioId} onLangChange={setGlanceLang} />
      </Suspense>
      <WarRoomShell scenarioId={scenarioId} glanceLang={glanceLang} />
    </>
  );
}

function ScenarioParamBridge({
  onScenarioChange,
  onLangChange,
}: {
  onScenarioChange: (scenarioId: string | null) => void;
  onLangChange: (lang: GlanceLang) => void;
}) {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  const lang = glanceLangFromParam(searchParams.get("lang")) ?? "en";

  useEffect(() => {
    onScenarioChange(scenarioId);
  }, [onScenarioChange, scenarioId]);

  useEffect(() => {
    onLangChange(lang);
    document.documentElement.lang = lang;
  }, [lang, onLangChange]);

  return null;
}

function WarRoomShell({
  scenarioId,
  glanceLang,
}: {
  scenarioId: string | null;
  glanceLang: GlanceLang;
}) {
  const [isDark, toggleDark] = useDarkMode();
  const [selectedProvince, setSelectedProvince] =
    useState<ProvinceSelection | null>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState("airport-patong");
  const [mobileSheet, setMobileSheet] = useState<"brief" | "news" | null>(null);
  const [operatorGlance, setOperatorGlance] = useState<OperatorGlance | null>(null);
  const sheetPushedRef = useRef(false);
  const mobileSheetRef = useRef<"brief" | "news" | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isDataExplorerOpen, setIsDataExplorerOpen] = useState(false);
  const [isModuleSelectorOpen, setIsModuleSelectorOpen] = useState(false);
  const [brief, setBrief] = useState<GovernorBrief | null>(null);
  const [disaster, setDisaster] = useState<DisasterFeedResponse | null>(null);
  const [maritimeSecurity, setMaritimeSecurity] =
    useState<MaritimeSecurityResponse | null>(null);
  const [marine, setMarine] = useState<MarineStatusResponse | null>(null);
  const [tourismHotspots, setTourismHotspots] =
    useState<TourismHotspotsResponse | null>(null);
  const [cityVibes, setCityVibes] = useState<CityVibesResponse | null>(null);
  const [mediaWatch, setMediaWatch] = useState<MediaWatchResponse | null>(null);
  const [cameraPayload, setCameraPayload] =
    useState<PublicCameraResponse | null>(null);
  const [visitorOrigins, setVisitorOrigins] =
    useState<PhuketVisitorOriginsResponse | null>(null);
  const [operations, setOperations] =
    useState<OperationsDashboardResponse | null>(null);
  const tierOneControllerRef = useRef<AbortController | null>(null);
  const tierOneRequestIdRef = useRef(0);
  const tierTwoControllerRef = useRef<AbortController | null>(null);
  const tierTwoRequestIdRef = useRef(0);

  const loadTierOne = useEffectEvent(async () => {
    const requestId = ++tierOneRequestIdRef.current;
    tierOneControllerRef.current?.abort();
    const controller = new AbortController();
    tierOneControllerRef.current = controller;

    try {
      const [
        nextBrief,
        nextMarine,
        nextTourismHotspots,
        nextCityVibes,
        nextMediaWatch,
        nextCameras,
        nextVisitorOrigins,
      ] = await Promise.all([
        fetchJsonOrNull<GovernorBrief>(
          buildScenarioUrl("/api/governor/brief", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<MarineStatusResponse>(
          buildScenarioUrl("/api/marine", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<TourismHotspotsResponse>(
          buildScenarioUrl("/api/tourism/hotspots", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<CityVibesResponse>(
          buildScenarioUrl("/api/city-vibes", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<MediaWatchResponse>(
          buildScenarioUrl("/api/media-watch", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<PublicCameraResponse>("/api/public-cameras", {
          signal: controller.signal,
        }),
        fetchJsonOrNull<PhuketVisitorOriginsResponse>("/api/visitor-origins", {
          signal: controller.signal,
        }),
      ]);
      if (controller.signal.aborted || requestId !== tierOneRequestIdRef.current) {
        return;
      }

      if (nextBrief) setBrief(nextBrief);
      if (nextMarine) setMarine(nextMarine);
      if (nextTourismHotspots) setTourismHotspots(nextTourismHotspots);
      if (nextCityVibes) setCityVibes(nextCityVibes);
      if (nextMediaWatch) setMediaWatch(nextMediaWatch);
      if (nextCameras) setCameraPayload(nextCameras);
      if (nextVisitorOrigins) setVisitorOrigins(nextVisitorOrigins);
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  const loadTierTwo = useEffectEvent(async () => {
    const requestId = ++tierTwoRequestIdRef.current;
    tierTwoControllerRef.current?.abort();
    const controller = new AbortController();
    tierTwoControllerRef.current = controller;

    try {
      const [nextDisaster, nextMaritimeSecurity, nextOperations] = await Promise.all([
        fetchJsonOrNull<DisasterFeedResponse>(
          buildScenarioUrl("/api/disaster/brief", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<MaritimeSecurityResponse>(
          buildScenarioUrl("/api/maritime/security", scenarioId),
          { signal: controller.signal },
        ),
        fetchJsonOrNull<OperationsDashboardResponse>(
          buildScenarioUrl("/api/operations/dashboard", scenarioId),
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted || requestId !== tierTwoRequestIdRef.current) {
        return;
      }

      if (nextDisaster) setDisaster(nextDisaster);
      if (nextMaritimeSecurity) setMaritimeSecurity(nextMaritimeSecurity);
      if (nextOperations) setOperations(nextOperations);
    } catch (error) {
      if (isAbortError(error)) return;
    }
  });

  useEffect(() => {
    void loadTierOne();
    const interval = window.setInterval(() => void loadTierOne(), 2 * 60 * 1000);

    return () => {
      tierOneRequestIdRef.current += 1;
      tierOneControllerRef.current?.abort();
      tierOneControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  useEffect(() => {
    void loadTierTwo();
    const interval = window.setInterval(() => void loadTierTwo(), 30 * 1000);

    return () => {
      tierTwoRequestIdRef.current += 1;
      tierTwoControllerRef.current?.abort();
      tierTwoControllerRef.current = null;
      window.clearInterval(interval);
    };
  }, [scenarioId]);

  const closeMobileSheet = useCallback(() => {
    setMobileSheet(null);
    if (sheetPushedRef.current) {
      sheetPushedRef.current = false;
      history.back();
    }
  }, []);

  const toggleMobileSheet = (next: "brief" | "news") => {
    if (mobileSheetRef.current === next) {
      closeMobileSheet();
      return;
    }
    if (mobileSheetRef.current === null) {
      history.pushState({ phoneSheet: next }, "");
      sheetPushedRef.current = true;
    } else {
      history.replaceState({ phoneSheet: next }, "");
    }
    setMobileSheet(next);
  };

  const onOperatorGlance = useCallback(
    (glance: {
      corridor: string;
      arrivals: number;
      buses: number;
      roads: number;
      boats: number;
    }) => {
      setOperatorGlance((current) => {
        if (
          current &&
          current.corridor === glance.corridor &&
          current.arrivals === glance.arrivals &&
          current.buses === glance.buses &&
          current.roads === glance.roads &&
          current.boats === glance.boats
        ) {
          return current;
        }
        return glance;
      });
    },
    [],
  );

  useEffect(() => {
    mobileSheetRef.current = mobileSheet;
  }, [mobileSheet]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileSheetRef.current) closeMobileSheet();
    };
    const onPop = () => {
      if (!sheetPushedRef.current) return;
      sheetPushedRef.current = false;
      setMobileSheet(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [closeMobileSheet]);

  const openManual = () => {
    setIsArchitectureOpen(false);
    setIsDataExplorerOpen(false);
    setIsManualOpen(true);
  };

  const openArchitecture = () => {
    setIsManualOpen(false);
    setIsDataExplorerOpen(false);
    setIsArchitectureOpen(true);
  };

  const openDataExplorer = () => {
    setIsManualOpen(false);
    setIsArchitectureOpen(false);
    setIsDataExplorerOpen(true);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-surface="phuket-dashboard"
      className="relative flex h-[100dvh] max-h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <TopBar
        brief={brief}
        visitorOrigins={visitorOrigins}
        onOpenManual={openManual}
        onOpenArchitecture={openArchitecture}
        onOpenDataExplorer={openDataExplorer}
        onOpenModuleSelector={() => setIsModuleSelectorOpen(true)}
        isDark={isDark}
        onToggleDark={toggleDark}
        operatorGlance={operatorGlance}
        glanceLang={glanceLang}
      />

      <OpsControlStrip operations={operations} cameraFeed={cameraPayload} />

      <section className="relative flex min-h-0 flex-1 overflow-hidden border-t border-[var(--line)]">
        <aside
          aria-label="Regional intelligence stream"
          className="hidden w-[260px] shrink-0 xl:block 2xl:w-[300px] min-[3000px]:w-[520px]"
        >
          <NewsSidebar />
        </aside>

        <section
          aria-label="Operational map"
          className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          <BorderMap
            onProvinceSelect={setSelectedProvince}
            selectedCorridorId={selectedCorridorId}
            onCorridorSelect={setSelectedCorridorId}
            disasterFeed={disaster}
            maritimeSecurityFeed={maritimeSecurity}
            cameraFeed={cameraPayload}
            tourismFeed={tourismHotspots}
            scenarioId={scenarioId}
            onOperatorGlance={onOperatorGlance}
          />
        </section>

        <aside
          aria-label="Operations desk"
          className="hidden w-[360px] shrink-0 xl:block 2xl:w-[420px] min-[3000px]:w-[520px]"
        >
          <OperationsPanel data={operations} brief={brief} />
        </aside>
      </section>

      <div className="relative z-[60] shrink-0 xl:hidden">
        {mobileSheet ? (
          <div
            id="phone-intel-sheet"
            role="region"
            aria-label={mobileSheet === "brief" ? "Brief" : "News"}
            className="absolute inset-x-0 bottom-full flex h-[min(46dvh,420px)] max-h-[calc(100dvh-8rem)] flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--bg-raised)]"
          >
            {mobileSheet === "brief" ? (
              <div className="flex h-full min-h-0 flex-col">
                <GlanceBrief glance={operatorGlance} lang={glanceLang} />
                <div className="min-h-0 flex-1">
                  <OperationsPanel data={operations} brief={brief} />
                </div>
              </div>
            ) : (
              <NewsSidebar />
            )}
          </div>
        ) : null}
        <div
          data-phone-dock=""
          className="phone-dock flex h-14 max-h-14 min-h-0 w-full min-w-0 max-w-full items-stretch overflow-hidden border-t border-[var(--line)] bg-[var(--bg-raised)]"
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <SignalTicker
              scroll
              brief={brief}
              marine={marine}
              cityVibes={cityVibes}
              mediaWatch={mediaWatch}
              disaster={disaster}
              cameraCount={cameraPayload?.cameras?.length ?? 0}
            />
          </div>
          <div
            role="group"
            aria-label="Open brief or news"
            className="flex shrink-0 border-l border-[var(--line)]"
          >
            <button
              type="button"
              aria-expanded={mobileSheet === "brief"}
              aria-controls="phone-intel-sheet"
              onClick={() => toggleMobileSheet("brief")}
              className={`flex h-full w-[4.5rem] items-center justify-center border-r border-[var(--line)] px-2 text-[10px] font-bold uppercase tracking-[0.14em] ${
                mobileSheet === "brief"
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "text-[var(--ink)]"
              }`}
            >
              Brief
            </button>
            <button
              type="button"
              aria-expanded={mobileSheet === "news"}
              aria-controls="phone-intel-sheet"
              onClick={() => toggleMobileSheet("news")}
              className={`flex h-full w-[4.5rem] items-center justify-center px-2 text-[10px] font-bold uppercase tracking-[0.14em] ${
                mobileSheet === "news"
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "text-[var(--ink)]"
              }`}
            >
              News
            </button>
          </div>
        </div>
      </div>

      <div className="hidden shrink-0 border-t border-[var(--line)] xl:block">
        <SignalTicker
          brief={brief}
          marine={marine}
          cityVibes={cityVibes}
          mediaWatch={mediaWatch}
          disaster={disaster}
          cameraCount={cameraPayload?.cameras?.length ?? 0}
        />
      </div>

      <ProvinceDashboard
        province={selectedProvince}
        onClose={() => setSelectedProvince(null)}
      />
      <DashboardManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />
      <DashboardArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />
      <DatabaseExplorerModal
        isOpen={isDataExplorerOpen}
        onClose={() => setIsDataExplorerOpen(false)}
      />
      {isModuleSelectorOpen ? (
        <ModuleSelector onClose={() => setIsModuleSelectorOpen(false)} />
      ) : null}
    </main>
  );
}

function GlanceBrief({
  glance,
  lang,
}: {
  glance: OperatorGlance | null;
  lang: GlanceLang;
}) {
  const view = glancePresentation(lang, glance);
  return (
    <dl className="shrink-0 border-b border-[var(--line)] px-3 py-2 text-[11px] leading-4">
      {view.brief.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 py-0.5">
          <dt className="min-w-0 text-[var(--muted)]">{row.label}</dt>
          <dd className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-[var(--ink)]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

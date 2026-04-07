"use client";

import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
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
import {
  buildScenarioUrl,
  fetchJsonOrNull,
  isAbortError,
} from "../../lib/client-requests";
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

  return (
    <>
      <Suspense fallback={null}>
        <ScenarioParamBridge onScenarioChange={setScenarioId} />
      </Suspense>
      <WarRoomShell scenarioId={scenarioId} />
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

function WarRoomShell({
  scenarioId,
}: {
  scenarioId: string | null;
}) {
  const [selectedProvince, setSelectedProvince] =
    useState<ProvinceSelection | null>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState("airport-patong");
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
      className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <TopBar
        brief={brief}
        visitorOrigins={visitorOrigins}
        onOpenManual={openManual}
        onOpenArchitecture={openArchitecture}
        onOpenDataExplorer={openDataExplorer}
        onOpenModuleSelector={() => setIsModuleSelectorOpen(true)}
      />

      <OpsControlStrip operations={operations} cameraFeed={cameraPayload} />

      <section className="relative flex min-h-0 flex-1 overflow-hidden border-t border-[var(--line)]">
        <aside
          aria-label="Regional intelligence stream"
          className="hidden w-[260px] shrink-0 xl:block min-[3000px]:w-[520px]"
        >
          <NewsSidebar />
        </aside>

        <section
          aria-label="Operational map"
          className="relative min-w-0 flex-1"
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
          />
        </section>

        <aside
          aria-label="Operations desk"
          className="hidden w-[360px] shrink-0 xl:block min-[3000px]:w-[520px]"
        >
          <OperationsPanel data={operations} />
        </aside>
      </section>

      <section
        aria-label="Operations desk"
        className="max-h-[46dvh] overflow-hidden border-t border-[var(--line)] bg-[var(--bg-raised)] xl:hidden"
      >
        <OperationsPanel data={operations} />
      </section>

      <div className="shrink-0 border-t border-[var(--line)]">
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

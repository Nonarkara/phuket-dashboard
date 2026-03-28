"use client";
import { useEffect, useState } from "react";
import DashboardArchitectureModal from "../components/Intelligence/DashboardArchitectureModal";
import DatabaseExplorerModal from "../components/Intelligence/DatabaseExplorerModal";
import DashboardManualModal from "../components/Intelligence/DashboardManualModal";
import OperationsPanel from "../components/Intelligence/OperationsPanel";
import SignalTicker from "../components/Intelligence/SignalTicker";
import TopBar from "../components/Intelligence/TopBar";
import ProvinceDashboard from "../components/Analytics/ProvinceDashboard";
import BorderMap from "../components/Map/BorderMap";
import NewsSidebar from "../components/Intelligence/NewsSidebar";
import ModuleSelector from "../components/Modules/ModuleSelector";
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
} from "../types/dashboard";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function appendScenario(path: string, scenarioId?: string | null) {
  return scenarioId
    ? `${path}${path.includes("?") ? "&" : "?"}scenario=${encodeURIComponent(scenarioId)}`
    : path;
}

export default function Dashboard() {
  const [scenarioId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("scenario"),
  );
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
  const [cameraPayload, setCameraPayload] = useState<PublicCameraResponse | null>(null);
  const [visitorOrigins, setVisitorOrigins] =
    useState<PhuketVisitorOriginsResponse | null>(null);
  const [operations, setOperations] =
    useState<OperationsDashboardResponse | null>(null);

  // ─── Tiered data polling ───────────────────────────────────────
  // Tier 1: 2-minute (contextual, less volatile)
  useEffect(() => {
    const load = async () => {
      const [
        nextBrief, nextMarine, nextTourismHotspots,
        nextCityVibes, nextMediaWatch, nextCameras, nextVisitorOrigins,
      ] = await Promise.all([
        fetchJson<GovernorBrief>(appendScenario("/api/governor/brief", scenarioId)),
        fetchJson<MarineStatusResponse>(appendScenario("/api/marine", scenarioId)),
        fetchJson<TourismHotspotsResponse>(appendScenario("/api/tourism/hotspots", scenarioId)),
        fetchJson<CityVibesResponse>(appendScenario("/api/city-vibes", scenarioId)),
        fetchJson<MediaWatchResponse>(appendScenario("/api/media-watch", scenarioId)),
        fetchJson<PublicCameraResponse>("/api/public-cameras"),
        fetchJson<PhuketVisitorOriginsResponse>("/api/visitor-origins"),
      ]);
      if (nextBrief) setBrief(nextBrief);
      if (nextMarine) setMarine(nextMarine);
      if (nextTourismHotspots) setTourismHotspots(nextTourismHotspots);
      if (nextCityVibes) setCityVibes(nextCityVibes);
      if (nextMediaWatch) setMediaWatch(nextMediaWatch);
      if (nextCameras) setCameraPayload(nextCameras);
      if (nextVisitorOrigins) setVisitorOrigins(nextVisitorOrigins);
    };
    void load();
    const interval = setInterval(() => void load(), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scenarioId]);

  // Tier 2: 60-second (important situational)
  useEffect(() => {
    const load = async () => {
      const [nextDisaster, nextMaritimeSecurity, nextOperations] = await Promise.all([
        fetchJson<DisasterFeedResponse>(appendScenario("/api/disaster/brief", scenarioId)),
        fetchJson<MaritimeSecurityResponse>(appendScenario("/api/maritime/security", scenarioId)),
        fetchJson<OperationsDashboardResponse>(appendScenario("/api/operations/dashboard", scenarioId)),
      ]);
      if (nextDisaster) setDisaster(nextDisaster);
      if (nextMaritimeSecurity) setMaritimeSecurity(nextMaritimeSecurity);
      if (nextOperations) setOperations(nextOperations);
    };
    void load();
    const interval = setInterval(() => void load(), 30 * 1000);
    return () => clearInterval(interval);
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

      {/* ─── 3-column center: News | Map | Intelligence Panel ─── */}
      <section className="relative min-h-0 flex-1 overflow-hidden border-t border-[var(--line)] flex">
        {/* Left — news column (wider at 4K for dual-language view) */}
        <div className="hidden xl:block w-[260px] min-[3000px]:w-[520px] shrink-0">
          <NewsSidebar />
        </div>

        {/* Center — map takes remaining space */}
        <div className="relative min-w-0 flex-1">
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
        </div>

        {/* Right — Flight Arrivals + Situation panel (xl+ screens / 74-inch LED) */}
        <div className="hidden xl:block w-[360px] min-[3000px]:w-[520px] shrink-0">
          <OperationsPanel data={operations} />
        </div>
      </section>

      <section className="xl:hidden border-t border-[var(--line)] bg-[var(--bg-raised)] max-h-[46dvh] overflow-hidden">
        <OperationsPanel data={operations} />
      </section>

      {/* ─── Signal ticker ─── */}
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
      {isModuleSelectorOpen && (
        <ModuleSelector onClose={() => setIsModuleSelectorOpen(false)} />
      )}
    </main>
  );
}

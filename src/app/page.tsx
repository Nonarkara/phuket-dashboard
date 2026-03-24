"use client";
import { useEffect, useState } from "react";
import DashboardArchitectureModal from "../components/Intelligence/DashboardArchitectureModal";
import DatabaseExplorerModal from "../components/Intelligence/DatabaseExplorerModal";
import DashboardManualModal from "../components/Intelligence/DashboardManualModal";
import SignalTicker from "../components/Intelligence/SignalTicker";
import TopBar from "../components/Intelligence/TopBar";
import ProvinceDashboard from "../components/Analytics/ProvinceDashboard";
import BorderMap from "../components/Map/BorderMap";
import BottomRail from "../components/Intelligence/BottomRail";
import NewsSidebar from "../components/Intelligence/NewsSidebar";
import ModuleRail from "../components/Modules/ModuleRail";
import ModuleSelector from "../components/Modules/ModuleSelector";
import type {
  CityVibesResponse,
  DisasterFeedResponse,
  GovernorBrief,
  MaritimeSecurityResponse,
  MarineStatusResponse,
  MediaWatchResponse,
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

export default function Dashboard() {
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

  // ─── Tiered data polling ───────────────────────────────────────
  // Tier 1: 2-minute (contextual, less volatile)
  useEffect(() => {
    const load = async () => {
      const [
        nextBrief, nextMarine, nextTourismHotspots,
        nextCityVibes, nextMediaWatch, nextCameras, nextVisitorOrigins,
      ] = await Promise.all([
        fetchJson<GovernorBrief>("/api/governor/brief"),
        fetchJson<MarineStatusResponse>("/api/marine"),
        fetchJson<TourismHotspotsResponse>("/api/tourism/hotspots"),
        fetchJson<CityVibesResponse>("/api/city-vibes"),
        fetchJson<MediaWatchResponse>("/api/media-watch"),
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
  }, []);

  // Tier 2: 60-second (important situational)
  useEffect(() => {
    const load = async () => {
      const [nextDisaster, nextMaritimeSecurity] = await Promise.all([
        fetchJson<DisasterFeedResponse>("/api/disaster/brief"),
        fetchJson<MaritimeSecurityResponse>("/api/maritime/security"),
      ]);
      if (nextDisaster) setDisaster(nextDisaster);
      if (nextMaritimeSecurity) setMaritimeSecurity(nextMaritimeSecurity);
    };
    void load();
    const interval = setInterval(() => void load(), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
          />
        </div>

        {/* Right — intelligence panel (4K only, vertical BottomRail) */}
        <div className="hidden min-[3000px]:flex w-[480px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--bg-raised)] overflow-y-auto">
          <BottomRail
            brief={brief}
            disaster={disaster}
            maritimeSecurity={maritimeSecurity}
            marine={marine}
            tourismHotspots={tourismHotspots}
            cityVibes={cityVibes}
            mediaWatch={mediaWatch}
            cameraPayload={cameraPayload}
            selectedCorridorId={selectedCorridorId}
            onSelectCorridor={setSelectedCorridorId}
            verticalMode
          />
        </div>
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

      {/* ─── Bottom rail (desktop only, hidden at 4K where it's a right panel) ─── */}
      <div className="min-[3000px]:hidden">
        <BottomRail
          brief={brief}
          disaster={disaster}
          maritimeSecurity={maritimeSecurity}
          marine={marine}
          tourismHotspots={tourismHotspots}
          cityVibes={cityVibes}
          mediaWatch={mediaWatch}
          cameraPayload={cameraPayload}
          selectedCorridorId={selectedCorridorId}
          onSelectCorridor={setSelectedCorridorId}
        />
      </div>

      {/* ─── Module Rail (Global Satellite Toolkit) ─── */}
      <ModuleRail />

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

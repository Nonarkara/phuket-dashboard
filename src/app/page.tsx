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
import type {
  CityVibesResponse,
  DisasterFeedResponse,
  GovernorBrief,
  MaritimeSecurityResponse,
  MarineStatusResponse,
  MediaWatchResponse,
  ProvinceSelection,
  PublicCameraResponse,
  TourismHotspotsResponse,
} from "../types/dashboard";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

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
  const [brief, setBrief] = useState<GovernorBrief | null>(null);
  const [disaster, setDisaster] = useState<DisasterFeedResponse | null>(null);
  const [maritimeSecurity, setMaritimeSecurity] =
    useState<MaritimeSecurityResponse | null>(null);
  const [marine, setMarine] = useState<MarineStatusResponse | null>(null);
  const [tourismHotspots, setTourismHotspots] =
    useState<TourismHotspotsResponse | null>(null);
  const [cityVibes, setCityVibes] = useState<CityVibesResponse | null>(null);
  const [mediaWatch, setMediaWatch] = useState<MediaWatchResponse | null>(null);
  const [cameraPayload, setCameraPayload] = useState<PublicCameraResponse | null>(
    null,
  );

  useEffect(() => {
    const load = async () => {
      const [
        nextBrief,
        nextDisaster,
        nextMaritimeSecurity,
        nextMarine,
        nextTourismHotspots,
        nextCityVibes,
        nextMediaWatch,
        nextCameras,
      ] =
        await Promise.all([
          fetchJson<GovernorBrief>("/api/governor/brief"),
          fetchJson<DisasterFeedResponse>("/api/disaster/brief"),
          fetchJson<MaritimeSecurityResponse>("/api/maritime/security"),
          fetchJson<MarineStatusResponse>("/api/marine"),
          fetchJson<TourismHotspotsResponse>("/api/tourism/hotspots"),
          fetchJson<CityVibesResponse>("/api/city-vibes"),
          fetchJson<MediaWatchResponse>("/api/media-watch"),
          fetchJson<PublicCameraResponse>("/api/public-cameras"),
        ]);

      if (nextBrief) setBrief(nextBrief);
      if (nextDisaster) setDisaster(nextDisaster);
      if (nextMaritimeSecurity) setMaritimeSecurity(nextMaritimeSecurity);
      if (nextMarine) setMarine(nextMarine);
      if (nextTourismHotspots) setTourismHotspots(nextTourismHotspots);
      if (nextCityVibes) setCityVibes(nextCityVibes);
      if (nextMediaWatch) setMediaWatch(nextMediaWatch);
      if (nextCameras) setCameraPayload(nextCameras);
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 2 * 60 * 1000);

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
      className="relative grid h-[100dvh] w-screen grid-rows-[auto_1fr_auto_auto] overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <TopBar
        brief={brief}
        onOpenManual={openManual}
        onOpenArchitecture={openArchitecture}
        onOpenDataExplorer={openDataExplorer}
      />

      {/* ─── Map-dominant center ─── */}
      <section className="relative min-h-0 flex-1 overflow-hidden border-t border-[var(--line)]">
        <BorderMap
          onProvinceSelect={setSelectedProvince}
          selectedCorridorId={selectedCorridorId}
          onCorridorSelect={setSelectedCorridorId}
        />
      </section>

      {/* ─── Compact Bottom Rail ─── */}
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

      <div className="border-t border-[var(--line)]">
        <SignalTicker
          brief={brief}
          marine={marine}
          cityVibes={cityVibes}
          mediaWatch={mediaWatch}
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
    </main>
  );
}

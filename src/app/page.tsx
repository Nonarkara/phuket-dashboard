"use client";
import { useEffect, useState } from "react";
import TrendingKeywords from "../components/Analytics/TrendingKeywords";
import BriefingPanel from "../components/Intelligence/BriefingPanel";
import DashboardArchitectureModal from "../components/Intelligence/DashboardArchitectureModal";
import DatabaseExplorerModal from "../components/Intelligence/DatabaseExplorerModal";
import DashboardManualModal from "../components/Intelligence/DashboardManualModal";
import LiveTVPanel from "../components/Intelligence/LiveTVPanel";
import NewsDesk from "../components/Intelligence/NewsDesk";
import SignalTicker from "../components/Intelligence/SignalTicker";
import SourceStack from "../components/Intelligence/SourceStack";
import TopBar from "../components/Intelligence/TopBar";
import ProvinceDashboard from "../components/Analytics/ProvinceDashboard";
import BorderMap from "../components/Map/BorderMap";
import Sidebar from "../components/Sidebar/Sidebar";
import type {
  CityVibesResponse,
  GovernorBrief,
  MarineStatusResponse,
  MediaWatchResponse,
  ProvinceSelection,
  PublicCameraResponse,
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
  const [marine, setMarine] = useState<MarineStatusResponse | null>(null);
  const [cityVibes, setCityVibes] = useState<CityVibesResponse | null>(null);
  const [mediaWatch, setMediaWatch] = useState<MediaWatchResponse | null>(null);
  const [cameraPayload, setCameraPayload] = useState<PublicCameraResponse | null>(
    null,
  );

  useEffect(() => {
    const load = async () => {
      const [nextBrief, nextMarine, nextCityVibes, nextMediaWatch, nextCameras] =
        await Promise.all([
          fetchJson<GovernorBrief>("/api/governor/brief"),
          fetchJson<MarineStatusResponse>("/api/marine"),
          fetchJson<CityVibesResponse>("/api/city-vibes"),
          fetchJson<MediaWatchResponse>("/api/media-watch"),
          fetchJson<PublicCameraResponse>("/api/public-cameras"),
        ]);

      if (nextBrief) setBrief(nextBrief);
      if (nextMarine) setMarine(nextMarine);
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
      className="relative grid h-[100dvh] w-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
    >
      <TopBar
        brief={brief}
        onOpenManual={openManual}
        onOpenArchitecture={openArchitecture}
        onOpenDataExplorer={openDataExplorer}
      />

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)] overflow-hidden">
        {/* ─── Left Command Column ─── */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--bg-raised)] lg:flex">
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <Sidebar brief={brief} />
          </div>
        </aside>

        {/* ─── Central Operations Surface ─── */}
        <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)]">
          <section className="relative flex-1 overflow-hidden">
            <BorderMap
              onProvinceSelect={setSelectedProvince}
              selectedCorridorId={selectedCorridorId}
              onCorridorSelect={setSelectedCorridorId}
            />
          </section>

          {/* Bottom Executive Rail */}
          <section className="grid h-[250px] shrink-0 border-t border-[var(--line)] lg:grid-cols-3 divide-x divide-[var(--line)] overflow-hidden bg-[var(--bg-raised)]">
            <div className="overflow-hidden p-2">
              <div className="eyebrow mb-1 opacity-50 px-1">TV / Cameras</div>
              <LiveTVPanel
                cameraPayload={cameraPayload}
                selectedCorridorId={selectedCorridorId}
              />
            </div>
            <div className="overflow-hidden p-2">
              <div className="eyebrow mb-1 opacity-50 px-1">Corridor dossier</div>
              <SourceStack
                brief={brief}
                marine={marine}
                mediaWatch={mediaWatch}
                cameraPayload={cameraPayload}
                selectedCorridorId={selectedCorridorId}
              />
            </div>
            <div className="overflow-hidden p-2">
              <div className="eyebrow mb-1 opacity-50 px-1">Public mood</div>
              <TrendingKeywords
                cityVibes={cityVibes}
                mediaWatch={mediaWatch}
                selectedCorridorId={selectedCorridorId}
              />
            </div>
          </section>
        </div>

        {/* ─── Right Information Column ─── */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--bg-raised)] xl:flex">
          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--line)]">
            <section className="p-2">
              <div className="eyebrow mb-1 opacity-50 px-1">Governor corridors</div>
              <BriefingPanel
                brief={brief}
                selectedCorridorId={selectedCorridorId}
                onSelectCorridor={setSelectedCorridorId}
              />
            </section>

            <section className="p-2">
              <div className="eyebrow mb-1 opacity-50 px-1">Narrative watch</div>
              <NewsDesk mediaWatch={mediaWatch} brief={brief} />
            </section>
          </div>
        </aside>
      </div>

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

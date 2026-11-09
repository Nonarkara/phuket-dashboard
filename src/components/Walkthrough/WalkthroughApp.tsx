"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Sun,
  Sunset,
  Moon,
  CloudSun,
  Share2,
  Check,
} from "lucide-react";
import {
  PHUKET_WALKTHROUGH_NEIGHBORHOODS,
  type WalkthroughNeighborhoodId,
  type WalkthroughPlace,
  type PlaceCategory,
  type RenderShaderStyle,
  type TimeOfDay,
} from "../../lib/phuket-walkthrough-data";
import WalkthroughCanvas from "./WalkthroughCanvas";
import WalkthroughMinimap from "./WalkthroughMinimap";
import WalkthroughPlaceCard from "./WalkthroughPlaceCard";

export default function WalkthroughApp({
  initialNeighborhood = "phuket-old-town",
}: {
  initialNeighborhood?: WalkthroughNeighborhoodId;
}) {
  const [currentNeighborhoodId, setCurrentNeighborhoodId] =
    useState<WalkthroughNeighborhoodId>(initialNeighborhood);

  const neighborhood = PHUKET_WALKTHROUGH_NEIGHBORHOODS[currentNeighborhoodId];

  // Active camera state
  const [cameraPosition, setCameraPosition] = useState<[number, number]>(
    neighborhood.center,
  );
  const [cameraBearing, setCameraBearing] = useState<number>(
    neighborhood.defaultBearing,
  );
  const [cameraPitch, setCameraPitch] = useState<number>(
    neighborhood.defaultPitch,
  );
  const [cameraFov, setCameraFov] = useState<number>(18); // 18mm wide-angle manga perspective

  // Aesthetic shader and atmosphere settings
  const [shaderStyle, setShaderStyle] =
    useState<RenderShaderStyle>("screentone");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("late-afternoon");

  // Feature toggles matching Rokehan "What to build"
  const [showOverheadWires, setShowOverheadWires] = useState(true);
  const [showPolesAndSignals, setShowPolesAndSignals] = useState(true);
  const [showComicSoundEffects, setShowComicSoundEffects] = useState(true);
  const [showScreentone, setShowScreentone] = useState(true);

  // Selected place for focused inspection
  const [selectedPlace, setSelectedPlace] = useState<WalkthroughPlace | null>(
    neighborhood.places[0] ?? null,
  );

  // Search & category filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | "all">(
    "all",
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Switch neighborhood
  const handleSwitchNeighborhood = (id: WalkthroughNeighborhoodId) => {
    setCurrentNeighborhoodId(id);
    const nextN = PHUKET_WALKTHROUGH_NEIGHBORHOODS[id];
    setCameraPosition(nextN.center);
    setCameraBearing(nextN.defaultBearing);
    setCameraPitch(nextN.defaultPitch);
    setSelectedPlace(nextN.places[0] ?? null);
  };

  // Filtered places
  const filteredPlaces = useMemo(() => {
    return neighborhood.places.filter((p) => {
      const matchesSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameTh.includes(searchQuery) ||
        p.streetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.signatureDishes.some((d) =>
          d.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      const matchesCategory =
        activeCategory === "all" || p.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [neighborhood, searchQuery, activeCategory]);

  // Handle camera position updates from canvas
  const handleCameraChange = useCallback(
    (pos: [number, number], bearing: number, pitch: number) => {
      setCameraPosition(pos);
      setCameraBearing(bearing);
      setCameraPitch(pitch);
    },
    [],
  );

  // Teleport camera directly to doorstep of a place
  const handleTeleportToPlace = (place: WalkthroughPlace) => {
    setSelectedPlace(place);
    setCameraPosition([place.lat, place.lng]);
    setCameraPitch(80); // Eye-level perspective
  };

  // Teleport from minimap click
  const handleTeleportToCoord = (lat: number, lng: number) => {
    setCameraPosition([lat, lng]);
  };

  // Share vantage deep-link
  const handleShareLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/walkthrough?place=${currentNeighborhoodId}#ll=${cameraPosition[0].toFixed(5)},${cameraPosition[1].toFixed(5)}&style=${shaderStyle}&tod=${timeOfDay}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)] font-mono">
      {/* ── TOP HEADER BAR (Rokehan Style) ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--line-bright)] bg-[var(--bg-raised)] px-3 text-[10px] z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 border border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-bold uppercase tracking-wider text-[var(--dim)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
            title="Return to War Room"
          >
            <ArrowLeft size={12} />
            <span className="hidden sm:inline">War Room</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center bg-black text-white font-bold">
              探
            </div>
            <div>
              <div className="font-bold uppercase tracking-widest text-[var(--ink)] leading-none">
                Location Scout · Phuket 3D
              </div>
              <div className="text-[8px] text-[var(--dim)] leading-none mt-0.5">
                3D backgrounds of real city streets · line art and tone
              </div>
            </div>
          </div>
        </div>

        {/* Search bar & Neighborhood Selector */}
        <div className="hidden md:flex items-center gap-2">
          {/* Neighborhood chips */}
          <div className="flex border border-[var(--line)] bg-[var(--bg)] p-0.5">
            <button
              type="button"
              onClick={() => handleSwitchNeighborhood("phuket-old-town")}
              className={`px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] transition-colors ${
                currentNeighborhoodId === "phuket-old-town"
                  ? "bg-[var(--cool)] text-white"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              Phuket Old Town
            </button>
            <button
              type="button"
              onClick={() => handleSwitchNeighborhood("patong")}
              className={`px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] transition-colors ${
                currentNeighborhoodId === "patong"
                  ? "bg-[var(--cool)] text-white"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              Patong Beach
            </button>
          </div>

          {/* Quick search input */}
          <div className="relative">
            <Search
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--dim)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search places or dishes..."
              className="h-7 w-48 border border-[var(--line)] bg-[var(--bg)] pl-7 pr-2 text-[9px] text-[var(--ink)] placeholder-[var(--dim)] focus:border-[var(--cool)] focus:outline-none"
            />
          </div>
        </div>

        {/* Styling, Time of day, and Export controls */}
        <div className="flex items-center gap-2">
          {/* Time of Day */}
          <div className="hidden lg:flex border border-[var(--line)] bg-[var(--bg)] p-0.5">
            <button
              type="button"
              onClick={() => setTimeOfDay("morning")}
              className={`p-1 transition-colors ${
                timeOfDay === "morning"
                  ? "bg-[var(--line-bright)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
              title="Morning"
            >
              <CloudSun size={12} />
            </button>
            <button
              type="button"
              onClick={() => setTimeOfDay("golden-hour")}
              className={`p-1 transition-colors ${
                timeOfDay === "golden-hour"
                  ? "bg-[var(--line-bright)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
              title="Golden Hour"
            >
              <Sun size={12} />
            </button>
            <button
              type="button"
              onClick={() => setTimeOfDay("late-afternoon")}
              className={`p-1 transition-colors ${
                timeOfDay === "late-afternoon"
                  ? "bg-[var(--line-bright)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
              title="Late Afternoon"
            >
              <Sunset size={12} />
            </button>
            <button
              type="button"
              onClick={() => setTimeOfDay("neon-night")}
              className={`p-1 transition-colors ${
                timeOfDay === "neon-night"
                  ? "bg-[var(--line-bright)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
              title="Neon Night"
            >
              <Moon size={12} />
            </button>
          </div>

          {/* Render Shader selector */}
          <select
            value={shaderStyle}
            onChange={(e) => setShaderStyle(e.target.value as RenderShaderStyle)}
            className="h-7 border border-[var(--line)] bg-[var(--bg)] px-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)] focus:outline-none"
          >
            <option value="screentone">線画＋トーン Manga</option>
            <option value="comic-pop">アメコミ Comic Pop</option>
            <option value="architectural-ink">白模 White Model</option>
            <option value="neon-noir">サイバー Neon Noir</option>
          </select>

          {/* Lens Warping FOV Slider */}
          <div className="hidden xl:flex items-center gap-1.5 border border-[var(--line)] bg-[var(--bg)] px-2 py-1">
            <span className="text-[8px] uppercase tracking-wider text-[var(--dim)]">
              Lens:
            </span>
            <input
              type="range"
              min="12"
              max="50"
              value={cameraFov}
              onChange={(e) => setCameraFov(Number(e.target.value))}
              className="h-1.5 w-16 accent-[var(--cool)] cursor-pointer"
              title="Lens focal length (12mm ultra-wide fisheye to 50mm normal)"
            />
            <span className="text-[8px] font-bold text-[var(--ink)]">
              {cameraFov}mm
            </span>
          </div>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareLink}
            className="flex items-center gap-1 border border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-bold uppercase tracking-wider text-[var(--dim)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
            title="Share deep link URL"
          >
            {copiedLink ? <Check size={11} className="text-emerald-500" /> : <Share2 size={11} />}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
          </button>
        </div>
      </header>

      {/* ── MAIN THREE-PANE WORKSPACE ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── LEFT PANEL: Candidates & Places Directory ── */}
        <aside
          aria-label="Neighborhood Places"
          className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-raised)] overflow-hidden"
        >
          {/* Panel header */}
          <div className="border-b border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-[9px] text-[var(--dim)]">
                Candidates ({filteredPlaces.length} places)
              </span>
              <span className="text-[8px] text-[var(--cool)] font-bold">
                {neighborhood.name}
              </span>
            </div>
            <p className="mt-1 text-[9px] text-[var(--muted)] leading-tight">
              {neighborhood.tagline}
            </p>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-1 border-b border-[var(--line)] p-2">
            {(
              [
                ["all", "All"],
                ["michelin-dining", "Michelin"],
                ["street-food", "Street Food"],
                ["dessert-cafe", "Cafes & Sweets"],
                ["heritage-culture", "Heritage"],
                ["nightlife-bars", "Nightlife"],
              ] as const
            ).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategory(catKey)}
                className={`border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
                  activeCategory === catKey
                    ? "border-[var(--cool)] bg-[var(--cool)] text-white"
                    : "border-[var(--line)] text-[var(--dim)] hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
                }`}
              >
                {catLabel}
              </button>
            ))}
          </div>

          {/* Places Scroll List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredPlaces.map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <div
                  key={place.id}
                  onClick={() => handleTeleportToPlace(place)}
                  className={`cursor-pointer border p-2 transition-all ${
                    isSelected
                      ? "border-[var(--cool)] bg-[rgba(15,111,136,0.06)] shadow-xs"
                      : "border-[var(--line)] bg-[var(--bg)] hover:border-[var(--line-bright)] hover:bg-[var(--bg-raised)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-[10px] text-[var(--ink)] leading-snug">
                      {place.name}
                    </span>
                    <span
                      className="shrink-0 px-1 py-0.2 font-mono text-[7px] font-black uppercase text-white"
                      style={{ backgroundColor: place.comicBubbleColor }}
                    >
                      {place.soundEffectRom}
                    </span>
                  </div>
                  <div className="text-[9px] text-[var(--dim)] mt-0.5">
                    {place.nameTh} · {place.streetName}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[8px] text-[var(--dim)]">
                    <span>{place.categoryLabel}</span>
                    <span className="font-bold text-[var(--ink)]">{place.priceRange}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature guide box (matches Rokehan's left footer) */}
          <div className="border-t border-[var(--line)] bg-[var(--bg)] p-2 text-[8px] text-[var(--dim)] space-y-1">
            <div className="font-bold uppercase tracking-wider text-[var(--ink)]">
              Navigation Guide
            </div>
            <p>• Click pavement or radar to walk anywhere in 3D.</p>
            <p>• Press <strong>F</strong> key to stand at doorstep.</p>
            <p>• WASD or arrow keys for first-person walk.</p>
          </div>
        </aside>

        {/* ── CENTER: 3D Manga Street Canvas Viewport ── */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <WalkthroughCanvas
            neighborhood={neighborhood}
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            cameraPosition={cameraPosition}
            cameraBearing={cameraBearing}
            cameraPitch={cameraPitch}
            cameraFov={cameraFov}
            shaderStyle={shaderStyle}
            timeOfDay={timeOfDay}
            showOverheadWires={showOverheadWires}
            showPolesAndSignals={showPolesAndSignals}
            showComicSoundEffects={showComicSoundEffects}
            showScreentone={showScreentone}
            onCameraChange={handleCameraChange}
            onSelectPlace={(p) => setSelectedPlace(p)}
          />
        </main>

        {/* ── RIGHT PANEL: Region Minimap & Place Inspector ── */}
        <aside
          aria-label="Neighborhood Inspector"
          className="hidden xl:flex w-[340px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--bg-raised)] overflow-y-auto"
        >
          {/* Synchronized Radar Minimap */}
          <div className="p-3 border-b border-[var(--line)]">
            <WalkthroughMinimap
              neighborhood={neighborhood}
              places={neighborhood.places}
              selectedPlace={selectedPlace}
              cameraPosition={cameraPosition}
              cameraBearing={cameraBearing}
              cameraPitch={cameraPitch}
              onSelectPlace={(p) => setSelectedPlace(p)}
              onTeleportToCoord={handleTeleportToCoord}
            />
          </div>

          {/* What to build toggles (Rokehan style) */}
          <div className="border-b border-[var(--line)] bg-[var(--bg)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[9px] text-[var(--dim)]">
                What to build (การสร้างฉาก)
              </span>
              <span className="text-[8px] font-mono text-[var(--dim)]">
                OSM + Terrarium
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showScreentone}
                  onChange={(e) => setShowScreentone(e.target.checked)}
                  className="accent-[var(--cool)]"
                />
                <span>Manga Tone</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showComicSoundEffects}
                  onChange={(e) => setShowComicSoundEffects(e.target.checked)}
                  className="accent-[var(--cool)]"
                />
                <span>Sound FX</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverheadWires}
                  onChange={(e) => setShowOverheadWires(e.target.checked)}
                  className="accent-[var(--cool)]"
                />
                <span>Overhead Wires</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPolesAndSignals}
                  onChange={(e) => setShowPolesAndSignals(e.target.checked)}
                  className="accent-[var(--cool)]"
                />
                <span>Road Marks & Poles</span>
              </label>
            </div>
          </div>

          {/* Live Street Statistics */}
          <div className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2 text-[8px] text-[var(--dim)] space-y-0.5">
            <div className="font-bold text-[var(--ink)]">
              {neighborhood.name} ({neighborhood.nameTh})
            </div>
            <div>
              {neighborhood.places.length} mapped gastronomy & heritage institutions
            </div>
            <div>
              Elevation ~{neighborhood.groundElevationM}m (AWS Terrarium Tiles) · OpenFreeMap Planet
            </div>
          </div>

          {/* Active Place Detail Card */}
          {selectedPlace ? (
            <div className="p-3">
              <WalkthroughPlaceCard
                place={selectedPlace}
                cameraPosition={cameraPosition}
                cameraBearing={cameraBearing}
                onTeleportToDoorstep={handleTeleportToPlace}
                onClose={() => setSelectedPlace(null)}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-[10px] text-[var(--dim)]">
              Click any restaurant marker or candidates on the left to inspect signature dishes and neighborhood orientation.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

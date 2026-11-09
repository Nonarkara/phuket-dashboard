"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import {
  Compass,
  Eye,
  Footprints,
  Maximize2,
} from "lucide-react";
import type {
  WalkthroughPlace,
  WalkthroughNeighborhood,
  RenderShaderStyle,
  TimeOfDay,
} from "../../lib/phuket-walkthrough-data";

interface WalkthroughCanvasProps {
  neighborhood: WalkthroughNeighborhood;
  places: WalkthroughPlace[];
  selectedPlace: WalkthroughPlace | null;
  cameraPosition: [number, number]; // [lat, lng]
  cameraBearing: number;
  cameraPitch: number;
  cameraFov: number; // 12mm - 50mm equivalent
  shaderStyle: RenderShaderStyle;
  timeOfDay: TimeOfDay;
  showOverheadWires: boolean;
  showPolesAndSignals: boolean;
  showComicSoundEffects: boolean;
  showScreentone: boolean;
  onCameraChange: (pos: [number, number], bearing: number, pitch: number) => void;
  onSelectPlace: (place: WalkthroughPlace) => void;
}

export default function WalkthroughCanvas({
  neighborhood,
  places,
  selectedPlace,
  cameraPosition,
  cameraBearing,
  cameraPitch,
  cameraFov,
  shaderStyle,
  timeOfDay,
  showOverheadWires,
  showPolesAndSignals,
  showComicSoundEffects,
  showScreentone,
  onCameraChange,
  onSelectPlace,
}: WalkthroughCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [viewPreset, setViewPreset] = useState<"eye" | "scout" | "aerial">("eye");
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Calculate focal length perspective scale for comic lens warping
  const lensTransform = useMemo(() => {
    // cameraFov maps from 12 (ultra wide fisheye) to 50 (normal)
    // At 12mm, we exaggerate scale and curve edges
    const fisheyeFactor = Math.max(0, (28 - cameraFov) / 16);
    return {
      scale: 1 + fisheyeFactor * 0.12,
      perspective: 800 - fisheyeFactor * 250,
      curvature: fisheyeFactor * 8, // barrel distortion in degrees
    };
  }, [cameraFov]);

  // Lighting & atmosphere based on time of day
  const lightConfig = useMemo(() => {
    switch (timeOfDay) {
      case "morning":
        return {
          skyColor: "#e0f2fe",
          sunIntensity: 14,
          sunDirection: [90, 75] as [number, number],
          lightColor: "#fff7ed",
          fogColor: "rgba(224, 242, 254, 0.7)",
        };
      case "golden-hour":
        return {
          skyColor: "#fed7aa",
          sunIntensity: 16,
          sunDirection: [260, 45] as [number, number],
          lightColor: "#f97316",
          fogColor: "rgba(254, 215, 170, 0.75)",
        };
      case "late-afternoon":
        return {
          skyColor: "#fbcfe8",
          sunIntensity: 12,
          sunDirection: [240, 30] as [number, number],
          lightColor: "#e11d48",
          fogColor: "rgba(251, 207, 232, 0.65)",
        };
      case "neon-night":
        return {
          skyColor: "#090d16",
          sunIntensity: 3,
          sunDirection: [0, 10] as [number, number],
          lightColor: "#38bdf8",
          fogColor: "rgba(9, 13, 22, 0.9)",
        };
    }
  }, [timeOfDay]);

  // Apply 3D building layers & styling to MapLibre instance
  const applyComicStyling = useCallback(
    (map: maplibregl.Map) => {
      if (!map.isStyleLoaded()) return;

      const BLDG_SRC = "phuket-walkthrough-bldg-src";
      const BLDG_LAYER = "phuket-walkthrough-bldg-3d";
      const DEM_SRC = "phuket-walkthrough-dem";

      // 1. Terrain DEM
      if (!map.getSource(DEM_SRC)) {
        map.addSource(DEM_SRC, {
          type: "raster-dem",
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          maxzoom: 15,
          encoding: "terrarium",
          attribution: "Terrain Tiles · Mapzen / AWS",
        });
      }
      const terrainMap = map as unknown as {
        setTerrain?: (opt: unknown) => void;
        setLight?: (opt: unknown) => void;
        setFog?: (opt: unknown) => void;
      };
      terrainMap.setTerrain?.({ source: DEM_SRC, exaggeration: 1.2 });

      // 2. Vector Buildings (OpenFreeMap)
      // If the style already loaded openmaptiles, reuse it; otherwise load TileJSON url
      const hasOpenMapTiles = Boolean(map.getSource("openmaptiles"));
      const bldgSource = hasOpenMapTiles ? "openmaptiles" : BLDG_SRC;

      if (!hasOpenMapTiles && !map.getSource(BLDG_SRC)) {
        map.addSource(BLDG_SRC, {
          type: "vector",
          url: "https://tiles.openfreemap.org/planet",
        });
      }

      // Hide 2D flat building layer so 3D extrusions shine
      if (map.getLayer("building")) {
        map.setLayoutProperty("building", "visibility", "none");
      }

      // Height expression: real height if tagged, otherwise procedural 9-13m shophouses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heightExpr: any = [
        "case",
        [">", ["to-number", ["coalesce", ["get", "render_height"], 0]], 0],
        ["to-number", ["get", "render_height"]],
        // Default shophouses to 9.5m (typical 2-storey Sino-Portuguese shophouse)
        9.5,
      ];

      // 3. Shading expression depending on shaderStyle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let buildingColorExpr: any;
      let buildingOpacity = 0.95;

      switch (shaderStyle) {
        case "screentone":
          // Manga line art and screentone: high contrast monochrome with shophouse tones
          buildingColorExpr = [
            "interpolate",
            ["linear"],
            heightExpr,
            0,
            "#f4f1e8", // ground shophouse walls
            8,
            "#e6e1d3", // 2-3 storey shophouses
            15,
            "#c8c1ae", // mid-rise
            40,
            "#88816f", // tall
          ];
          buildingOpacity = 0.94;
          break;

        case "comic-pop":
          // Vibrant Sino-Portuguese pastel & comic book cel-shading
          buildingColorExpr = [
            "interpolate",
            ["linear"],
            heightExpr,
            0,
            "#fef08a", // pastel yellow shophouse
            8,
            "#7dd3fc", // pastel sky turquoise
            14,
            "#fda4af", // pastel pink facade
            30,
            "#f97316", // vibrant terracotta orange
            60,
            "#a855f7", // violet tower
          ];
          buildingOpacity = 0.95;
          break;

        case "architectural-ink":
          // Architectural white clay model with crisp ink outlines
          buildingColorExpr = "#f8f9fa";
          buildingOpacity = 0.98;
          break;

        case "neon-noir":
          // Cyberpunk midnight
          buildingColorExpr = [
            "interpolate",
            ["linear"],
            heightExpr,
            0,
            "#111827",
            10,
            "#1e293b",
            30,
            "#0f766e",
            60,
            "#831843",
          ];
          buildingOpacity = 0.96;
          break;
      }

      if (!map.getLayer(BLDG_LAYER)) {
        map.addLayer({
          id: BLDG_LAYER,
          type: "fill-extrusion",
          source: bldgSource,
          "source-layer": "building",
          minzoom: 10,
          paint: {
            "fill-extrusion-color": buildingColorExpr,
            "fill-extrusion-height": heightExpr,
            "fill-extrusion-base": [
              "to-number",
              ["coalesce", ["get", "render_min_height"], 0],
            ],
            "fill-extrusion-opacity": buildingOpacity,
          },
        });
      } else {
        map.setPaintProperty(BLDG_LAYER, "fill-extrusion-color", buildingColorExpr);
        map.setPaintProperty(BLDG_LAYER, "fill-extrusion-height", heightExpr);
        map.setPaintProperty(BLDG_LAYER, "fill-extrusion-opacity", buildingOpacity);
      }

      // Set lighting and atmosphere
      terrainMap.setLight?.({
        anchor: "viewport",
        color: lightConfig.lightColor,
        intensity: 0.65,
        position: [1.5, lightConfig.sunDirection[0], lightConfig.sunDirection[1]],
      });

      terrainMap.setFog?.({
        range: [0.6, 6],
        color: lightConfig.fogColor,
        "horizon-blend": 0.12,
        "high-color": lightConfig.skyColor,
        "space-color": "#0d1117",
      });
    },
    [shaderStyle, lightConfig],
  );

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [cameraPosition[1], cameraPosition[0]],
      zoom: 18.2,
      pitch: cameraPitch,
      bearing: cameraBearing,
      maxPitch: 85,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      applyComicStyling(map);
    });

    map.on("move", () => {
      const c = map.getCenter();
      onCameraChange([c.lat, c.lng], map.getBearing(), map.getPitch());
    });

    // Pavement click to walk
    map.on("click", (e) => {
      map.easeTo({
        center: e.lngLat,
        duration: 1200,
        easing: (t) => t * (2 - t),
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update styling when shader or lighting changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      applyComicStyling(mapRef.current);
    }
  }, [applyComicStyling]);

  // Synchronize camera when selected place changes (swoop down street with speed lines!)
  useEffect(() => {
    if (!selectedPlace || !mapRef.current) return;

    setIsWarping(true);
    const timer = setTimeout(() => setIsWarping(false), 1400);

    mapRef.current.flyTo({
      center: [selectedPlace.lng, selectedPlace.lat],
      zoom: 18.8,
      pitch: 76,
      bearing: (cameraBearing + 30) % 360,
      duration: 1300,
      essential: true,
    });

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace]);

  // Render onomatopoeia markers on the 3D map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    for (const m of markersRef.current) {
      m.remove();
    }
    markersRef.current = [];

    if (!showComicSoundEffects) return;

    for (const place of places) {
      const el = document.createElement("div");
      el.className = "group relative cursor-pointer select-none transition-transform hover:scale-110";
      el.innerHTML = `
        <div style="background-color: ${place.comicBubbleColor}; box-shadow: 2px 2px 0px rgba(0,0,0,0.8);"
             class="relative flex items-center gap-1.5 border border-black px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-white">
          <span>${place.soundEffectRom}</span>
          <span class="text-[8px] opacity-90">${place.name.split(" ")[0]}</span>
          <div style="border-top-color: ${place.comicBubbleColor};"
               class="absolute -bottom-1.5 left-3 h-0 w-0 border-x-4 border-x-transparent border-t-[6px]"></div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectPlace(place);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      markersRef.current.push(marker);
    }

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
    };
  }, [places, showComicSoundEffects, onSelectPlace]);

  // Keyboard navigation for first-person street walking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      const TURN_STEP = 15; // 15 degrees
      const currentBearing = map.getBearing();

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          // Walk forward along bearing
          map.panBy([0, -60], { duration: 250 });
          break;
        case "s":
        case "arrowdown":
          // Walk backward
          map.panBy([0, 60], { duration: 250 });
          break;
        case "a":
        case "arrowleft":
          // Turn left
          map.easeTo({
            bearing: currentBearing - TURN_STEP,
            duration: 250,
          });
          break;
        case "d":
        case "arrowright":
          // Turn right
          map.easeTo({
            bearing: currentBearing + TURN_STEP,
            duration: 250,
          });
          break;
        case "f":
          // "Stand here" eye-level trigger
          if (selectedPlace) {
            map.flyTo({
              center: [selectedPlace.lng, selectedPlace.lat],
              pitch: 80,
              zoom: 18.8,
              duration: 900,
            });
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlace]);

  // Preset view mode changers
  const handleViewPresetChange = (preset: "eye" | "scout" | "aerial") => {
    if (!mapRef.current) return;
    setViewPreset(preset);

    switch (preset) {
      case "eye":
        // Eye-level pedestrian walk
        mapRef.current.easeTo({
          pitch: 80,
          zoom: 18.5,
          duration: 800,
        });
        break;
      case "scout":
        // Isometric Location Scout view
        mapRef.current.easeTo({
          pitch: 48,
          zoom: 17.5,
          duration: 800,
        });
        break;
      case "aerial":
        // Drone top-down view
        mapRef.current.easeTo({
          pitch: 15,
          zoom: 16.5,
          duration: 800,
        });
        break;
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e8e6df] select-none">
      {/* 3D Map Viewport with CSS Comic Lens Warping */}
      <div
        ref={containerRef}
        className="h-full w-full transition-transform duration-300"
        style={{
          transform: `perspective(${lensTransform.perspective}px) scale(${lensTransform.scale})`,
        }}
      />

      {/* SVG Screentone / Halftone Dot Screen Shader Overlay */}
      {showScreentone && (
        <div
          className="pointer-events-none absolute inset-0 z-10 mix-blend-multiply opacity-25 dark:mix-blend-screen dark:opacity-20"
          style={{
            backgroundImage: `radial-gradient(#000 1.2px, transparent 1.2px)`,
            backgroundSize: `6px 6px`,
          }}
        />
      )}

      {/* Overhead Suspended Electrical Cable & Utility Poles Overlay */}
      {showOverheadWires && (
        <svg
          className="pointer-events-none absolute inset-x-0 top-0 h-48 w-full z-20 opacity-40 dark:opacity-60"
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
        >
          {/* Tangled Southeast Asian street wires drooping in realistic catenary arcs */}
          <path
            d="M 0,25 Q 250,95 500,45 T 1000,30"
            fill="none"
            stroke="black"
            strokeWidth="1.5"
          />
          <path
            d="M 0,40 Q 300,120 600,60 T 1000,50"
            fill="none"
            stroke="black"
            strokeWidth="1.2"
          />
          <path
            d="M 0,15 Q 400,105 750,55 T 1000,35"
            fill="none"
            stroke="black"
            strokeWidth="0.9"
          />
          <path
            d="M 200,0 L 200,120 M 800,0 L 800,140"
            stroke="black"
            strokeWidth="2.5"
          />
        </svg>
      )}

      {/* Street Level Poles, Signals & Tuk-Tuk Silhouettes */}
      {showPolesAndSignals && (
        <div className="pointer-events-none absolute bottom-12 right-12 z-20 hidden md:flex items-end gap-6 opacity-35 dark:opacity-55">
          {/* Tuk-Tuk Silhouette */}
          <svg width="72" height="48" viewBox="0 0 72 48" fill="currentColor" className="text-stone-900 dark:text-stone-100">
            <path d="M 10,38 A 6,6 0 1,0 22,38 A 6,6 0 1,0 10,38 Z M 50,38 A 6,6 0 1,0 62,38 A 6,6 0 1,0 50,38 Z M 16,36 L 40,36 L 46,24 L 20,24 Z M 46,24 L 60,26 L 64,36 L 56,36 M 16,24 L 14,14 L 38,12 L 44,24 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}

      {/* Manga Speed-Lines Warp Overlay (fires when jumping to a place) */}
      {isWarping && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center animate-pulse">
          <svg className="h-full w-full opacity-60" viewBox="0 0 800 600">
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = (i * 10 * Math.PI) / 180;
              const x1 = 400 + Math.cos(angle) * 80;
              const y1 = 300 + Math.sin(angle) * 80;
              const x2 = 400 + Math.cos(angle) * 600;
              const y2 = 300 + Math.sin(angle) * 600;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={shaderStyle === "neon-noir" ? "#38bdf8" : "black"}
                  strokeWidth={i % 2 === 0 ? "3" : "1.5"}
                  strokeDasharray="40 10"
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Floating View Angle / Perspective Toolbar */}
      <div className="pointer-events-auto absolute top-3 left-3 z-30 flex items-center gap-1 border border-[var(--line-bright)] bg-[var(--bg-raised)]/90 p-1 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleViewPresetChange("eye")}
          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
            viewPreset === "eye"
              ? "border-[var(--cool)] bg-[var(--cool)] text-white"
              : "border-transparent text-[var(--ink)] hover:border-[var(--line)]"
          }`}
          title="Pedestrian Eye Level (80° Pitch)"
        >
          <Footprints size={12} />
          <span>Eye Level (Stand Here)</span>
        </button>
        <button
          type="button"
          onClick={() => handleViewPresetChange("scout")}
          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
            viewPreset === "scout"
              ? "border-[var(--cool)] bg-[var(--cool)] text-white"
              : "border-transparent text-[var(--ink)] hover:border-[var(--line)]"
          }`}
          title="Location Scout Isometric (48° Pitch)"
        >
          <Eye size={12} />
          <span>Scout (45°)</span>
        </button>
        <button
          type="button"
          onClick={() => handleViewPresetChange("aerial")}
          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
            viewPreset === "aerial"
              ? "border-[var(--cool)] bg-[var(--cool)] text-white"
              : "border-transparent text-[var(--ink)] hover:border-[var(--line)]"
          }`}
          title="Drone Top-Down Perspective"
        >
          <Maximize2 size={12} />
          <span>Drone</span>
        </button>
      </div>

      {/* Street Compass HUD & Controls legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex items-center gap-3">
        <div className="pointer-events-auto flex items-center gap-1.5 border border-[var(--line)] bg-[var(--bg-raised)]/90 px-2.5 py-1 font-mono text-[9px] font-bold text-[var(--ink)] backdrop-blur-xs">
          <Compass
            size={13}
            className="text-[var(--cool)] transition-transform duration-200"
            style={{ transform: `rotate(${-cameraBearing}deg)` }}
          />
          <span>{neighborhood.name}</span>
          <span className="text-[var(--dim)]">·</span>
          <span>{Math.round(cameraBearing)}° HDG</span>
          <span className="text-[var(--dim)]">·</span>
          <span>{Math.round(cameraPitch)}° PITCH</span>
        </div>

        <div className="hidden sm:flex pointer-events-auto items-center gap-2 border border-[var(--line)] bg-[var(--bg-raised)]/90 px-2.5 py-1 font-mono text-[8px] text-[var(--dim)] backdrop-blur-xs">
          <span className="font-bold text-[var(--ink)]">WASD / Arrows:</span>
          <span>Walk</span>
          <span>•</span>
          <span className="font-bold text-[var(--ink)]">F:</span>
          <span>Stand at Doorstep</span>
          <span>•</span>
          <span className="font-bold text-[var(--ink)]">Drag:</span>
          <span>Look 360°</span>
        </div>
      </div>

      {/* On-Screen Mobile Walking D-Pad (for phones & tablets) */}
      <div className="sm:hidden pointer-events-auto absolute bottom-3 right-3 z-30 grid grid-cols-3 gap-1 bg-black/60 p-1.5 backdrop-blur-md">
        <div />
        <button
          type="button"
          onClick={() => mapRef.current?.panBy([0, -80], { duration: 250 })}
          className="flex h-8 w-8 items-center justify-center bg-white/20 text-white font-mono text-[10px] font-bold active:bg-white active:text-black"
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          onClick={() => mapRef.current?.easeTo({ bearing: mapRef.current.getBearing() - 20, duration: 250 })}
          className="flex h-8 w-8 items-center justify-center bg-white/20 text-white font-mono text-[10px] font-bold active:bg-white active:text-black"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.panBy([0, 80], { duration: 250 })}
          className="flex h-8 w-8 items-center justify-center bg-white/20 text-white font-mono text-[10px] font-bold active:bg-white active:text-black"
        >
          ▼
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.easeTo({ bearing: mapRef.current.getBearing() + 20, duration: 250 })}
          className="flex h-8 w-8 items-center justify-center bg-white/20 text-white font-mono text-[10px] font-bold active:bg-white active:text-black"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

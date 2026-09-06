"use client";

// Center map — the water system drawn as a system. Reaches are paths
// sized by discharge and colored by status, with animated pulses
// (deck.gl TripsLayer) running downstream so direction and tempo read
// at a glance. Sensor nodes, fill zones, CCTV slots, satellite lenses,
// terrain + 3D city, and a what-if water plane sit on top.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { FlyToInterpolator } from "@deck.gl/core";
import type { DeckGLProps } from "@deck.gl/react";
import { TileLayer, TripsLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { CollisionFilterExtension, type CollisionFilterExtensionProps } from "@deck.gl/extensions";
import { Box, Cctv, Satellite, Waves, X } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type maplibregl from "maplibre-gl";
import { basemapStyle, BASEMAP_OPTIONS, type BasemapId } from "../../services/basemap-styles";
import { buildSatelliteLayerCatalog, type SatelliteLayerDefinition } from "../../lib/geo/satellite-layers";
import { applyCity3D } from "../../lib/geo/city3d";
import { findNstCorridor, NST_CORRIDORS, NST_PROVINCE } from "../../lib/nst/config";
import type { CctvSlot, NstNodeState, NstReachState, NstWatershedResponse, NstZoneState, WaterStatus } from "../../types/nst";
import { STATUS_HEX } from "./WatershedSidebar";

const DeckGL = dynamic<DeckGLProps>(() => import("@deck.gl/react").then((m) => m.default), { ssr: false });
const MapboxMap = dynamic(() => import("react-map-gl/maplibre"), { ssr: false });

const STATUS_RGB: Record<WaterStatus, [number, number, number]> = {
  normal: [34, 197, 94], watch: [245, 158, 11], warning: [249, 115, 22], critical: [239, 68, 68],
};
const ZONE_RGBA: Record<NstZoneState["status"], [number, number, number, number]> = {
  dry: [133, 133, 133, 18], watch: [245, 158, 11, 50], ponding: [14, 165, 233, 80], flooded: [239, 68, 68, 90],
};
const MAP_BASEMAPS: BasemapId[] = ["street", "satellite", "topography", "vegetation"];
const LOOP = 2400; // animation period units

export type MapSelection =
  | { kind: "node"; node: NstNodeState }
  | { kind: "reach"; reach: NstReachState }
  | { kind: "zone"; zone: NstZoneState }
  | { kind: "camera"; camera: CctvSlot };

function shortLabel(n: NstNodeState) {
  return n.name.replace(/^Khlong /, "").replace(/ @ /, " · ").split(" (")[0].slice(0, 26);
}

export default function NstMap({
  data, cameras, selectedCorridorId, onCorridorSelect, whatIfLevel, externalSelection, onClearExternalSelection,
}: {
  data: NstWatershedResponse | null;
  cameras: CctvSlot[];
  selectedCorridorId: string;
  onCorridorSelect: (id: string) => void;
  whatIfLevel: number;
  externalSelection: MapSelection | null;
  onClearExternalSelection: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState<MapViewState>({ ...NST_PROVINCE.defaultView });
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("street");
  const [satLayerId, setSatLayerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [lensOpen, setLensOpen] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [flowAnim, setFlowAnim] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const is3DRef = useRef(is3D);
  const mlMapRef = useRef<maplibregl.Map | null>(null);
  const satCatalog = useMemo(() => buildSatelliteLayerCatalog(), []);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  // Flow pulse animation — one rAF loop, paused for reduced-motion users.
  useEffect(() => {
    if (!flowAnim) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      setCurrentTime(((t - start) / 16) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flowAnim]);

  // Sidebar / panel / strip clicks arrive as an external selection.
  const [lastExternal, setLastExternal] = useState<MapSelection | null>(null);
  if (externalSelection && externalSelection !== lastExternal) {
    setLastExternal(externalSelection);
    setSelection(externalSelection);
    const target =
      externalSelection.kind === "node" ? { lon: externalSelection.node.lon, lat: externalSelection.node.lat, zoom: 12.6 }
      : externalSelection.kind === "camera" ? { lon: externalSelection.camera.lon, lat: externalSelection.camera.lat, zoom: 13 }
      : externalSelection.kind === "zone" ? { lon: externalSelection.zone.polygon.reduce((s, p) => s + p[0], 0) / externalSelection.zone.polygon.length, lat: externalSelection.zone.polygon.reduce((s, p) => s + p[1], 0) / externalSelection.zone.polygon.length, zoom: 12.2 }
      : null;
    if (target) {
      setViewState((prev) => ({ ...prev, longitude: target.lon, latitude: target.lat, zoom: Math.max(prev.zoom, target.zoom), transitionDuration: 900, transitionInterpolator: new FlyToInterpolator() }));
    }
  }

  const flyToCorridor = useCallback((id: string) => {
    onCorridorSelect(id);
    const c = findNstCorridor(id);
    if (c) setViewState((prev) => ({ ...prev, ...c.view, transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator() }));
  }, [onCorridorSelect]);

  const handleViewStateChange = useCallback((params: { viewState: MapViewState }) => setViewState(params.viewState), []);

  const handleMapLoad = useCallback((event: { target: maplibregl.Map }) => {
    mlMapRef.current = event.target;
    applyCity3D(event.target, is3DRef.current, activeBasemap, { prefix: "nst", exaggeration: 1.8 });
  }, [activeBasemap]);
  useEffect(() => {
    is3DRef.current = is3D;
    if (mlMapRef.current) applyCity3D(mlMapRef.current, is3D, activeBasemap, { prefix: "nst", exaggeration: 1.8 });
  }, [is3D, activeBasemap]);

  const activeSat: SatelliteLayerDefinition | null = satCatalog.find((l) => l.id === satLayerId) ?? null;

  // Trips: timestamps along each reach scale with 1/velocity so faster
  // water pulses faster. Same loop length for every reach.
  const trips = useMemo(() => {
    if (!data) return [];
    return data.reaches.map((r) => {
      const ts: number[] = [0];
      let acc = 0;
      for (let i = 1; i < r.path.length; i++) {
        const [x1, y1] = r.path[i - 1];
        const [x2, y2] = r.path[i];
        acc += Math.hypot((x2 - x1) * 111.3, (y2 - y1) * 110.6);
        ts.push(acc);
      }
      const scale = (LOOP * 0.55) / Math.max(acc, 0.1) / Math.max(r.velocity, 0.3) * 0.9;
      return { reach: r, path: r.path, timestamps: ts.map((v) => v * scale) };
    });
  }, [data]);

  const layers = useMemo(() => {
    const out: unknown[] = [];
    if (activeSat) {
      out.push(new TileLayer({
        id: `sat-${activeSat.id}`, data: activeSat.tileTemplate, maxZoom: activeSat.maxZoom, minZoom: 0, tileSize: 256, opacity: activeSat.opacity,
        renderSubLayers: (props) => {
          const bb = props.tile.boundingBox as [number[], number[]];
          return new BitmapLayer(props as never, { data: undefined, image: props.data as string, bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]] });
        },
      }));
    }
    const zones = data?.zones ?? [];
    out.push(new PolygonLayer<NstZoneState>({
      id: "fill-zones", data: zones, getPolygon: (z) => z.polygon, stroked: true, filled: true, pickable: true,
      getFillColor: (z) => (whatIfLevel > 0 ? (z.elevationM <= whatIfLevel ? [14, 165, 233, 110] : [133, 133, 133, 10]) : ZONE_RGBA[z.status]) as [number, number, number, number],
      getLineColor: (z) => (whatIfLevel > 0 && z.elevationM <= whatIfLevel ? [14, 165, 233, 220] : [...(z.status === "dry" ? [133, 133, 133] : z.status === "watch" ? [245, 158, 11] : z.status === "ponding" ? [14, 165, 233] : [239, 68, 68]), 200]) as [number, number, number, number],
      lineWidthMinPixels: 1,
      onClick: (info: PickingInfo<NstZoneState>) => { if (info.object) setSelection({ kind: "zone", zone: info.object }); },
      updateTriggers: { getFillColor: [whatIfLevel], getLineColor: [whatIfLevel] },
    }));
    const reaches = data?.reaches ?? [];
    out.push(new PathLayer<NstReachState>({
      id: "reaches", data: reaches, getPath: (r) => r.path, pickable: true, capRounded: true, jointRounded: true,
      getColor: (r) => [...STATUS_RGB[r.status], 150] as [number, number, number, number],
      getWidth: (r) => 60 + Math.sqrt(Math.max(r.discharge, 1)) * 28,
      widthUnits: "meters", widthMinPixels: 2, widthMaxPixels: 16,
      onClick: (info: PickingInfo<NstReachState>) => { if (info.object) setSelection({ kind: "reach", reach: info.object }); },
    }));
    if (flowAnim) {
      out.push(new TripsLayer<{ reach: NstReachState; path: [number, number][]; timestamps: number[] }>({
        id: "flow-pulses", data: trips, getPath: (d) => d.path, getTimestamps: (d) => d.timestamps,
        getColor: (d) => (d.reach.status === "normal" ? [180, 230, 255] : [255, 255, 255]) as [number, number, number],
        opacity: 0.95, widthMinPixels: 2, widthMaxPixels: 6, capRounded: true, jointRounded: true,
        trailLength: LOOP * 0.18, currentTime,
      }));
    }
    const nodes = (data?.nodes ?? []);
    out.push(new ScatterplotLayer<NstNodeState>({
      id: "nodes", data: nodes, getPosition: (n) => [n.lon, n.lat], pickable: true, stroked: true, lineWidthMinPixels: 1.5,
      getFillColor: (n) => (n.kind === "outlet" || n.kind === "catchment" ? [13, 17, 23, 200] : [...STATUS_RGB[n.status], 230]) as [number, number, number, number],
      getLineColor: (n) => [...STATUS_RGB[n.status], 255] as [number, number, number, number],
      getRadius: (n) => (n.kind === "split" || n.kind === "city" ? 520 : n.onNetwork ? 400 : 260),
      radiusMinPixels: 4, radiusMaxPixels: 14,
      onClick: (info: PickingInfo<NstNodeState>) => { if (info.object) setSelection({ kind: "node", node: info.object }); },
    }));
    out.push(new TextLayer<NstNodeState, CollisionFilterExtensionProps<NstNodeState>>({
      id: "node-labels", data: nodes.filter((n) => n.onNetwork), getPosition: (n) => [n.lon, n.lat], getText: (n) => shortLabel(n),
      getSize: 10, getColor: [230, 237, 243, 235], getPixelOffset: [0, -14], fontFamily: "IBM Plex Mono, monospace", fontWeight: 700,
      background: true, getBackgroundColor: [13, 17, 23, 170], backgroundPadding: [3, 2], sizeUnits: "pixels",
      // Labels yield to each other at province zoom: split / city / outlets win,
      // catchment gauges next, plain gauges last. Zooming in reveals the rest.
      extensions: [new CollisionFilterExtension()],
      collisionEnabled: true,
      collisionGroup: "node-labels",
      collisionTestProps: { sizeScale: 2.2 },
      getCollisionPriority: (n: NstNodeState) => (n.kind === "split" || n.kind === "city" ? 100 : n.kind === "outlet" ? 80 : n.kind === "catchment" ? 60 : n.kind === "gate" ? 40 : 20),
    }));
    out.push(new ScatterplotLayer<CctvSlot>({
      id: "cctv-slots", data: cameras, getPosition: (d) => [d.lon, d.lat], pickable: true, stroked: true, lineWidthMinPixels: 1,
      getFillColor: (d) => (d.status === "live" ? [239, 68, 68, 235] : [88, 166, 255, 170]) as [number, number, number, number],
      getLineColor: [255, 255, 255, 235], getRadius: 220, radiusMinPixels: 3, radiusMaxPixels: 9,
      onClick: (info: PickingInfo<CctvSlot>) => { if (info.object) setSelection({ kind: "camera", camera: info.object }); },
    }));
    return out;
  }, [activeSat, data, cameras, whatIfLevel, flowAnim, trips, currentTime]);

  const corridor = findNstCorridor(selectedCorridorId);
  const mapStyle = useMemo(() => basemapStyle(activeBasemap), [activeBasemap]);
  const clearSelection = () => { setSelection(null); onClearExternalSelection(); };
  const pill = (active: boolean) => `border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] transition-colors min-[3000px]:text-[11px] ${active ? "border-[var(--cool)] text-[var(--cool)]" : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"}`;

  if (!mounted) return <div className="relative h-full w-full bg-[var(--bg-raised)] animate-pulse" />;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckGL
        id="nst-deck" viewState={viewState} onViewStateChange={handleViewStateChange as DeckGLProps["onViewStateChange"]} controller={true} layers={layers as DeckGLProps["layers"]}
        getTooltip={({ object }: PickingInfo<unknown>) => {
          if (!object) return null;
          const o = object as NstNodeState | NstReachState | NstZoneState | CctvSlot;
          if ("fillOrder" in o) return { text: `${o.name}\n${o.status.toUpperCase()} · fills #${o.fillOrder} · ${o.elevationM} m MSL` };
          if ("lengthKm" in o) return { text: `${o.name}\n${o.discharge} m3/s · ${o.velocity} m/s · ${o.travelHours} h` };
          if ("kind" in o) return { text: `${o.name}\n${o.status.toUpperCase()}${o.capacityPct !== null ? ` · ${o.capacityPct}% bank` : ""}${o.rainfall24h !== null ? ` · ${o.rainfall24h} mm` : ""}` };
          return { text: `${o.label}\nCCTV ${o.status === "live" ? "LIVE" : "slot"}` };
        }}
      >
        <MapboxMap key={activeBasemap} mapStyle={mapStyle as never} attributionControl={false} renderWorldCopies={false}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onLoad={handleMapLoad as any} />
      </DeckGL>

      <div className="pointer-events-none absolute inset-0 z-40">
        {/* Top-left: province + corridor pills */}
        <div className="pointer-events-auto absolute left-2 top-2 w-[252px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[400px]">
          <div className="flex items-center justify-between">
            <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[11px]">นครศรีธรรมราช · Nakhon Si Thammarat</div>
            {data && <span className="live-badge">{data.source === "live" ? "LIVE" : data.source === "scenario" ? "SCN" : "MODEL"}</span>}
          </div>
          <div className="mt-0.5 text-[12px] font-bold tracking-[-0.02em] text-[var(--ink)] min-[3000px]:text-[18px]">Water system map</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {NST_CORRIDORS.map((c) => (
              <button key={c.id} type="button" onClick={() => flyToCorridor(c.id)} aria-pressed={c.id === selectedCorridorId} className={pill(c.id === selectedCorridorId)}>{c.label}</button>
            ))}
          </div>
          {corridor && <p className="mt-1.5 text-[8px] leading-[13px] text-[var(--muted)] min-[3000px]:text-[12px] min-[3000px]:leading-5">{corridor.defaultAction}</p>}
        </div>

        {/* Bottom-left: lens + 3D + flow + basemap + legend */}
        <div className="pointer-events-auto absolute bottom-2 left-2 w-[224px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[340px]">
          <div className="flex items-center justify-between gap-1.5">
            <button type="button" onClick={() => setLensOpen((v) => !v)} className="flex min-w-0 flex-1 items-center justify-between text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[11px]">
              <span className="flex items-center gap-1.5"><Satellite size={10} className="text-[var(--cool)]" /> Layers</span>
              <span>{lensOpen ? "–" : "+"}</span>
            </button>
            <button type="button" onClick={() => setFlowAnim((v) => !v)} aria-pressed={flowAnim} title="Animated flow direction" className={`flex shrink-0 items-center gap-1 ${pill(flowAnim)}`}><Waves size={9} /> flow</button>
            <button type="button" onClick={() => setIs3D((v) => !v)} aria-pressed={is3D} title="Terrain + every OSM building in 3D" className={`flex shrink-0 items-center gap-1 ${pill(is3D)}`}><Box size={9} /> 3D</button>
          </div>
          {lensOpen && (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button type="button" onClick={() => setSatLayerId(null)} aria-pressed={satLayerId === null} className={pill(satLayerId === null)}>OFF</button>
                {satCatalog.map((l) => (
                  <button key={l.id} type="button" onClick={() => setSatLayerId(l.id)} aria-pressed={satLayerId === l.id} title={`${l.label} — ${l.source}`} className={pill(satLayerId === l.id)}>{l.shortLabel}</button>
                ))}
              </div>
              <div className="mt-1.5 border-t border-[var(--line)] pt-1.5">
                <div className="flex flex-wrap gap-1">
                  {BASEMAP_OPTIONS.filter((b) => MAP_BASEMAPS.includes(b.id)).map((b) => (
                    <button key={b.id} type="button" onClick={() => setActiveBasemap(b.id)} aria-pressed={activeBasemap === b.id} className={pill(activeBasemap === b.id)}>{b.label}</button>
                  ))}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--line)] pt-1.5 text-[7px] uppercase tracking-[0.1em] text-[var(--dim)] min-[3000px]:text-[10px]">
                <span className="flex items-center gap-1"><span className="h-1.5 w-3" style={{ background: STATUS_HEX.normal }} /> within bank</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3" style={{ background: STATUS_HEX.watch }} /> watch</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3" style={{ background: STATUS_HEX.critical }} /> over</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 border" style={{ borderColor: "#0ea5e9", background: "rgba(14,165,233,0.35)" }} /> ponding</span>
                <span className="flex items-center gap-1"><Cctv size={9} className="text-[#58a6ff]" /> cctv</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 bg-white" /> pulse = direction · width = m3/s</span>
              </div>
            </>
          )}
        </div>

        {/* Top-right: selection detail */}
        {selection && (
          <div className="pointer-events-auto absolute right-2 top-2 w-[248px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[380px]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[10px]">
                  {selection.kind === "node" ? `${selection.node.kind} · ${selection.node.branch} branch` : selection.kind === "reach" ? "Reach" : selection.kind === "zone" ? `Fill zone #${selection.zone.fillOrder}` : "CCTV slot"}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-bold text-[var(--ink)] min-[3000px]:text-[16px]">
                  {selection.kind === "node" ? selection.node.name : selection.kind === "reach" ? selection.reach.name : selection.kind === "zone" ? selection.zone.name : selection.camera.label}
                </div>
              </div>
              <button type="button" onClick={clearSelection} aria-label="Close detail" className="shrink-0 text-[var(--dim)] hover:text-[var(--ink)]"><X size={11} /></button>
            </div>
            <div className="mt-1.5 space-y-1 text-[8px] text-[var(--muted)] min-[3000px]:text-[12px]">
              {selection.kind === "node" && (<>
                <Row k="STATUS" v={selection.node.status.toUpperCase()} c={STATUS_HEX[selection.node.status]} />
                {selection.node.waterLevelMsl !== null && <Row k={selection.node.kind === "outlet" ? "SEA LEVEL" : "WATER / BANK"} v={selection.node.kind === "outlet" ? `${selection.node.waterLevelMsl} m` : `${selection.node.waterLevelMsl} / ${selection.node.bankLevelMsl ?? "—"} m`} />}
                {selection.node.discharge !== null && <Row k="FLOW" v={`${selection.node.discharge} m3/s`} />}
                {selection.node.rainfall24h !== null && <Row k="RAIN 24H" v={`${selection.node.rainfall24h} mm`} />}
                <Row k="TREND" v={selection.node.trend} />
                <p className="border-t border-[var(--line)] pt-1 leading-[13px] min-[3000px]:leading-5">{selection.node.note}</p>
              </>)}
              {selection.kind === "reach" && (<>
                <Row k="STATUS" v={selection.reach.status.toUpperCase()} c={STATUS_HEX[selection.reach.status]} />
                <Row k="CARRYING" v={`${selection.reach.discharge} m3/s${selection.reach.designCapacity ? ` / ${selection.reach.designCapacity}` : ""}`} />
                <Row k="VELOCITY" v={`${selection.reach.velocity} m/s`} />
                <Row k="LENGTH · TRAVEL" v={`${selection.reach.lengthKm} km · ${selection.reach.travelHours} h`} />
                <Row k="FROM → TO" v={`${selection.reach.fromNode} → ${selection.reach.toNode}`} />
              </>)}
              {selection.kind === "zone" && (<>
                <Row k="STATUS" v={selection.zone.status.toUpperCase()} c={selection.zone.status === "dry" ? undefined : selection.zone.status === "watch" ? "#f59e0b" : selection.zone.status === "ponding" ? "#0ea5e9" : "#ef4444"} />
                <Row k="PLAIN" v={`${selection.zone.elevationM} m MSL`} />
                <Row k="DRAINS VIA" v={selection.zone.outlet} />
                {selection.zone.etaHours !== null && <Row k="ETA" v={`${selection.zone.etaHours} h`} c="#ef4444" />}
                <p className="border-t border-[var(--line)] pt-1 leading-[13px] min-[3000px]:leading-5">{selection.zone.note}</p>
              </>)}
              {selection.kind === "camera" && (<>
                {selection.camera.snapshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selection.camera.snapshotUrl} alt={selection.camera.label} className="w-full border border-[var(--line)] object-cover" />
                ) : (
                  <div className="flex h-[64px] flex-col items-center justify-center gap-1 border border-[var(--line)] bg-[var(--bg-raised)]">
                    <Cctv size={14} className="text-[var(--dim)]" />
                    <span className="font-mono text-[6px] uppercase tracking-[0.18em] text-[var(--dim)] min-[3000px]:text-[9px]">slot — awaiting feed</span>
                  </div>
                )}
                <Row k="PROTOCOL" v={selection.camera.wiring.protocol.toUpperCase()} />
                <Row k="OWNER" v={selection.camera.wiring.owner} />
                <p className="border-t border-[var(--line)] pt-1 leading-[13px] min-[3000px]:leading-5">{selection.camera.wiring.note}</p>
              </>)}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-1 right-1 bg-[var(--bg-surface)] px-1.5 py-0.5 text-[6px] uppercase tracking-[0.12em] text-[var(--dim)] min-[3000px]:text-[9px]">
          {activeSat ? `${activeSat.source} · ` : ""}{is3D ? "terrain AWS/Mapzen · buildings OSM · " : ""}basemap © OSM / Carto / Esri
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="flex justify-between gap-2 font-mono">
      <span>{k}</span>
      <span className="text-right font-bold" style={{ color: c ?? "var(--ink)" }}>{v}</span>
    </div>
  );
}

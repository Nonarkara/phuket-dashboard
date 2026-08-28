"use client";

// Center map of the Lopburi war room. Same map-first grammar as the
// Phuket BorderMap: MapLibre basemap + deck.gl operator overlays,
// compact corner overlays only (no full-width bars), corridor pills
// inline inside the top-left info panel.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import { FlyToInterpolator } from "@deck.gl/core";
import type { DeckGLProps } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Cctv, Satellite, X } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { basemapStyle, BASEMAP_OPTIONS, type BasemapId } from "../../services/basemap-styles";
import {
  buildSatelliteLayerCatalog,
  findLopburiCorridor,
  LOPBURI_CORRIDORS,
  LOPBURI_PROVINCE,
  type SatelliteLayerDefinition,
} from "../../lib/lopburi/config";
import type {
  CctvSlot,
  LopburiFloodResponse,
  LopburiFloodStation,
} from "../../types/lopburi";

const DeckGL = dynamic<DeckGLProps>(
  () => import("@deck.gl/react").then((m) => m.default),
  { ssr: false },
);
const MapboxMap = dynamic(() => import("react-map-gl/maplibre"), { ssr: false });

const STATUS_RGB: Record<LopburiFloodStation["status"], [number, number, number]> = {
  normal: [34, 197, 94],
  watch: [245, 158, 11],
  warning: [249, 115, 22],
  critical: [239, 68, 68],
};

const MAP_BASEMAPS: BasemapId[] = ["street", "satellite", "topography", "vegetation"];

interface Selection {
  kind: "station" | "camera";
  station?: LopburiFloodStation;
  camera?: CctvSlot;
}

export default function LopburiMap({
  flood,
  cameras,
  selectedCorridorId,
  onCorridorSelect,
  externalCameraSelection,
  onClearExternalCamera,
}: {
  flood: LopburiFloodResponse | null;
  cameras: CctvSlot[];
  selectedCorridorId: string;
  onCorridorSelect: (id: string) => void;
  externalCameraSelection: CctvSlot | null;
  onClearExternalCamera: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState<MapViewState>({
    ...LOPBURI_PROVINCE.defaultView,
  });
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("street");
  const [satLayerId, setSatLayerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [satPanelOpen, setSatPanelOpen] = useState(true);

  const satCatalog = useMemo(() => buildSatelliteLayerCatalog(), []);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  // CCTV strip clicks fly the map to the slot — render-time state
  // adjustment (the React "derive state from props" pattern).
  const [lastStripCamera, setLastStripCamera] = useState<CctvSlot | null>(null);
  if (externalCameraSelection && externalCameraSelection !== lastStripCamera) {
    setLastStripCamera(externalCameraSelection);
    setSelection({ kind: "camera", camera: externalCameraSelection });
    setViewState((prev) => ({
      ...prev,
      longitude: externalCameraSelection.lon,
      latitude: externalCameraSelection.lat,
      zoom: Math.max(prev.zoom, 12.5),
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }

  const flyToCorridor = useCallback(
    (id: string) => {
      onCorridorSelect(id);
      const corridor = findLopburiCorridor(id);
      if (!corridor) return;
      setViewState((prev) => ({
        ...prev,
        ...corridor.view,
        transitionDuration: 1100,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    },
    [onCorridorSelect],
  );

  const handleViewStateChange = useCallback(
    (params: { viewState: MapViewState }) => {
      setViewState(params.viewState);
    },
    [],
  );

  const activeSatLayer: SatelliteLayerDefinition | null =
    satCatalog.find((l) => l.id === satLayerId) ?? null;

  const layers = useMemo(() => {
    const out: unknown[] = [];

    if (activeSatLayer) {
      out.push(
        new TileLayer({
          id: `sat-${activeSatLayer.id}`,
          data: activeSatLayer.tileTemplate,
          maxZoom: activeSatLayer.maxZoom,
          minZoom: 0,
          tileSize: 256,
          opacity: activeSatLayer.opacity,
          renderSubLayers: (props) => {
            const bb = props.tile.boundingBox as [number[], number[]];
            return new BitmapLayer(props as never, {
              data: undefined,
              image: props.data as string,
              bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
            });
          },
        }),
      );
    }

    const stations = flood?.stations ?? [];
    out.push(
      new ScatterplotLayer<LopburiFloodStation>({
        id: "flood-stations",
        data: stations,
        getPosition: (d) => [d.lon, d.lat],
        getFillColor: (d) => [...STATUS_RGB[d.status], 200] as [number, number, number, number],
        getLineColor: [255, 255, 255, 220],
        getRadius: (d) => 500 + d.capacityPct * 14,
        radiusMinPixels: 5,
        radiusMaxPixels: 26,
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        onClick: (info: PickingInfo<LopburiFloodStation>) => {
          if (info.object) setSelection({ kind: "station", station: info.object });
        },
      }),
    );

    out.push(
      new ScatterplotLayer<CctvSlot>({
        id: "cctv-slots",
        data: cameras,
        getPosition: (d) => [d.lon, d.lat],
        getFillColor: (d) =>
          d.status === "live" ? [239, 68, 68, 235] : [88, 166, 255, 180],
        getLineColor: [255, 255, 255, 235],
        getRadius: 380,
        radiusMinPixels: 4,
        radiusMaxPixels: 12,
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        onClick: (info: PickingInfo<CctvSlot>) => {
          if (info.object) setSelection({ kind: "camera", camera: info.object });
        },
      }),
    );

    return out;
  }, [activeSatLayer, flood, cameras]);

  const corridor = findLopburiCorridor(selectedCorridorId);
  const mapStyle = useMemo(() => basemapStyle(activeBasemap), [activeBasemap]);

  const clearSelection = () => {
    setSelection(null);
    onClearExternalCamera();
  };

  if (!mounted) {
    return <div className="relative h-full w-full bg-[var(--bg-raised)] animate-pulse" />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckGL
        id="lopburi-deck"
        viewState={viewState}
        onViewStateChange={handleViewStateChange as DeckGLProps["onViewStateChange"]}
        controller={true}
        layers={layers as DeckGLProps["layers"]}
        getTooltip={({ object }: PickingInfo<unknown>) => {
          if (!object) return null;
          const o = object as LopburiFloodStation | CctvSlot;
          if ("capacityPct" in o) {
            return { text: `${o.name}\n${o.status.toUpperCase()} · ${o.capacityPct}% bank capacity` };
          }
          return { text: `${o.label}\nCCTV ${o.status === "live" ? "LIVE" : "slot"}` };
        }}
      >
        <MapboxMap
          key={activeBasemap}
          mapStyle={mapStyle as never}
          attributionControl={false}
          renderWorldCopies={false}
        />
      </DeckGL>

      {/* Overlay wrapper — never blocks the map */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {/* Top-left: province info panel with inline corridor pills */}
        <div className="pointer-events-auto absolute left-2 top-2 w-[248px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[400px]">
          <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[11px]">
            ลพบุรี · Lopburi province
          </div>
          <div className="mt-0.5 text-[12px] font-bold tracking-[-0.02em] text-[var(--ink)] min-[3000px]:text-[18px]">
            Basin operations map
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {LOPBURI_CORRIDORS.map((c) => {
              const active = c.id === selectedCorridorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => flyToCorridor(c.id)}
                  aria-pressed={active}
                  className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] transition-colors min-[3000px]:text-[11px] ${
                    active
                      ? "border-[var(--cool)] text-[var(--cool)]"
                      : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {corridor && (
            <p className="mt-1.5 text-[8px] leading-[13px] text-[var(--muted)] min-[3000px]:text-[12px] min-[3000px]:leading-5">
              {corridor.defaultAction}
            </p>
          )}
        </div>

        {/* Bottom-left: satellite lens selector + basemap + legend */}
        <div className="pointer-events-auto absolute bottom-2 left-2 w-[212px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[340px]">
          <button
            type="button"
            onClick={() => setSatPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <Satellite size={10} className="text-[var(--cool)]" /> Satellite layers
            </span>
            <span>{satPanelOpen ? "–" : "+"}</span>
          </button>
          {satPanelOpen && (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSatLayerId(null)}
                  aria-pressed={satLayerId === null}
                  className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] min-[3000px]:text-[11px] ${
                    satLayerId === null
                      ? "border-[var(--cool)] text-[var(--cool)]"
                      : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  OFF
                </button>
                {satCatalog.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSatLayerId(l.id)}
                    aria-pressed={satLayerId === l.id}
                    title={`${l.label} — ${l.source}`}
                    className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] min-[3000px]:text-[11px] ${
                      satLayerId === l.id
                        ? "border-[var(--cool)] text-[var(--cool)]"
                        : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {l.shortLabel}
                  </button>
                ))}
              </div>
              {activeSatLayer && (
                <div className="mt-1 text-[7px] uppercase tracking-[0.14em] text-[var(--dim)] min-[3000px]:text-[10px]">
                  {activeSatLayer.source}
                </div>
              )}
              <div className="mt-2 border-t border-[var(--line)] pt-1.5">
                <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[10px]">
                  Basemap
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {BASEMAP_OPTIONS.filter((b) => MAP_BASEMAPS.includes(b.id)).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setActiveBasemap(b.id)}
                      aria-pressed={activeBasemap === b.id}
                      className={`border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] min-[3000px]:text-[11px] ${
                        activeBasemap === b.id
                          ? "border-[var(--cool)] text-[var(--cool)]"
                          : "border-[var(--line)] text-[var(--dim)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--line)] pt-1.5 text-[7px] uppercase tracking-[0.1em] text-[var(--dim)] min-[3000px]:text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> watch
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /> warn+
                </span>
                <span className="flex items-center gap-1">
                  <Cctv size={9} className="text-[#58a6ff]" /> cctv slot
                </span>
              </div>
            </>
          )}
        </div>

        {/* Top-right: selection detail card */}
        {selection && (
          <div className="pointer-events-auto absolute right-2 top-2 w-[240px] map-overlay-panel px-2.5 py-2 min-[3000px]:w-[380px]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[var(--dim)] min-[3000px]:text-[10px]">
                  {selection.kind === "station" ? "Flood telemetry" : "CCTV slot"}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-bold text-[var(--ink)] min-[3000px]:text-[16px]" lang="th">
                  {selection.kind === "station" ? selection.station?.name : selection.camera?.label}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Close detail"
                className="shrink-0 text-[var(--dim)] hover:text-[var(--ink)]"
              >
                <X size={11} />
              </button>
            </div>

            {selection.kind === "station" && selection.station && (
              <div className="mt-1.5 space-y-1 text-[8px] text-[var(--muted)] min-[3000px]:text-[12px]">
                <div className="flex justify-between font-mono">
                  <span>STATUS</span>
                  <span style={{ color: `rgb(${STATUS_RGB[selection.station.status].join(",")})` }} className="font-bold uppercase">
                    {selection.station.status}
                  </span>
                </div>
                {selection.station.bankLevelMsl > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>WATER / BANK</span>
                    <span className="text-[var(--ink)]">
                      {selection.station.waterLevelMsl}m / {selection.station.bankLevelMsl}m
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-mono">
                  <span>RAIN 24H</span>
                  <span className="text-[var(--ink)]">{selection.station.rainfall24h} mm</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>CAPACITY</span>
                  <span className="text-[var(--ink)]">{selection.station.capacityPct}%</span>
                </div>
                <p className="border-t border-[var(--line)] pt-1 leading-[13px] min-[3000px]:leading-5">
                  {selection.station.advice}
                </p>
              </div>
            )}

            {selection.kind === "camera" && selection.camera && (
              <div className="mt-1.5 space-y-1 text-[8px] text-[var(--muted)] min-[3000px]:text-[12px]">
                {selection.camera.snapshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selection.camera.snapshotUrl}
                    alt={selection.camera.label}
                    className="w-full border border-[var(--line)] object-cover"
                  />
                ) : (
                  <div className="flex h-[72px] flex-col items-center justify-center gap-1 border border-[var(--line)] bg-[var(--bg-raised)]">
                    <Cctv size={14} className="text-[var(--dim)]" />
                    <span className="font-mono text-[6px] uppercase tracking-[0.18em] text-[var(--dim)] min-[3000px]:text-[9px]">
                      slot — awaiting feed
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-mono">
                  <span>PROTOCOL</span>
                  <span className="uppercase text-[var(--ink)]">{selection.camera.wiring.protocol}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>OWNER</span>
                  <span className="text-[var(--ink)]">{selection.camera.wiring.owner}</span>
                </div>
                <p className="border-t border-[var(--line)] pt-1 leading-[13px] min-[3000px]:leading-5">
                  {selection.camera.wiring.note}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom-right: attribution */}
        <div className="pointer-events-none absolute bottom-1 right-1 bg-[var(--bg-surface)] px-1.5 py-0.5 text-[6px] uppercase tracking-[0.12em] text-[var(--dim)] min-[3000px]:text-[9px]">
          {activeSatLayer ? `${activeSatLayer.source} · ` : ""}basemap © OSM / Carto / Esri
        </div>
      </div>
    </div>
  );
}

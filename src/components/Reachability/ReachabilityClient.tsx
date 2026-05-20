/**
 * Reachability Client — interactive UNL isochrone + routing demo.
 *
 * Built with maplibre-gl (already a dep) — no new packages.
 * Map clicks send {lat,lng} to /api/unl/isochrone and render filled polygons.
 * Long-press / right-click → adds a destination and shows the GrabMaps route.
 *
 * Design follows the §11/§14 rules: zero radius, hairline borders, single
 * amber accent on the active band, dark cockpit palette.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MaplibreMap, Marker, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface IsoBand {
  minutes: number;
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  error?: string;
}

interface IsoResponse {
  origin: { lat: number; lng: number; geohash: string };
  mode: "car" | "pedestrian";
  isochrones: IsoBand[];
  provider: string;
}

interface RouteSegment {
  length?: number;
  duration?: number;
  text?: string;
  instruction?: string;
}

interface RouteResponse {
  segments: RouteSegment[];
  totals: { distanceKm: number; durationMin: number };
}

const PHUKET_CENTER: [number, number] = [98.34, 7.89];
const BAND_COLORS = ["#f59e0b", "#58a6ff", "#7ee787"];
const BAND_OPACITY = [0.32, 0.22, 0.14];

export default function ReachabilityClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<MaplibreMap | null>(null);
  const originMarker = useRef<Marker | null>(null);
  const destMarker   = useRef<Marker | null>(null);
  const [origin, setOrigin]   = useState<{ lat: number; lng: number } | null>(null);
  const [dest, setDest]       = useState<{ lat: number; lng: number } | null>(null);
  const [bands, setBands]     = useState<IsoBand[]>([]);
  const [route, setRoute]     = useState<RouteResponse | null>(null);
  const [mode, setMode]       = useState<"car" | "pedestrian">("car");
  const [loading, setLoading] = useState<"iso" | "route" | null>(null);
  const [tool, setTool]       = useState<"iso" | "route">("iso");

  // Initialise map
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center: PHUKET_CENTER,
      zoom: 10,
      minZoom: 7,           // §11.9 — never let the world repeat
      maxZoom: 17,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Iso source + 3 fill layers
      map.addSource("iso", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      [0, 1, 2].forEach((i) => {
        map.addLayer({
          id: `iso-fill-${i}`,
          type: "fill",
          source: "iso",
          paint: {
            "fill-color": BAND_COLORS[i],
            "fill-opacity": BAND_OPACITY[i],
          },
          filter: ["==", ["get", "band"], i],
        });
        map.addLayer({
          id: `iso-line-${i}`,
          type: "line",
          source: "iso",
          paint: {
            "line-color": BAND_COLORS[i],
            "line-width": 1,
            "line-opacity": 0.85,
          },
          filter: ["==", ["get", "band"], i],
        });
      });

      // Route source + line
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#000", "line-width": 6, "line-opacity": 0.6 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#f59e0b", "line-width": 3 },
      });
    });

    return () => map.remove();
  }, []);

  // Fetch isochrone
  const fetchIso = useCallback(async (lat: number, lng: number) => {
    setLoading("iso");
    setRoute(null);
    setDest(null);
    if (destMarker.current) { destMarker.current.remove(); destMarker.current = null; }
    try {
      const r = await fetch("/api/unl/isochrone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, minutes: [15, 30, 60], mode }),
      });
      const data: IsoResponse = await r.json();
      setBands(data.isochrones || []);

      // Project bands onto the map
      const features: GeoJSON.Feature[] = [];
      data.isochrones.forEach((b, i) => {
        if (b.geometry) {
          features.push({
            type: "Feature",
            properties: { band: i, minutes: b.minutes },
            geometry: b.geometry,
          });
        }
      });
      const src = mapRef.current?.getSource("iso") as maplibregl.GeoJSONSource;
      src?.setData({ type: "FeatureCollection", features });

      // Zoom to fit
      if (features.length && mapRef.current) {
        const coords = features.flatMap(extractCoords);
        if (coords.length) {
          const bounds = coords.reduce(
            (b, c) => b.extend(c as [number, number]),
            new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
          );
          mapRef.current.fitBounds(bounds as LngLatBoundsLike, { padding: 60, duration: 800 });
        }
      }
    } catch (err) {
      console.error("Isochrone fetch failed", err);
    } finally {
      setLoading(null);
    }
  }, [mode]);

  // Fetch route between origin and destination
  const fetchRoute = useCallback(async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    setLoading("route");
    try {
      const r = await fetch("/api/unl/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }] }),
      });
      const data: RouteResponse = await r.json();
      setRoute(data);

      // Draw a straight-line approximation between origin/dest (UNL response
      // doesn't include geojson polyline in basic tier — segments give totals,
      // not coords. Real polyline decode is Phase 2.)
      const src = mapRef.current?.getSource("route") as maplibregl.GeoJSONSource;
      src?.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
          },
        }],
      });
    } catch (err) {
      console.error("Route fetch failed", err);
    } finally {
      setLoading(null);
    }
  }, []);

  // Click handler — switches by tool
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      if (tool === "iso" || !origin) {
        // Set origin and run iso
        if (originMarker.current) originMarker.current.remove();
        originMarker.current = new maplibregl.Marker({ color: "#f59e0b" })
          .setLngLat([lng, lat])
          .addTo(map);
        setOrigin({ lat, lng });
        fetchIso(lat, lng);
      } else {
        // Set destination and route
        if (destMarker.current) destMarker.current.remove();
        destMarker.current = new maplibregl.Marker({ color: "#58a6ff" })
          .setLngLat([lng, lat])
          .addTo(map);
        setDest({ lat, lng });
        fetchRoute(origin, { lat, lng });
      }
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [tool, origin, fetchIso, fetchRoute]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top-left info / tool panel — compact corner overlay (§11 rule) */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          width: 300,
          background: "rgba(13,17,23,0.86)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(230,237,243,0.18)",
          padding: 14,
          fontSize: 12,
          letterSpacing: "0.04em",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(230,237,243,0.55)", marginBottom: 10 }}>
          REACHABILITY · PHUKET
        </div>
        <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
          Click anywhere on Phuket to see what's reachable in <span style={{ color: "#f59e0b" }}>15 / 30 / 60 min</span> by real road network.
        </div>
        <div style={{ display: "flex", gap: 1, background: "rgba(230,237,243,0.18)", marginBottom: 10 }}>
          {(["iso", "route"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              style={{
                flex: 1,
                background: tool === t ? "#f59e0b" : "#0d1117",
                color: tool === t ? "#0d1117" : "#e6edf3",
                border: 0, padding: "8px 10px",
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit",
                minHeight: 44,
              }}
            >
              {t === "iso" ? "Isochrone" : "Route"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 1, background: "rgba(230,237,243,0.18)" }}>
          {(["car", "pedestrian"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                background: mode === m ? "rgba(245,158,11,0.15)" : "#0d1117",
                color: mode === m ? "#f59e0b" : "rgba(230,237,243,0.55)",
                border: mode === m ? "1px solid #f59e0b" : "1px solid transparent",
                padding: "6px 10px",
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit",
                minHeight: 44,
              }}
            >
              {m === "car" ? "Drive" : "Walk"}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-left legend / state */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          width: 300,
          background: "rgba(13,17,23,0.86)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(230,237,243,0.18)",
          padding: 14,
          fontSize: 11,
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(230,237,243,0.55)", marginBottom: 8 }}>
          {loading === "iso"   ? "COMPUTING ISOCHRONE…" :
           loading === "route" ? "COMPUTING ROUTE…" :
           route               ? "ROUTE READY" :
           bands.length        ? "REACHABILITY" :
           "WAITING FOR CLICK"}
        </div>
        {bands.length > 0 && !route && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bands.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, height: 8, background: BAND_COLORS[i], opacity: 0.8 }} />
                <span>{b.minutes} min {mode === "car" ? "drive" : "walk"}</span>
                {b.error && <span style={{ color: "#c44", marginLeft: "auto", fontSize: 9 }}>fail</span>}
              </div>
            ))}
          </div>
        )}
        {route && (
          <div style={{ lineHeight: 1.6 }}>
            <div style={{ fontSize: 22, color: "#f59e0b" }}>
              {route.totals.distanceKm} <span style={{ fontSize: 11, color: "rgba(230,237,243,0.55)" }}>km</span>
              {" · "}
              {route.totals.durationMin} <span style={{ fontSize: 11, color: "rgba(230,237,243,0.55)" }}>min</span>
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(230,237,243,0.45)", marginTop: 6 }}>
              {route.segments.length} segments · GrabMaps
            </div>
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(230,237,243,0.35)" }}>
          UNL Global · GrabMaps SE Asia
        </div>
      </div>
    </>
  );
}

// Extract all [lng,lat] coords from any GeoJSON feature for fitBounds
function extractCoords(f: GeoJSON.Feature): [number, number][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates.flat() as [number, number][];
  if (g.type === "MultiPolygon") return g.coordinates.flat(2) as [number, number][];
  if (g.type === "LineString") return g.coordinates as [number, number][];
  return [];
}

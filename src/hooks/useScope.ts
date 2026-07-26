"use client";

/**
 * Administrative scope, held in the URL.
 *
 * The URL *is* the per-municipality dashboard: ?scope=patong is Patong's dashboard,
 * ?scope=rawai is Rawai's. That is why this lives in a query param rather than
 * component state — these links get pasted into a LINE message and opened on a
 * phone, which is how anything here actually gets seen.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { assetPath } from "../lib/asset-path";
import {
  DISTRICT_LABELS,
  PROVINCE_SCOPE,
  PROVINCE_SCOPE_ID,
  type ScopeUnit,
} from "../types/scope";

interface BoundaryFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

export interface ScopeState {
  /** Currently selected unit. Province when nothing is selected. */
  scope: ScopeUnit;
  /** Every selectable unit: province, 3 districts, 18 local governments. */
  units: ScopeUnit[];
  /** Polygon of the active scope, or null for the province / before load. */
  activeGeometry: BoundaryFeature["geometry"] | null;
  districts: BoundaryCollection | null;
  localGovs: BoundaryCollection | null;
  setScope: (id: string) => void;
  loaded: boolean;
}

function toUnit(f: BoundaryFeature): ScopeUnit {
  const p = f.properties as Record<string, never>;
  const kind = String(p.kind) as ScopeUnit["kind"];
  return {
    id: kind === "district" ? String(p.code) : String(p.id),
    kind,
    nameEn: String(p.nameEn),
    nameTh: String(p.nameTh),
    type: p.type_ ? String(p.type_) : undefined,
    code: p.code == null ? null : String(p.code),
    districtCode: p.districtCode ? String(p.districtCode) : undefined,
    tambonCodes: Array.isArray(p.tambonCodes) ? (p.tambonCodes as string[]) : undefined,
    boundaryPrecision: (p.boundaryPrecision as ScopeUnit["boundaryPrecision"]) ?? "official",
    bbox: p.bbox as unknown as ScopeUnit["bbox"],
    centroid: p.centroid as unknown as ScopeUnit["centroid"],
  };
}

/**
 * The URL is the source of truth for scope, and the URL is an external store —
 * so subscribe to it rather than mirroring it into state inside an effect.
 *
 * Not useSearchParams(): that forces the whole subtree behind a Suspense boundary,
 * and this hook is called from BorderMap which is already the heaviest thing on the
 * page.
 */
const SCOPE_CHANGE_EVENT = "phuket:scope";

function scopeFromLocation(): string {
  if (typeof window === "undefined") return PROVINCE_SCOPE_ID;
  return new URLSearchParams(window.location.search).get("scope") || PROVINCE_SCOPE_ID;
}

function subscribeToScope(onChange: () => void): () => void {
  // popstate covers back/forward; the custom event covers our own pushState, which
  // deliberately does not fire popstate.
  window.addEventListener("popstate", onChange);
  window.addEventListener(SCOPE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(SCOPE_CHANGE_EVENT, onChange);
  };
}

export function useScope(): ScopeState {
  const scopeId = useSyncExternalStore(
    subscribeToScope,
    scopeFromLocation,
    // Server/static-export snapshot: there is no request to read a param from.
    () => PROVINCE_SCOPE_ID,
  );
  const [districts, setDistricts] = useState<BoundaryCollection | null>(null);
  const [localGovs, setLocalGovs] = useState<BoundaryCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Static files, not an API route — /api/gistda/tambons was the previous source
    // and it is stubbed out of the static export, so the layer was dead in prod.
    Promise.all([
      fetch(assetPath("/data/phuket-districts.geojson")).then((r) => (r.ok ? r.json() : null)),
      fetch(assetPath("/data/phuket-localgov.geojson")).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, l]) => {
        if (cancelled) return;
        if (d) setDistricts(d as BoundaryCollection);
        if (l) setLocalGovs(l as BoundaryCollection);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const units = useMemo<ScopeUnit[]>(() => {
    const out: ScopeUnit[] = [PROVINCE_SCOPE];
    for (const f of districts?.features ?? []) out.push(toUnit(f));
    for (const f of localGovs?.features ?? []) out.push(toUnit(f));
    return out;
  }, [districts, localGovs]);

  const scope = useMemo(
    () => units.find((u) => u.id === scopeId) ?? PROVINCE_SCOPE,
    [units, scopeId],
  );

  const activeGeometry = useMemo(() => {
    if (scope.kind === "province") return null;
    const pool = scope.kind === "district" ? districts : localGovs;
    const match = pool?.features.find((f) => {
      const p = f.properties as Record<string, unknown>;
      return String(p.kind === "district" ? p.code : p.id) === scope.id;
    });
    return match?.geometry ?? null;
  }, [scope, districts, localGovs]);

  const setScope = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (id === PROVINCE_SCOPE_ID) url.searchParams.delete("scope");
    else url.searchParams.set("scope", id);
    // pushState, not replace: back should undo a drill-down. pushState fires no
    // event of its own, hence the explicit notify.
    window.history.pushState({}, "", url);
    window.dispatchEvent(new Event(SCOPE_CHANGE_EVENT));
  }, []);

  return {
    scope,
    units,
    activeGeometry,
    districts,
    localGovs,
    setScope,
    loaded: Boolean(districts && localGovs),
  };
}

export { DISTRICT_LABELS };

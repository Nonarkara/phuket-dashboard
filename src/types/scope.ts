/**
 * Administrative scope — what slice of Phuket the dashboard is currently showing.
 *
 * Lives in src/types/ (not in a route) because scripts/static-export.mjs stubs every
 * route file before building; a type imported from one resolves to nothing.
 */

export type ScopeKind = "province" | "district" | "localgov";

/** Whether a unit's drawn polygon is actually that unit's legal boundary. */
export type BoundaryPrecision =
  /** The unit is coterminous with its tambon(s). The polygon is the boundary. */
  | "tambon-exact"
  /**
   * The unit shares its tambon with another local government (a เทศบาลตำบล and an
   * อบต. splitting one tambon). No public polygon exists for the split, so the whole
   * tambon is drawn and this unit's real area is smaller. Must be stated in the UI.
   */
  | "shared-tambon"
  /** Province and district outlines, straight from DOPA via GISTDA. */
  | "official";

export interface ScopeUnit {
  /** URL-safe identity. This is the ?scope= value. */
  id: string;
  kind: ScopeKind;
  nameEn: string;
  nameTh: string;
  /** ทน. / ทม. / ทต. / อบต. — empty for province and district. */
  type?: string;
  /** DLA local code, or the DOPA district code. Null where none is published. */
  code?: string | null;
  /** Parent district code, for grouping local governments in the selector. */
  districtCode?: string;
  tambonCodes?: string[];
  boundaryPrecision: BoundaryPrecision;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  /** Area-weighted, so it lands inside the polygon rather than in a bay. */
  centroid: [number, number];
}

export const PROVINCE_SCOPE_ID = "phuket";

/** The whole province — the default, and the only scope with no polygon file. */
export const PROVINCE_SCOPE: ScopeUnit = {
  id: PROVINCE_SCOPE_ID,
  kind: "province",
  nameEn: "Phuket Province",
  nameTh: "จังหวัดภูเก็ต",
  code: "83",
  boundaryPrecision: "official",
  bbox: [98.24, 7.73, 98.46, 8.21],
  centroid: [98.338, 7.96],
};

export const DISTRICT_ORDER = ["8301", "8302", "8303"] as const;

export const DISTRICT_LABELS: Record<string, { en: string; th: string }> = {
  "8301": { en: "Mueang Phuket", th: "เมืองภูเก็ต" },
  "8302": { en: "Kathu", th: "กะทู้" },
  "8303": { en: "Thalang", th: "ถลาง" },
};

/** Point-in-polygon (ray casting) against a Polygon or MultiPolygon ring set. */
export function pointInScope(
  lon: number,
  lat: number,
  geometry: { type: string; coordinates: number[][][] | number[][][][] },
): boolean {
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  for (const poly of polys) {
    // Ring 0 is the outer boundary; any further rings are holes.
    if (!ringContains(poly[0], lon, lat)) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (ringContains(poly[i], lon, lat)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

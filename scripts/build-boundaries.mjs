#!/usr/bin/env node
/**
 * Bake Phuket administrative geometry to static GeoJSON.
 *
 * Run once (boundaries change on the order of decades); the output is committed.
 *   node scripts/build-boundaries.mjs
 *
 * Why static and not a runtime proxy: /api/gistda/tambons already existed and was
 * dead in production — it is stubbed out by the static export, so the Districts
 * overlay silently rendered nothing. A boundary is the most cacheable thing on the
 * map; fetching it per session was the bug.
 *
 * Source: GISTDA ArcGIS "ข้อมูลเขตการปกครอง" MapServer (DOPA data, open, no auth).
 *   layer 3 = ขอบเขตอำเภอ  (district polygons)
 *   layer 4 = ขอบเขตตำบล   (tambon polygons)
 * Local-government identity is the PHUKET_LOCAL_GOVS table below — deliberately in
 * this file rather than a parallel copy under src/, so there is one registry. The
 * app reads the emitted GeoJSON, whose properties carry every field it needs.
 *
 * Tambon polygons are fetched but not emitted: the 18 local-government footprints
 * already draw every tambon line except the one inside Phuket City, and a second
 * near-identical megabyte is not worth it on a phone.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phuket's 18 local administrative organisations (อปท.), excluding the provincial
 * PAO (อบจ.ภูเก็ต) which covers the whole province and so is not a drill-down scope.
 *
 * `code` is the DLA local code from GISTDA MapServer layer 0
 * (ตำแหน่งองค์กรปกครองส่วนท้องถิ่น), which decodes as
 * 6 + province(83) + district + tambon + sequence. That layer is the authority for
 * *identity and extent* but records a stale unit *type* — it still calls Phuket
 * "เทศบาลเมือง" (upgraded to เทศบาลนคร in 2004) and lists Ratsada, Wichit, Chalong
 * and Rawai as อบต. after their promotion to เทศบาลตำบล. Types below follow the
 * current Wikipedia list of Phuket municipalities; codes and tambon mapping follow
 * GISTDA. Where the two disagree, that disagreement is the reason for this comment.
 *
 * Mai Khao has no row in GISTDA's layer 0 (the only tambon missing one), so it
 * carries no code here.
 *
 * `sharesTambon` marks the two tambons that contain two units each: Thep Krasattri
 * and Choeng Thale are split between a เทศบาลตำบล and an อบต. There is no public
 * polygon for the split, so both units render the whole tambon and the UI must say
 * the boundary is approximate. Do not quietly present these as exact.
 */
const PHUKET_LOCAL_GOVS = [
  // ── อำเภอเมืองภูเก็ต ──────────────────────────────────────────────────────
  { id: "phuket-city", code: "483010101", type: "ทน.", nameTh: "เทศบาลนครภูเก็ต", nameEn: "Phuket City", districtCode: "8301", tambonCodes: ["830101", "830102"] },
  { id: "ko-kaeo", code: "683010301", type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลเกาะแก้ว", nameEn: "Ko Kaeo", districtCode: "8301", tambonCodes: ["830103"] },
  { id: "ratsada", code: "683010401", type: "ทต.", nameTh: "เทศบาลตำบลรัษฎา", nameEn: "Ratsada", districtCode: "8301", tambonCodes: ["830104"] },
  { id: "wichit", code: "683010501", type: "ทต.", nameTh: "เทศบาลตำบลวิชิต", nameEn: "Wichit", districtCode: "8301", tambonCodes: ["830105"] },
  { id: "chalong", code: "683010601", type: "ทต.", nameTh: "เทศบาลตำบลฉลอง", nameEn: "Chalong", districtCode: "8301", tambonCodes: ["830106"] },
  { id: "rawai", code: "683010701", type: "ทต.", nameTh: "เทศบาลตำบลราไวย์", nameEn: "Rawai", districtCode: "8301", tambonCodes: ["830107"] },
  { id: "karon", code: "683010801", type: "ทต.", nameTh: "เทศบาลตำบลกะรน", nameEn: "Karon", districtCode: "8301", tambonCodes: ["830108"] },

  // ── อำเภอกะทู้ ────────────────────────────────────────────────────────────
  { id: "kathu", code: "683020101", type: "ทม.", nameTh: "เทศบาลเมืองกะทู้", nameEn: "Kathu", districtCode: "8302", tambonCodes: ["830201"] },
  { id: "patong", code: "683020201", type: "ทม.", nameTh: "เทศบาลเมืองป่าตอง", nameEn: "Patong", districtCode: "8302", tambonCodes: ["830202"] },
  { id: "kamala", code: "683020301", type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลกมลา", nameEn: "Kamala", districtCode: "8302", tambonCodes: ["830203"] },

  // ── อำเภอถลาง ────────────────────────────────────────────────────────────
  { id: "thep-krasattri-mun", code: "683030102", type: "ทต.", nameTh: "เทศบาลตำบลเทพกระษัตรี", nameEn: "Thep Krasattri (Mun.)", districtCode: "8303", tambonCodes: ["830301"], sharesTambon: true },
  { id: "thep-krasattri-sao", code: "683030101", type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลเทพกระษัตรี", nameEn: "Thep Krasattri (SAO)", districtCode: "8303", tambonCodes: ["830301"], sharesTambon: true },
  { id: "si-sunthon", code: "683030201", type: "ทต.", nameTh: "เทศบาลตำบลศรีสุนทร", nameEn: "Si Sunthon", districtCode: "8303", tambonCodes: ["830302"] },
  { id: "choeng-thale-mun", code: "683030302", type: "ทต.", nameTh: "เทศบาลตำบลเชิงทะเล", nameEn: "Choeng Thale (Mun.)", districtCode: "8303", tambonCodes: ["830303"], sharesTambon: true },
  { id: "choeng-thale-sao", code: "683030301", type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลเชิงทะเล", nameEn: "Choeng Thale (SAO)", districtCode: "8303", tambonCodes: ["830303"], sharesTambon: true },
  { id: "pa-khlok", code: "683030401", type: "ทต.", nameTh: "เทศบาลตำบลป่าคลอก", nameEn: "Pa Khlok", districtCode: "8303", tambonCodes: ["830304"] },
  { id: "mai-khao", code: null, type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลไม้ขาว", nameEn: "Mai Khao", districtCode: "8303", tambonCodes: ["830305"] },
  { id: "sakhu", code: "683030601", type: "อบต.", nameTh: "องค์การบริหารส่วนตำบลสาคู", nameEn: "Sakhu", districtCode: "8303", tambonCodes: ["830306"] },
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/data");

const SERVICE =
  "https://gistdaportal.gistda.or.th/arcgis/rest/services/" +
  encodeURIComponent("ข้อมูลเขตการปกครอง") +
  "/MapServer";

// Generous enough to catch every Phuket polygon; Phang Nga spillover is filtered
// out afterwards on the province code, not on the envelope.
const ENVELOPE = "98.15,7.55,98.65,8.30";

async function queryLayer(layer, outFields) {
  const url =
    `${SERVICE}/${layer}/query?geometry=${encodeURIComponent(ENVELOPE)}` +
    `&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects` +
    `&inSR=4326&outSR=4326&outFields=${encodeURIComponent(outFields)}&f=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GISTDA layer ${layer}: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.features) throw new Error(`GISTDA layer ${layer}: no features`);
  return json.features;
}

/** [minLon, minLat, maxLon, maxLat] over any Polygon/MultiPolygon. */
function bboxOf(geometry) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const visit = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) visit(c);
  };
  visit(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

/**
 * Area-weighted centroid of the outer rings (shoelace). Used for the map label and
 * as the sampling point for per-scope metrics, so a bbox centre is not good enough:
 * Thalang wraps around a bay and its bbox centre lands in the water.
 */
function centroidOf(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let cx = 0, cy = 0, area2 = 0;
  for (const poly of polys) {
    const ring = poly[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j];
      const [x1, y1] = ring[i];
      const f = x0 * y1 - x1 * y0;
      area2 += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
  }
  if (area2 === 0) return representativePoint(geometry);
  const c = [cx / (3 * area2), cy / (3 * area2)];
  // A concave unit can put its own area centroid outside itself — Rawai wraps the
  // southern cape and lands in the sea. Fall back to a guaranteed-interior point.
  return pointInside(c[0], c[1], geometry) ? c : representativePoint(geometry);
}

function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInside(x, y, geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    if (!ringContains(poly[0], x, y)) continue;
    if (poly.slice(1).some((h) => ringContains(h, x, y))) continue;
    return true;
  }
  return false;
}

/**
 * A point guaranteed to lie inside the shape — the same idea as PostGIS
 * ST_PointOnSurface. Scan horizontal lines across the bbox, and take the midpoint
 * of the widest interior span found. Used for map labels and for the fly-to target,
 * both of which look broken if the point sits offshore.
 */
function representativePoint(geometry) {
  const [minX, minY, maxX, maxY] = bboxOf(geometry);
  const STEPS = 64;
  let best = null;
  for (let i = 1; i < STEPS; i++) {
    const y = minY + ((maxY - minY) * i) / STEPS;
    let runStart = null;
    let prevInside = false;
    for (let j = 0; j <= STEPS * 2; j++) {
      const x = minX + ((maxX - minX) * j) / (STEPS * 2);
      const inside = pointInside(x, y, geometry);
      if (inside && !prevInside) runStart = x;
      if ((!inside || j === STEPS * 2) && prevInside && runStart !== null) {
        const width = x - runStart;
        if (!best || width > best.width) best = { width, x: (runStart + x) / 2, y };
      }
      prevInside = inside;
    }
  }
  return best ? [best.x, best.y] : [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Round to 5 decimals (~1.1 m) and drop points that collapse onto their neighbour.
 * DOPA ships 14-decimal coordinates; at this map's zoom range (9–16) that is roughly
 * a megabyte of noise, and this page is opened on a phone over mobile data first.
 */
function roundGeometry(geometry, dp = 5) {
  const f = 10 ** dp;
  const r = (n) => Math.round(n * f) / f;
  const ring = (pts) => {
    const out = [];
    for (const [x, y] of pts) {
      const p = [r(x), r(y)];
      const last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
    // A ring needs its closing point back if rounding merged it away.
    if (out.length > 2) {
      const [a, b] = [out[0], out[out.length - 1]];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
    }
    return out.length >= 4 ? out : null;
  };
  const poly = (rings) => rings.map(ring).filter(Boolean);
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: poly(geometry.coordinates) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map(poly).filter((p) => p.length),
  };
}

function mergeGeometries(geoms) {
  if (geoms.length === 1) return geoms[0];
  const polys = [];
  for (const g of geoms) {
    if (g.type === "Polygon") polys.push(g.coordinates);
    else polys.push(...g.coordinates);
  }
  return { type: "MultiPolygon", coordinates: polys };
}

function writeGeoJson(name, features) {
  mkdirSync(OUT, { recursive: true });
  const fc = { type: "FeatureCollection", features };
  writeFileSync(resolve(OUT, name), JSON.stringify(fc));
  const kb = Math.round(JSON.stringify(fc).length / 1024);
  console.log(`  ${name.padEnd(28)} ${String(features.length).padStart(3)} features  ${kb} KB`);
}

async function main() {
  console.log("Fetching GISTDA administrative boundaries…");

  // ── Districts (อำเภอ) ────────────────────────────────────────────────────────
  const rawDistricts = await queryLayer(3, "Admin_code,P_code,A_Name_T,A_Name_E,P_Name_T");
  const districts = rawDistricts
    .filter((f) => f.properties.P_code === "83")
    .map((f) => {
      const p = f.properties;
      return {
        type: "Feature",
        properties: {
          scopeId: `district-${p.Admin_code}`,
          kind: "district",
          code: p.Admin_code,
          nameTh: p.A_Name_T,
          // "AMPHOE MUEANG PHUKET" -> "Mueang Phuket"
          nameEn: titleCase(String(p.A_Name_E).replace(/^AMPHOE\s+/i, "")),
          bbox: bboxOf(f.geometry),
          centroid: centroidOf(f.geometry),
        },
        geometry: roundGeometry(f.geometry),
      };
    })
    .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  if (districts.length !== 3) {
    throw new Error(`Expected 3 Phuket districts, got ${districts.length}`);
  }

  // ── Tambons (ตำบล) ──────────────────────────────────────────────────────────
  const rawTambons = await queryLayer(4, "Admin_code,T_Name_T,T_Name_E,A_Name_T,A_Name_E");
  const tambons = rawTambons
    .filter((f) => String(f.properties.Admin_code || "").startsWith("83"))
    .map((f) => {
      const p = f.properties;
      const code = String(p.Admin_code);
      return {
        type: "Feature",
        properties: {
          scopeId: `tambon-${code}`,
          kind: "tambon",
          code,
          districtCode: code.slice(0, 4),
          nameTh: String(p.T_Name_T).replace(/^ตำบล/, ""),
          // GISTDA's T_Name_E is wrong for 830105 (labels Wichit as "RATSADA", the
          // same value it gives 830104). Names come from TAMBON_NAMES_EN instead.
          nameEn: TAMBON_NAMES_EN[code] ?? titleCase(String(p.T_Name_E).replace(/^TAMBON\s+/i, "")),
          bbox: bboxOf(f.geometry),
          centroid: centroidOf(f.geometry),
        },
        geometry: roundGeometry(f.geometry),
      };
    })
    .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  if (tambons.length !== 17) {
    throw new Error(`Expected 17 Phuket tambons, got ${tambons.length}`);
  }

  // ── Local governments (อปท.) ────────────────────────────────────────────────
  // Geometry is the union of the unit's tambon polygons. Where two units share one
  // tambon (Thep Krasattri and Choeng Thale each have both a เทศบาลตำบล and an
  // อบต.), both get the whole tambon and are flagged shared-tambon — the polygon
  // overstates each unit's real area and the UI has to say so.
  const byCode = new Map(tambons.map((t) => [t.properties.code, t]));
  const localGovs = PHUKET_LOCAL_GOVS.map((lg) => {
    const parts = lg.tambonCodes.map((c) => {
      const t = byCode.get(c);
      if (!t) throw new Error(`${lg.id}: no tambon polygon for ${c}`);
      return t.geometry;
    });
    const geometry = mergeGeometries(parts);
    return {
      type: "Feature",
      properties: {
        scopeId: `localgov-${lg.id}`,
        kind: "localgov",
        id: lg.id,
        code: lg.code,
        type_: lg.type,
        nameTh: lg.nameTh,
        nameEn: lg.nameEn,
        districtCode: lg.districtCode,
        tambonCodes: lg.tambonCodes,
        boundaryPrecision: lg.sharesTambon ? "shared-tambon" : "tambon-exact",
        bbox: bboxOf(geometry),
        centroid: centroidOf(geometry),
      },
      geometry,
    };
  });

  if (localGovs.length !== 18) {
    throw new Error(`Expected 18 local governments, got ${localGovs.length}`);
  }

  // Every tambon must belong to at least one local government, or a scope is
  // unreachable from the selector.
  const covered = new Set(PHUKET_LOCAL_GOVS.flatMap((lg) => lg.tambonCodes));
  const orphans = tambons.map((t) => t.properties.code).filter((c) => !covered.has(c));
  if (orphans.length) throw new Error(`Tambons with no local government: ${orphans.join(", ")}`);

  writeGeoJson("phuket-districts.geojson", districts);
  writeGeoJson("phuket-localgov.geojson", localGovs);

  console.log("\nDistricts:");
  for (const d of districts) console.log(`  ${d.properties.code}  ${d.properties.nameEn}  (${d.properties.nameTh})`);
  console.log(`\nLocal governments: ${localGovs.length}`);
  for (const l of localGovs) {
    const flag = l.properties.boundaryPrecision === "shared-tambon" ? "  ⚠ shared tambon" : "";
    console.log(`  ${l.properties.type_.padEnd(4)} ${l.properties.nameEn.padEnd(22)} ${l.properties.nameTh}${flag}`);
  }
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

// Transliterations from the DOPA subdistrict register (via the FloodDash gazetteer),
// which is authoritative where GISTDA's English column is not.
const TAMBON_NAMES_EN = {
  "830101": "Talat Yai", "830102": "Talat Nuea", "830103": "Ko Kaeo",
  "830104": "Ratsada", "830105": "Wichit", "830106": "Chalong",
  "830107": "Rawai", "830108": "Karon",
  "830201": "Kathu", "830202": "Patong", "830203": "Kamala",
  "830301": "Thep Krasattri", "830302": "Si Sunthon", "830303": "Choeng Thale",
  "830304": "Pa Khlok", "830305": "Mai Khao", "830306": "Sakhu",
};

main().catch((err) => {
  console.error(`\nbuild-boundaries failed: ${err.message}`);
  process.exit(1);
});

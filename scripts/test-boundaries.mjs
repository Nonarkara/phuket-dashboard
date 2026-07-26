#!/usr/bin/env node
/**
 * Self-check for the baked boundary data and the scope geometry helpers.
 *   node scripts/test-boundaries.mjs
 *
 * Guards the invariants that would otherwise fail silently in the UI: a missing
 * local government, a centroid that lands in the sea, or a bbox that would frame
 * the map on the wrong island.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (n) => JSON.parse(readFileSync(resolve(ROOT, "public/data", n), "utf8"));

const districts = read("phuket-districts.geojson");
const localGovs = read("phuket-localgov.geojson");

// ── Counts ───────────────────────────────────────────────────────────────────
assert.equal(districts.features.length, 3, "Phuket has 3 districts");
assert.equal(localGovs.features.length, 18, "Phuket has 18 local governments");

// ── Districts ────────────────────────────────────────────────────────────────
const dCodes = districts.features.map((f) => f.properties.code).sort();
assert.deepEqual(dCodes, ["8301", "8302", "8303"]);

// ── Local governments ────────────────────────────────────────────────────────
const ids = localGovs.features.map((f) => f.properties.id);
assert.equal(new Set(ids).size, 18, "local government ids are unique");
for (const want of ["patong", "rawai", "phuket-city", "kathu", "karon", "mai-khao"]) {
  assert.ok(ids.includes(want), `missing scope id: ${want}`);
}

// Every unit belongs to a real district, so the selector can group all 18.
const byDistrict = {};
for (const f of localGovs.features) {
  const d = f.properties.districtCode;
  assert.ok(dCodes.includes(d), `${f.properties.id}: bad districtCode ${d}`);
  byDistrict[d] = (byDistrict[d] ?? 0) + 1;
}
assert.deepEqual(byDistrict, { "8301": 7, "8302": 3, "8303": 8 });

// The four units that share a tambon must be flagged — the UI shows a caveat off
// this field, and quietly presenting them as exact is the failure mode.
const shared = localGovs.features
  .filter((f) => f.properties.boundaryPrecision === "shared-tambon")
  .map((f) => f.properties.id)
  .sort();
assert.deepEqual(shared, [
  "choeng-thale-mun", "choeng-thale-sao", "thep-krasattri-mun", "thep-krasattri-sao",
]);

// ── Geometry sanity ──────────────────────────────────────────────────────────
// Phuket island sits inside this envelope. A centroid or bbox outside it means the
// map would fly somewhere else entirely.
const [LON0, LAT0, LON1, LAT1] = [98.2, 7.7, 98.5, 8.25];

for (const f of [...districts.features, ...localGovs.features]) {
  const { centroid, bbox, nameEn } = f.properties;
  assert.ok(Array.isArray(centroid) && centroid.length === 2, `${nameEn}: no centroid`);
  const [cx, cy] = centroid;
  assert.ok(cx > LON0 && cx < LON1, `${nameEn}: centroid lon ${cx} off Phuket`);
  assert.ok(cy > LAT0 && cy < LAT1, `${nameEn}: centroid lat ${cy} off Phuket`);
  const [minX, minY, maxX, maxY] = bbox;
  assert.ok(maxX > minX && maxY > minY, `${nameEn}: degenerate bbox`);
  // The centroid must sit inside its own bbox — catches a shoelace sign error.
  assert.ok(cx >= minX && cx <= maxX && cy >= minY && cy <= maxY, `${nameEn}: centroid outside bbox`);
}

// Patong is on the west coast, Ratsada on the east. If these ever swap, the
// centroid maths is wrong in a way the count checks would not catch.
const patong = localGovs.features.find((f) => f.properties.id === "patong");
const ratsada = localGovs.features.find((f) => f.properties.id === "ratsada");
assert.ok(
  patong.properties.centroid[0] < ratsada.properties.centroid[0],
  "Patong must sit west of Ratsada",
);

// ── Point-in-polygon ─────────────────────────────────────────────────────────
// Reimplemented here rather than imported: src/types/scope.ts is TypeScript and
// Node 20 cannot strip types. Keep the two in step.
function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInScope(lon, lat, geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    if (!ringContains(poly[0], lon, lat)) continue;
    if (poly.slice(1).some((h) => ringContains(h, lon, lat))) continue;
    return true;
  }
  return false;
}

// Patong Beach really is in Patong, and really is not in Rawai.
const PATONG_BEACH = [98.2967, 7.8965];
const rawai = localGovs.features.find((f) => f.properties.id === "rawai");
assert.ok(pointInScope(...PATONG_BEACH, patong.geometry), "Patong Beach must fall inside Patong");
assert.ok(!pointInScope(...PATONG_BEACH, rawai.geometry), "Patong Beach must not fall inside Rawai");

// Every unit's own centroid must fall inside its own polygon — the whole point of
// using an area-weighted centroid rather than a bbox centre.
for (const f of localGovs.features) {
  assert.ok(
    pointInScope(f.properties.centroid[0], f.properties.centroid[1], f.geometry),
    `${f.properties.nameEn}: centroid falls outside its own polygon`,
  );
}

console.log(
  `boundaries: all checks passed (3 districts, 18 local governments, ${shared.length} flagged approximate)`,
);

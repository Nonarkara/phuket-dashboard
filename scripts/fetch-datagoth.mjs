#!/usr/bin/env node
/**
 * Pull curated Phuket government statistics from the provincial open-data
 * catalog (phuket.gdcatalog.go.th — the node data.go.th mirrors) and bake them
 * to public/data/gov/*.json for the CityFacts panel.
 *
 *   node scripts/fetch-datagoth.mjs
 *
 * Run on demand (most of these are annual series); output is committed.
 * CKAN API is open, no key. Every record keeps its publisher, dataset title
 * and last-modified date so the UI can attribute every number.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/data/gov");
const CKAN = "https://phuket.gdcatalog.go.th/api/3/action";

/**
 * The curated set — one row per dataset, grouped by the four God-Mode domains.
 * `id` is the CKAN package name on the provincial catalog.
 */
const DATASETS = [
  // ── Tourism load ─────────────────────────────────────────────────────────
  { id: "dataset_10_34", key: "visitors", domain: "tourism", label: "Visitors, tourists & excursionists" },
  { id: "dataset_10_09", key: "avg-spend", domain: "tourism", label: "Average spend per visitor" },
  { id: "dataset_10_12", key: "stay-length", domain: "tourism", label: "Average length of stay" },
  { id: "dataset_10_68", key: "occupancy", domain: "tourism", label: "Hotel occupancy rate" },
  { id: "dataset_10_11", key: "hotels", domain: "tourism", label: "Registered hotels & lodgings" },
  { id: "dataset_10_02", key: "airport-pax", domain: "tourism", label: "Airport passengers in/out" },

  // ── Water & waste ────────────────────────────────────────────────────────
  { id: "dataset_20_24", key: "water-localgov", domain: "water", label: "Water systems by local government" },
  { id: "dataset_10_25", key: "water-pwa", domain: "water", label: "PWA water volume" },
  { id: "20_06", key: "waste-generated", domain: "water", label: "Solid waste generated" },
  { id: "20_04", key: "waste-households", domain: "water", label: "Households with waste collection" },
  { id: "20_14", key: "waste-disposed", domain: "water", label: "Waste correctly disposed" },

  // ── Safety ───────────────────────────────────────────────────────────────
  { id: "dataset_10_48", key: "road-deaths", domain: "safety", label: "Road accident deaths" },
  { id: "dataset_10_47", key: "road-injuries", domain: "safety", label: "Road accident injuries" },
  { id: "dataset_10_50", key: "marine-accidents", domain: "safety", label: "Marine accidents" },
  { id: "dataset_10_67", key: "tourist-hotline", domain: "safety", label: "Tourist hotline 1155 reports" },

  // ── Health ───────────────────────────────────────────────────────────────
  { id: "dataset_30b_39", key: "hospital-load", domain: "health", label: "Public hospital OPD/IPD utilisation" },
  { id: "dataset_30a_01", key: "over-60", domain: "health", label: "Population aged 60+" },
  { id: "phuket001", key: "population", domain: "health", label: "Registered population" },
];

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "PhuketDashboard/1.0 (+https://phuket.nonarkara.org)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Minimal CSV parser: quoted fields, CRLF, BOM. These files are small and tame. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      if (c === "\r" && s[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim()));
}

async function fetchDataset(spec) {
  const pkg = (await getJson(`${CKAN}/package_show?id=${spec.id}`)).result;
  const csvRes = pkg.resources.find((r) => String(r.format).toUpperCase() === "CSV");
  if (!csvRes) throw new Error(`${spec.id}: no CSV resource`);

  const res = await fetch(csvRes.url, {
    headers: { "user-agent": "PhuketDashboard/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${spec.id}: CSV ${res.status}`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error(`${spec.id}: empty CSV`);

  return {
    key: spec.key,
    domain: spec.domain,
    label: spec.label,
    titleTh: pkg.title,
    org: pkg.organization?.title ?? "",
    updated: (pkg.metadata_modified ?? "").slice(0, 10),
    landing: `https://phuket.gdcatalog.go.th/dataset/${pkg.name}`,
    header: rows[0],
    rows: rows.slice(1).filter((r) => r.some((x) => x !== "")),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const index = [];
  const failed = [];
  const all = [];

  for (const spec of DATASETS) {
    try {
      const data = await fetchDataset(spec);
      writeFileSync(resolve(OUT, `${spec.key}.json`), JSON.stringify(data));
      all.push(data);
      index.push({
        key: data.key, domain: data.domain, label: data.label,
        titleTh: data.titleTh, org: data.org, updated: data.updated,
        landing: data.landing, rowCount: data.rows.length,
      });
      console.log(`  ok   ${spec.key.padEnd(18)} ${data.rows.length} rows  (${data.updated})  ${data.titleTh.slice(0, 44)}`);
    } catch (err) {
      failed.push({ id: spec.id, key: spec.key, error: String(err.message) });
      console.warn(`  FAIL ${spec.key.padEnd(18)} ${err.message}`);
    }
  }

  // One combined file so the panel makes a single request instead of eighteen.
  writeFileSync(resolve(OUT, "all.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    datasets: all,
  }));

  writeFileSync(resolve(OUT, "index.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "phuket.gdcatalog.go.th (data.go.th provincial node)",
    datasets: index,
    failed,
  }, null, 2));

  console.log(`\n${index.length}/${DATASETS.length} datasets baked to public/data/gov/`);
  if (index.length < DATASETS.length - 3) {
    // A couple of misses is provincial-CKAN weather; a majority failing means the
    // catalog moved and the panel would render almost nothing. Fail loudly.
    process.exit(1);
  }
}

main();

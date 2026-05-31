#!/usr/bin/env node
/**
 * Compute real slope + elevation at each accident blackspot for the Slope Story.
 *
 * Samples a ~122 m cross (N/S/E/W) around each point against SRTM 30 m elevation
 * (opentopodata.org, free, no key) and takes the steepest arm as the local road
 * gradient. Output is pasted into src/data/phuket-blackspots.ts (baked static,
 * no runtime dependency). Re-run to refresh.
 *
 * Source: NASA SRTM 30 m DEM via opentopodata.org. SRTM smooths terrain, so the
 * grade is a conservative floor for the on-road descent — stated honestly.
 *
 * Run: node scripts/blackspot-slopes.mjs
 */
const SPOTS = [
  ["patong-hill-summit", 7.9087, 98.3253],
  ["patong-hill-west", 7.905, 98.318],
  ["kathu-hill-base", 7.911, 98.332],
  ["kalim-curve", 7.904, 98.296],
  ["samkong-intersection", 7.9, 98.378],
  ["thepkasattri-bypass", 7.8881, 98.388],
  ["chaofa-junction", 7.87, 98.365],
  ["chalong-circle", 7.847, 98.339],
  ["heroines-monument", 7.993, 98.364],
  ["thalang-402-straight", 8.025, 98.338],
  ["airport-junction", 8.1, 98.316],
];

const D = 0.0011; // ~122 m
const M_PER_DEG = 111320;

function arms(lat, lng) {
  return [
    [lat, lng], // center (index 0)
    [lat + D, lng],
    [lat - D, lng],
    [lat, lng + D],
    [lat, lng - D],
  ];
}

async function main() {
  const locations = [];
  for (const [, lat, lng] of SPOTS) for (const [a, b] of arms(lat, lng)) locations.push(`${a},${b}`);

  const url = `https://api.opentopodata.org/v1/srtm30m?locations=${locations.join("|")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`opentopodata ${res.status}`);
  const { results } = await res.json();

  const armDistNS = D * M_PER_DEG;
  const out = [];
  for (let i = 0; i < SPOTS.length; i++) {
    const [id, lat] = SPOTS[i];
    const base = i * 5;
    const center = results[base].elevation;
    const armDistEW = D * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
    const grads = [
      Math.abs(results[base + 1].elevation - center) / armDistNS,
      Math.abs(results[base + 2].elevation - center) / armDistNS,
      Math.abs(results[base + 3].elevation - center) / armDistEW,
      Math.abs(results[base + 4].elevation - center) / armDistEW,
    ];
    const maxGrad = Math.max(...grads);
    const slopePct = Math.round(maxGrad * 1000) / 10;
    const slopeDeg = Math.round((Math.atan(maxGrad) * 180) / Math.PI * 10) / 10;
    out.push({ id, elevationM: Math.round(center), slopePct, slopeDeg });
  }

  console.log(JSON.stringify(out, null, 2));
  console.log("\n// paste-ready:");
  for (const o of out) {
    console.log(`${o.id}: elevationM ${o.elevationM}, slopePct ${o.slopePct}, slopeDeg ${o.slopeDeg}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

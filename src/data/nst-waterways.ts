// ─── NST Waterway Network — mountain to sea ─────────────────────
// Traced reference network of the channels that carry water into and
// out of Nakhon Si Thammarat city. Alignments are hand-traced from the
// basin geography (Khao Luang -> Khlong Tha Di -> Tha Ngiu split ->
// city / Khlong Tha Sak / RID diversion canal -> Gulf of Thailand).
// Replace `path` arrays with RID / OSM GeoJSON via a script when the
// shapefiles are in hand; node ids and the routing logic stay the same.
//
// designCapacity values come from the RID city flood-mitigation project
// brief: city channel ~268 m3/s, diversion canal 750 m3/s design.

import type { Branch, NodeKind } from "../types/nst";

export interface NstNodeDefinition {
  id: string;
  name: string;
  nameTh: string;
  kind: NodeKind;
  branch: Branch;
  order: number;
  lon: number;
  lat: number;
  district: string;
  bankLevelMsl: number | null;
  note: string;
}

export interface NstReachDefinition {
  id: string;
  name: string;
  branch: Branch;
  order: number;
  fromNode: string;
  toNode: string;
  path: [number, number][];
  designCapacity: number | null;
}

export const NST_NODES: NstNodeDefinition[] = [
  { id: "khao-luang", name: "Khao Luang summit gauge", nameTh: "เขาหลวง", kind: "catchment", branch: "main", order: 1, lon: 99.735, lat: 8.495, district: "Lan Saka / Phrom Khiri", bankLevelMsl: null, note: "Highest peak in the south (1,835 m). Northeast-monsoon rain here is the whole story." },
  { id: "khiriwong", name: "Khlong Tha Di @ Khiriwong", nameTh: "คลองท่าดี บ้านคีรีวง", kind: "gauge", branch: "main", order: 2, lon: 99.775, lat: 8.436, district: "Lan Saka", bankLevelMsl: 62.0, note: "First gauge below the range. A rise here reaches the city in ~5 h." },
  { id: "tha-di", name: "Khlong Tha Di @ Ban Tha Di weir", nameTh: "คลองท่าดี บ้านท่าดี", kind: "gauge", branch: "main", order: 3, lon: 99.862, lat: 8.418, district: "Lan Saka", bankLevelMsl: 18.5, note: "Reference gauge for city inflow. Bank here is the operational trigger." },
  { id: "tha-ngiu", name: "Tha Ngiu split", nameTh: "ท่างิ้ว จุดแยกน้ำ", kind: "split", branch: "main", order: 4, lon: 99.905, lat: 8.425, district: "Mueang", bankLevelMsl: 11.0, note: "Flow divides: north (Tha Sak), city (Pak Nakhon), south (RID diversion canal)." },
  { id: "diversion-gate-1", name: "RID diversion intake gate", nameTh: "ประตูระบายน้ำคลองผันน้ำ 1", kind: "gate", branch: "south", order: 5, lon: 99.912, lat: 8.408, district: "Mueang", bankLevelMsl: null, note: "Opens when city inflow approaches channel capacity (~268 m3/s)." },
  { id: "kamphaeng-sao", name: "City west fringe @ Kamphaeng Sao", nameTh: "กำแพงเซา", kind: "gauge", branch: "city", order: 5, lon: 99.935, lat: 8.432, district: "Mueang", bankLevelMsl: 7.2, note: "First urban ponding point — Tha Ngiu / Kamphaeng Sao / Chai Montri." },
  { id: "tha-wang", name: "Khlong Pak Nakhon @ Tha Wang", nameTh: "คลองปากนคร ท่าวัง", kind: "city", branch: "city", order: 6, lon: 99.967, lat: 8.443, district: "Mueang (city core)", bankLevelMsl: 4.1, note: "City-centre channel past the old market. Level here = streets." },
  { id: "pak-nakhon", name: "Pak Nakhon mouth", nameTh: "ปากนคร", kind: "outlet", branch: "city", order: 7, lon: 100.035, lat: 8.463, district: "Mueang (coast)", bankLevelMsl: 1.6, note: "Tidal. High tide backs water up into the city." },
  { id: "tha-sak", name: "Khlong Tha Sak @ Tha Sak bridge", nameTh: "คลองท่าซัก", kind: "gauge", branch: "north", order: 5, lon: 99.985, lat: 8.505, district: "Mueang (north)", bankLevelMsl: 3.4, note: "North branch. Also carries the Phrom Khiri tributary." },
  { id: "pak-phun", name: "Pak Phun outlet", nameTh: "ปากพูน", kind: "outlet", branch: "north", order: 6, lon: 100.005, lat: 8.535, district: "Mueang (north coast)", bankLevelMsl: 1.4, note: "Northern outlet to the Gulf; mangrove-fringed, tidal." },
  { id: "bang-chak", name: "Diversion canal outfall", nameTh: "ปลายคลองผันน้ำ", kind: "outlet", branch: "south", order: 6, lon: 100.06, lat: 8.415, district: "Mueang (south-east coast)", bankLevelMsl: 1.5, note: "Designed 750 m3/s outfall south of the city." },
  { id: "phrom-khiri", name: "Phrom Khiri rain gauge", nameTh: "พรหมคีรี", kind: "catchment", branch: "north", order: 2, lon: 99.79, lat: 8.52, district: "Phrom Khiri", bankLevelMsl: null, note: "Northern catchment feeding Khlong Tha Sak." },
];

export const NST_REACHES: NstReachDefinition[] = [
  { id: "r-headwaters", name: "Khao Luang headwaters", branch: "main", order: 1, fromNode: "khao-luang", toNode: "khiriwong", path: [[99.735, 8.495], [99.75, 8.47], [99.765, 8.452], [99.775, 8.436]], designCapacity: null },
  { id: "r-gorge", name: "Khlong Tha Di — Lan Saka gorge", branch: "main", order: 2, fromNode: "khiriwong", toNode: "tha-di", path: [[99.775, 8.436], [99.8, 8.428], [99.83, 8.42], [99.862, 8.418]], designCapacity: null },
  { id: "r-tha-di", name: "Khlong Tha Di — to Tha Ngiu", branch: "main", order: 3, fromNode: "tha-di", toNode: "tha-ngiu", path: [[99.862, 8.418], [99.885, 8.421], [99.905, 8.425]], designCapacity: null },
  { id: "r-city-inflow", name: "Khlong Tha Di — city inflow", branch: "city", order: 4, fromNode: "tha-ngiu", toNode: "tha-wang", path: [[99.905, 8.425], [99.92, 8.43], [99.935, 8.432], [99.95, 8.438], [99.967, 8.443]], designCapacity: 268 },
  { id: "r-pak-nakhon", name: "Khlong Pak Nakhon — city to sea", branch: "city", order: 5, fromNode: "tha-wang", toNode: "pak-nakhon", path: [[99.967, 8.443], [99.99, 8.45], [100.015, 8.457], [100.035, 8.463]], designCapacity: 268 },
  { id: "r-tha-sak", name: "Khlong Tha Sak — north branch", branch: "north", order: 4, fromNode: "tha-ngiu", toNode: "tha-sak", path: [[99.905, 8.425], [99.925, 8.455], [99.955, 8.48], [99.985, 8.505]], designCapacity: 120 },
  { id: "r-pak-phun", name: "Khlong Tha Sak — to Pak Phun", branch: "north", order: 5, fromNode: "tha-sak", toNode: "pak-phun", path: [[99.985, 8.505], [99.995, 8.52], [100.005, 8.535]], designCapacity: 120 },
  { id: "r-phrom-khiri", name: "Phrom Khiri tributary", branch: "north", order: 3, fromNode: "phrom-khiri", toNode: "tha-sak", path: [[99.79, 8.52], [99.85, 8.51], [99.92, 8.49], [99.955, 8.48]], designCapacity: null },
  { id: "r-diversion", name: "RID diversion canal (18.6 km)", branch: "south", order: 4, fromNode: "tha-ngiu", toNode: "bang-chak", path: [[99.905, 8.425], [99.912, 8.408], [99.94, 8.385], [99.98, 8.378], [100.02, 8.39], [100.06, 8.415]], designCapacity: 750 },
];

export function reachLengthKm(path: [number, number][]): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    const dx = (lon2 - lon1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
    const dy = (lat2 - lat1) * 110.57;
    km += Math.hypot(dx, dy);
  }
  return Math.round(km * 10) / 10;
}

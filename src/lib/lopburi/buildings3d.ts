// ─── Lopburi 3D City Layer ──────────────────────────────────────
// Thin province binding over the shared city3d stack. Lopburi is
// low-rise: shophouses ~6-9m, prangs/temples ~20-30m, a few mid-rises
// 25-45m — the amber band starts earlier than Phuket's so vertical
// landmarks still read on the wall.

import type maplibregl from "maplibre-gl";
import { applyCity3D } from "../geo/city3d";

export function applyLopburi3D(mlMap: maplibregl.Map, show: boolean, basemapId: string) {
  applyCity3D(mlMap, show, basemapId, { prefix: "lopburi", exaggeration: 1.5 });
}

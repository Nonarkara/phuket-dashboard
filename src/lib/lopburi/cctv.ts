// ─── Lopburi CCTV Slot Wiring ───────────────────────────────────
// Province binding over the shared loader: fixed registry + DOH ITS
// auto-wire inside the Lopburi bbox.

import { loadCctvFeed } from "../cctv/loader";
import { LOPBURI_CCTV_SLOTS } from "../../data/lopburi-cctv";
import { LOPBURI_PROVINCE } from "./config";
import type { CctvFeedResponse } from "../../types/cctv";

export function loadLopburiCctv(): Promise<CctvFeedResponse> {
  return loadCctvFeed({
    cacheKey: "lopburi-cctv",
    registry: LOPBURI_CCTV_SLOTS,
    bbox: LOPBURI_PROVINCE.bbox,
    fallbackCorridorId: "highway-1",
  });
}

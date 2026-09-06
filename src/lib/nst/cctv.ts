// ─── NST CCTV Slot Wiring ───────────────────────────────────────
import { loadCctvFeed } from "../cctv/loader";
import { NST_CCTV_SLOTS } from "../../data/nst-cctv";
import { NST_PROVINCE } from "./config";
import type { CctvFeedResponse } from "../../types/cctv";

export function loadNstCctv(): Promise<CctvFeedResponse> {
  return loadCctvFeed({ cacheKey: "nst-cctv", registry: NST_CCTV_SLOTS, bbox: NST_PROVINCE.bbox, fallbackCorridorId: "outlets" });
}

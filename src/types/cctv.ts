// ─── Shared CCTV slot types ─────────────────────────────────────
// Used by every province war room (Lopburi, NST). A slot is a
// physical camera position; it goes "live" once snapshotUrl/streamUrl
// is filled in, with no UI change required.

export type CctvSlotStatus = "live" | "standby";

export interface CctvSlot {
  id: string;
  label: string;
  district: string;
  corridorId: string;
  lat: number;
  lon: number;
  status: CctvSlotStatus;
  /** Populated once the physical feed is wired in. */
  snapshotUrl: string | null;
  streamUrl: string | null;
  wiring: {
    protocol: "rtsp" | "hls" | "mjpeg" | "snapshot";
    owner: string; // agency that owns the camera
    note: string; // what needs to happen to bring this slot live
  };
}

export interface CctvFeedResponse {
  generatedAt: string;
  slots: CctvSlot[];
  liveCount: number;
  standbyCount: number;
}

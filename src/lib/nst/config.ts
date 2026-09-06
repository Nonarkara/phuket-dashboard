// ─── Nakhon Si Thammarat Province Configuration ─────────────────
// Water-first province: corridors follow the water from the Khao Luang
// range to the Gulf rather than road or tourism geography.

export interface NstCorridorDefinition {
  id: string;
  label: string;
  view: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };
  defaultAction: string;
}

export const NST_PROVINCE = {
  code: 80, // ThaiWater / HII province code for Nakhon Si Thammarat
  nameEn: "Nakhon Si Thammarat",
  nameTh: "นครศรีธรรมราช",
  cityCenter: { longitude: 99.963, latitude: 8.432 },
  defaultView: { longitude: 99.9, latitude: 8.455, zoom: 10.35, pitch: 48, bearing: -12 },
  outletPoint: { longitude: 100.035, latitude: 8.463 }, // Pak Nakhon mouth (tide reference)
  // Province bbox — NST is long north-south; used to filter national feeds.
  bbox: { west: 99.4, south: 7.8, east: 100.35, north: 9.15 },
} as const;

export const NST_CORRIDORS: NstCorridorDefinition[] = [
  {
    id: "whole-system",
    label: "Mountain to sea",
    view: { longitude: 99.9, latitude: 8.455, zoom: 10.35, pitch: 48, bearing: -12 },
    defaultAction: "Read the whole chain: catchment rain, Tha Di rise, split ratios, outlet tide.",
  },
  {
    id: "khao-luang",
    label: "Khao Luang catchment",
    view: { longitude: 99.76, latitude: 8.46, zoom: 11.2, pitch: 56, bearing: 20 },
    defaultAction: "Rain here becomes Tha Di discharge in 4-6 hours. Watch Khiriwong first.",
  },
  {
    id: "tha-di-gorge",
    label: "Khlong Tha Di / Lan Saka",
    view: { longitude: 99.84, latitude: 8.42, zoom: 12.0, pitch: 52, bearing: 8 },
    defaultAction: "The single channel feeding the city. Bank capacity here decides tonight.",
  },
  {
    id: "tha-ngiu-split",
    label: "Tha Ngiu split / diversion",
    view: { longitude: 99.91, latitude: 8.42, zoom: 12.8, pitch: 50, bearing: -6 },
    defaultAction: "Open the diversion gates before city inflow exceeds channel capacity.",
  },
  {
    id: "city-core",
    label: "City core / Tha Wang",
    view: { longitude: 99.963, latitude: 8.438, zoom: 13.4, pitch: 52, bearing: -14 },
    defaultAction: "Stage pumps at the western fringe; keep Ratchadamnoen corridor open for evacuation.",
  },
  {
    id: "outlets",
    label: "Outlets / Gulf tide",
    view: { longitude: 100.01, latitude: 8.49, zoom: 11.6, pitch: 46, bearing: -30 },
    defaultAction: "High tide at Pak Nakhon holds water in the city. Time releases to the ebb.",
  },
];

export function findNstCorridor(id: string) {
  return NST_CORRIDORS.find((c) => c.id === id);
}

export const NST_SCENARIO_IDS = ["red-monsoon-day", "stable-recovery-day", "tourism-surge-weekend"] as const;

export function normalizeNstScenario(raw: string | null | undefined) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return (NST_SCENARIO_IDS as readonly string[]).includes(v) ? (v as (typeof NST_SCENARIO_IDS)[number]) : null;
}

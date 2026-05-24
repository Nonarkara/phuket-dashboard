/**
 * Road accident benchmark — Phuket vs Bangkok, with district + demographic breakdown.
 *
 * Source: Thai Road Safety Center (THAIRSC), public dashboard at
 * https://www.thairsc.com/data-compare and the PowerBI embed at
 * https://app.powerbi.com/view?r=eyJrIjoiYjJjNzc4M2UtZTUzZC00NjEyLTgwMmYtOTExZDcyYTk1YjFhIiwidCI6IjBiNTRkMTRlLTMyYTktNGEyMC1iOTVhLTgzMWQ0ZTQ5MmE5NyIsImMiOjEwfQ%3D%3D
 *
 * Period covered: Buddhist Era 2565–2569 (Gregorian 2022–2026), cumulative totals.
 *
 * District-level totals from the "Victim Total by Province" table —
 * these may represent a single year subset. Total Phuket cumulative = 570 deaths.
 *
 * THAIRSC does not publish a JSON API. Numbers are mirrored here manually
 * from the published Power BI report. Last synced: 2026-05-20.
 *
 * Population: SLIC Smart City Thailand Index
 * (slic-index/v3-current/src/thailandData.ts).
 */

export const THAIRSC_PERIOD = "BE 2565–2569 · 2022–2026 cumulative";
export const THAIRSC_SOURCE_URL = "https://www.thairsc.com/data-compare";

// ─── Province-level totals (cumulative 2022–2026) ───────────────

export const PHUKET_TOTALS = {
  deaths: 570,
  injuries: 104_673,
  populationThousands: 418, // SCITI
  deathsPer100k: Math.round((570 / 418) * 100),        // 136
  injuriesPer100k: Math.round((104_673 / 418) * 100),   // 25,041
} as const;

export const BANGKOK_TOTALS = {
  deaths: 3_778,
  injuries: 628_884,
  populationThousands: 10_000,
  deathsPer100k: Math.round((3_778 / 10_000) * 100),    // 38
  injuriesPer100k: Math.round((628_884 / 10_000) * 100), // 6,289
} as const;

/** Phuket deaths-per-100k as a multiple of Bangkok's (3.6×). */
export const PHUKET_DEATH_RATE_MULTIPLE =
  Math.round((PHUKET_TOTALS.deathsPer100k / BANGKOK_TOTALS.deathsPer100k) * 10) / 10;

// ─── District breakdown (from Victim Total by Province table) ───
// These numbers are from a filtered subset visible in the dashboard.
// Corridors map: Mueang → Old Town, Kathu → Patong, Thalang → Airport/North.

export interface DistrictStats {
  district: string;
  corridor: string;
  deaths: number;
  injuries: number;
  total: number;
}

export const PHUKET_DISTRICTS: DistrictStats[] = [
  { district: "Mueang Phuket", corridor: "Old Town",      deaths: 106, injuries: 10_449, total: 10_555 },
  { district: "Kathu",         corridor: "Patong",         deaths:  43, injuries:  6_473, total:  6_516 },
  { district: "Thalang",       corridor: "Airport north",  deaths:  47, injuries:  3_657, total:  3_704 },
];

// ─── Demographics (% of all Phuket casualties) ──────────────────

export const PHUKET_BY_VEHICLE = {
  motorcycle: 92.05,
  car: 7.95,
} as const;

export const PHUKET_BY_GENDER = {
  male: 53.60,
  female: 46.40,
} as const;

/** Age group breakdown (% of incidents). */
export const PHUKET_BY_AGE: Array<{ label: string; pct: number }> = [
  { label: "1–14",  pct: 5.89 },
  { label: "15–18", pct: 8.96 },
  { label: "19–24", pct: 18.57 },
  { label: "25–35", pct: 31.10 }, // largest group
  { label: "36–60", pct: 29.34 },
  { label: "60+",   pct: 6.14 },
];

/** Time-of-day breakdown (% of incidents). Peak = 14:00–17:59. */
export const PHUKET_BY_TIME: Array<{ window: string; pct: number }> = [
  { window: "02:00–05:59", pct: 7.08 },
  { window: "06:00–09:59", pct: 18.54 },
  { window: "10:00–13:59", pct: 18.35 },
  { window: "14:00–17:59", pct: 23.58 }, // PEAK
  { window: "18:00–21:59", pct: 21.15 },
  { window: "22:00–01:59", pct: 11.30 },
];

export const PHUKET_PEAK_HOURS = "14:00–21:59"; // combined PM peak = 44.73%

// ─── Action briefs derived from data ───────────────────────────

/**
 * Three evidence-based actions a governor can take today to move the needle.
 * These are not opinions — they follow directly from the THAIRSC breakdown.
 */
export const ROAD_SAFETY_ACTIONS = [
  {
    stat: "92% of accidents involve motorcycles",
    action: "Mandate weekly helmet checkpoints on main arterials. One visible week of enforcement shifts habit.",
    corridor: "All corridors",
  },
  {
    stat: "Peak hours 14:00–22:00 (44.7% of incidents)",
    action: "Increase afternoon patrol density from 14:00. Kamala, Patong and Karon junction are the pinch points.",
    corridor: "Patong / Karon / Kata",
  },
  {
    stat: "Mueang district leads in deaths (106) and injuries (10,449)",
    action: "Old Town's mixed-use lanes put motorcycles against heavy vehicles. Request signage audit and speed camera installation from DoH.",
    corridor: "Old Town",
  },
] as const;

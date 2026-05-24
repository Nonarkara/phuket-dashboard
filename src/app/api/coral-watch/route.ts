/**
 * NOAA Coral Reef Watch — Phuket / Southwestern Thailand
 *
 * Bleaching Alert Area (BAA) and Degree Heating Weeks for the Andaman Sea.
 * Phuket's dive economy is ~$200M/yr. Alert Level 2 = mass bleaching imminent.
 *
 * Source: coralreefwatch.noaa.gov/product/vs/data/southwestern_thailand.txt
 * Update cadence: Daily. No auth required.
 *
 * BAA scale:
 *   0 = No Stress
 *   1 = Watch  (DHW approaching threshold)
 *   2 = Warning (DHW ≥ 4°C-weeks, bleaching likely)
 *   3 = Alert Level 1 (DHW ≥ 8, widespread bleaching)
 *   4 = Alert Level 2 (DHW ≥ 12, significant mortality)
 *   5 = Alert Level 3+ (DHW ≥ 16, catastrophic)
 */
import { NextResponse } from "next/server";
import { cached } from "../../../lib/cache";

const CRW_URL =
  "https://coralreefwatch.noaa.gov/product/vs/data/southwestern_thailand.txt";

export interface CoralWatchData {
  date: string;                      // YYYY-MM-DD
  sstMax: number;                    // °C sea surface temperature max
  dhw: number;                       // degree heating weeks
  baa: number;                       // bleaching alert area level (0-5)
  baaLabel: string;                  // human-readable label
  baaColor: "green" | "yellow" | "orange" | "red" | "maroon";
  isGovernorEvent: boolean;          // BAA ≥ 3 = governor-level public action needed
  governorMessage: string;
  source: "NOAA Coral Reef Watch";
}

const BAA_LABELS: Record<number, { label: string; color: CoralWatchData["baaColor"]; message: string }> = {
  0: { label: "No Stress",       color: "green",  message: "Reef conditions normal. No advisory needed." },
  1: { label: "Watch",           color: "yellow", message: "Thermal stress building. Monitor dive reports." },
  2: { label: "Warning",         color: "orange", message: "Bleaching likely. Issue dive community advisory." },
  3: { label: "Alert Level 1",   color: "red",    message: "Widespread bleaching occurring. Coordinate marine park response." },
  4: { label: "Alert Level 2",   color: "red",    message: "Mass bleaching event. Activate marine emergency plan. Media advisory required." },
  5: { label: "Alert Level 3+",  color: "maroon", message: "Catastrophic bleaching. Immediate provincial response. National park closures." },
};

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await cached("coral-watch-andaman", 3600, async () => {
    const res = await fetch(CRW_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Accept": "text/plain" },
    });
    if (!res.ok) throw new Error(`NOAA CRW ${res.status}`);
    const text = await res.text();
    // Find last data row (skip header lines starting with non-digits)
    const rows = text.split("\n").filter((l) => /^\d{4}/.test(l.trim()));
    const last = rows[rows.length - 1]?.trim().split(/\s+/);
    if (!last || last.length < 10) throw new Error("Unexpected CRW format");
    return {
      year: last[0], month: last[1], day: last[2],
      sstMax: parseFloat(last[4]),
      dhw: parseFloat(last[8]),
      baa: parseInt(last[9], 10),
    };
  });

  const baaInfo = BAA_LABELS[Math.min(data.baa, 5)] ?? BAA_LABELS[0];
  const response: CoralWatchData = {
    date: `${data.year}-${data.month.padStart(2, "0")}-${data.day.padStart(2, "0")}`,
    sstMax: data.sstMax,
    dhw: Math.round(data.dhw * 10) / 10,
    baa: data.baa,
    baaLabel: baaInfo.label,
    baaColor: baaInfo.color,
    isGovernorEvent: data.baa >= 3,
    governorMessage: baaInfo.message,
    source: "NOAA Coral Reef Watch",
  };

  return NextResponse.json(response);
}

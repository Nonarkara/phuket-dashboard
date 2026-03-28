import { query } from "./db";
import { getErrorMessage } from "./errors";
import { fallbackRainfall } from "./mock-data";
import type { RainfallPoint } from "../types/dashboard";

interface RainfallRow {
  location: string;
  value: number;
  unit: string | null;
  ref_date: string;
}

const locationCoords: Record<string, { lat: number; lng: number }> = {
  Phuket: { lat: 7.8804, lng: 98.3923 },
  "Phuket Town": { lat: 7.8804, lng: 98.3923 },
  Patong: { lat: 7.8964, lng: 98.2965 },
  "Phuket Airport": { lat: 8.1132, lng: 98.3069 },
  "Phang Nga": { lat: 8.4501, lng: 98.5311 },
  "Khao Lak": { lat: 8.6367, lng: 98.2487 },
  Krabi: { lat: 8.0863, lng: 98.9126 },
  "Surat Thani": { lat: 9.1397, lng: 99.3331 },
  Trang: { lat: 7.5594, lng: 99.6114 },
  Ranong: { lat: 9.9626, lng: 98.6388 },
};

export async function loadRainfallPoints(): Promise<RainfallPoint[]> {
  try {
    const res = await query<RainfallRow>(`
      SELECT
          location,
          value,
          unit,
          ref_date
      FROM rainfall_data
      ORDER BY ref_date DESC
      LIMIT 100
    `);

    const rainfall = res.rows.map((row) => {
      const coords = locationCoords[row.location] || { lat: 15, lng: 100 };
      return {
        lat: coords.lat,
        lng: coords.lng,
        value: row.value,
        label: row.location,
      } satisfies RainfallPoint;
    });

    return rainfall.length > 0 ? rainfall : fallbackRainfall;
  } catch (error: unknown) {
    console.error("Rainfall query error:", getErrorMessage(error));
    return fallbackRainfall;
  }
}

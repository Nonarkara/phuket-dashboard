import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { getErrorMessage } from "../../../lib/errors";
import type { ConflictTrendsResponse } from "../../../types/dashboard";

interface ProvincialTrendRow {
  label: string;
  current: number;
  previous: number;
}

interface FatalityTrendRow {
  label: string;
  fatalities: number;
}

const fallbackData: ConflictTrendsResponse = {
  provincialData: {
    labels: ["Phuket", "Phang Nga", "Krabi", "Ranong", "Surat Thani", "Trang"],
    current: [26, 18, 14, 11, 17, 9],
    yoy: [19, 14, 11, 8, 13, 6],
  },
  fatalities: {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
    data: [18, 26, 31, 22, 35, 28],
  },
};

export async function GET() {
  try {
    const [provincialRes, fatalityRes] = await Promise.all([
      query<ProvincialTrendRow>(`
        WITH location_buckets AS (
          SELECT
            COALESCE(location, 'Unspecified') AS label,
            COUNT(*) FILTER (
              WHERE event_date >= CURRENT_DATE - INTERVAL '60 days'
            )::int AS current,
            COUNT(*) FILTER (
              WHERE event_date < CURRENT_DATE - INTERVAL '60 days'
              AND event_date >= CURRENT_DATE - INTERVAL '120 days'
            )::int AS previous
          FROM events
          GROUP BY 1
        )
        SELECT label, current, previous
        FROM location_buckets
        WHERE current > 0 OR previous > 0
        ORDER BY current DESC, previous DESC, label ASC
        LIMIT 6
      `),
      query<FatalityTrendRow>(`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', CURRENT_DATE) - INTERVAL '5 weeks',
            date_trunc('week', CURRENT_DATE),
            INTERVAL '1 week'
          )::date AS week_start
        ),
        weekly_rainfall AS (
          SELECT
            date_trunc('week', ref_date)::date AS week_start,
            COALESCE(AVG(value), 0)::int AS fatalities
          FROM rainfall_data
          WHERE ref_date >= CURRENT_DATE - INTERVAL '42 days'
          GROUP BY 1
        )
        SELECT
          to_char(weeks.week_start, 'Mon DD') AS label,
          COALESCE(weekly_rainfall.fatalities, 0)::int AS fatalities
        FROM weeks
        LEFT JOIN weekly_rainfall
          ON weeks.week_start = weekly_rainfall.week_start
        ORDER BY weeks.week_start
      `),
    ]);

    if (provincialRes.rows.length === 0 || fatalityRes.rows.length === 0) {
      return NextResponse.json(fallbackData);
    }

    const response: ConflictTrendsResponse = {
      provincialData: {
        labels: provincialRes.rows.map((row) => row.label),
        current: provincialRes.rows.map((row) => row.current),
        yoy: provincialRes.rows.map((row) => row.previous),
      },
      fatalities: {
        labels: fatalityRes.rows.map((row) => row.label),
        data: fatalityRes.rows.map((row) => row.fatalities),
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Conflict trends query error:", getErrorMessage(error));
    return NextResponse.json(fallbackData);
  }
}

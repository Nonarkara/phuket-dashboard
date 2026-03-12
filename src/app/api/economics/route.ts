import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { getErrorMessage } from "../../../lib/errors";
import { fallbackEconomicIndicators } from "../../../lib/mock-data";
import { fetchReferenceEconomicIndicators } from "../../../lib/reference-data";
import type { EconomicIndicator } from "../../../types/dashboard";

interface MarketIndicatorRow {
  label: string;
  value: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  province: string | null;
  previous_value: number | null;
}

export async function GET() {
  try {
    const referenceIndicators = await fetchReferenceEconomicIndicators();

    if (referenceIndicators.length > 0) {
      return NextResponse.json(referenceIndicators);
    }
  } catch (error: unknown) {
    console.error("Reference economics error:", getErrorMessage(error));
  }

  try {
    const res = await query<MarketIndicatorRow>(`
      WITH ranked_market_data AS (
        SELECT
          indicator as label,
          value,
          unit,
          category,
          source,
          province,
          LAG(value) OVER (
            PARTITION BY indicator, COALESCE(province, '')
            ORDER BY ref_date, created_at
          ) as previous_value,
          ROW_NUMBER() OVER (
            PARTITION BY indicator, COALESCE(province, '')
            ORDER BY ref_date DESC, created_at DESC
          ) as latest_rank
        FROM market_data
      )
      SELECT
        label,
        value,
        unit,
        category,
        source,
        province,
        previous_value
      FROM ranked_market_data
      WHERE latest_rank = 1
      ORDER BY category NULLS LAST, label
      LIMIT 10
    `);

    const indicators: EconomicIndicator[] = res.rows.map((row) => {
      const change =
        row.previous_value === null
          ? 0
          : Number((row.value - row.previous_value).toFixed(2));

      return {
        label: row.label,
        value: row.value,
        unit: row.unit,
        category: row.category,
        source: row.source,
        province: row.province,
        change,
        up: change >= 0,
      };
    });

    return NextResponse.json(
      indicators.length > 0 ? indicators : fallbackEconomicIndicators,
    );
  } catch (error: unknown) {
    console.error("Economic query error:", getErrorMessage(error));
    return NextResponse.json(fallbackEconomicIndicators, { status: 200 });
  }
}

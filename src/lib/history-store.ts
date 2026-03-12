import { isDatabaseConfigured, query } from "./db";
import type {
  AirQualityPoint,
  AseanGdpDatum,
  CountryEconomicIndicatorSnapshot,
  EconomicIndicator,
} from "../types/dashboard";

interface MarketIndicatorRow {
  label: string;
  value: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  province: string | null;
  previous_value: number | null;
}

interface MacroCountryRow {
  country_code: string;
  country: string;
  gdp_usd: number;
  gdp_per_capita_usd: number;
  gdp_year: number;
  gdp_per_capita_year: number;
  source: string;
}

interface CountryEconomicIndicatorRow {
  country_code: string;
  country: string;
  indicator_code: string;
  indicator_label: string;
  value: number;
  unit: string | null;
  ref_year: number;
  source: string;
}

interface AirQualityRow {
  location: string;
  latitude: number;
  longitude: number;
  aqi: number;
  pm25: number;
  category: string;
  observed_at: string;
  source: string;
}

function normalizeRefDate(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function mapMarketIndicatorRow(row: MarketIndicatorRow): EconomicIndicator {
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
}

export async function persistMarketIndicators(
  indicators: EconomicIndicator[],
  capturedAt: Date | string = new Date(),
) {
  if (!isDatabaseConfigured) {
    return;
  }

  const refDate = normalizeRefDate(capturedAt);

  await Promise.all(
    indicators
      .filter((indicator): indicator is EconomicIndicator & { value: number } => {
        return typeof indicator.value === "number" && Number.isFinite(indicator.value);
      })
      .map((indicator) =>
        query(
          `
            INSERT INTO market_data (
              category,
              indicator,
              value,
              unit,
              province,
              source,
              ref_date
            )
            SELECT $1, $2, $3, $4, $5, $6, $7::date
            WHERE NOT EXISTS (
              SELECT 1
              FROM market_data
              WHERE indicator = $2
                AND ref_date = $7::date
                AND category IS NOT DISTINCT FROM $1
                AND unit IS NOT DISTINCT FROM $4
                AND province IS NOT DISTINCT FROM $5
                AND source IS NOT DISTINCT FROM $6
                AND created_at >= NOW() - INTERVAL '60 minutes'
            )
          `,
          [
            indicator.category ?? null,
            indicator.label,
            indicator.value,
            indicator.unit ?? null,
            indicator.province ?? null,
            indicator.source ?? "Reference market feed",
            refDate,
          ],
        ),
      ),
  );
}

export async function loadStoredMarketIndicators() {
  if (!isDatabaseConfigured) {
    return null;
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

    return res.rows.map(mapMarketIndicatorRow);
  } catch {
    return null;
  }
}

export async function persistAseanGdpSnapshot(
  snapshot: AseanGdpDatum[],
  capturedAt: Date | string = new Date(),
) {
  if (!isDatabaseConfigured) {
    return;
  }

  const capturedIso = new Date(capturedAt).toISOString();

  await Promise.all(
    snapshot.map((entry) =>
      query(
        `
          INSERT INTO macro_country_snapshots (
            country_code,
            country,
            gdp_usd,
            gdp_per_capita_usd,
            gdp_year,
            gdp_per_capita_year,
            source,
            captured_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
          ON CONFLICT (country_code, gdp_year, gdp_per_capita_year, source) DO UPDATE SET
            gdp_usd = EXCLUDED.gdp_usd,
            gdp_per_capita_usd = EXCLUDED.gdp_per_capita_usd,
            country = EXCLUDED.country,
            captured_at = EXCLUDED.captured_at
        `,
        [
          entry.countryCode,
          entry.country,
          entry.gdpUsd,
          entry.gdpPerCapitaUsd,
          entry.gdpYear,
          entry.gdpPerCapitaYear,
          entry.source,
          capturedIso,
        ],
      ),
    ),
  );
}

export async function loadLatestStoredAseanGdpSnapshot() {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const res = await query<MacroCountryRow>(`
      WITH ranked_macro AS (
        SELECT
          country_code,
          country,
          gdp_usd,
          gdp_per_capita_usd,
          gdp_year,
          gdp_per_capita_year,
          source,
          ROW_NUMBER() OVER (
            PARTITION BY country_code
            ORDER BY GREATEST(gdp_year, gdp_per_capita_year) DESC, captured_at DESC
          ) as latest_rank
        FROM macro_country_snapshots
      )
      SELECT
        country_code,
        country,
        gdp_usd,
        gdp_per_capita_usd,
        gdp_year,
        gdp_per_capita_year,
        source
      FROM ranked_macro
      WHERE latest_rank = 1
      ORDER BY gdp_usd DESC, country_code ASC
    `);

    return res.rows.map(
      (row): AseanGdpDatum => ({
        countryCode: row.country_code,
        country: row.country,
        gdpUsd: row.gdp_usd,
        gdpPerCapitaUsd: row.gdp_per_capita_usd,
        gdpYear: row.gdp_year,
        gdpPerCapitaYear: row.gdp_per_capita_year,
        source: row.source,
      }),
    );
  } catch {
    return null;
  }
}

export async function persistCountryEconomicIndicators(
  entries: CountryEconomicIndicatorSnapshot[],
  capturedAt: Date | string = new Date(),
) {
  if (!isDatabaseConfigured || entries.length === 0) {
    return;
  }

  const capturedIso = new Date(capturedAt).toISOString();

  await Promise.all(
    entries
      .filter(
        (entry) =>
          Number.isFinite(entry.value) &&
          Number.isFinite(entry.refYear) &&
          entry.indicatorCode.trim().length > 0,
      )
      .map((entry) =>
        query(
          `
            INSERT INTO country_economic_indicators (
              country_code,
              country,
              indicator_code,
              indicator_label,
              value,
              unit,
              ref_year,
              source,
              captured_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
            ON CONFLICT (country_code, indicator_code, ref_year, source) DO UPDATE SET
              country = EXCLUDED.country,
              indicator_label = EXCLUDED.indicator_label,
              value = EXCLUDED.value,
              unit = EXCLUDED.unit,
              captured_at = EXCLUDED.captured_at
          `,
          [
            entry.countryCode,
            entry.country,
            entry.indicatorCode,
            entry.indicatorLabel,
            entry.value,
            entry.unit,
            entry.refYear,
            entry.source,
            capturedIso,
          ],
        ),
      ),
  );
}

export async function loadLatestStoredCountryEconomicIndicators(
  countryCode: string,
) {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const res = await query<CountryEconomicIndicatorRow>(
      `
        WITH ranked_country_indicators AS (
          SELECT
            country_code,
            country,
            indicator_code,
            indicator_label,
            value,
            unit,
            ref_year,
            source,
            ROW_NUMBER() OVER (
              PARTITION BY indicator_code
              ORDER BY ref_year DESC, captured_at DESC, created_at DESC
            ) AS latest_rank
          FROM country_economic_indicators
          WHERE country_code = $1
        )
        SELECT
          country_code,
          country,
          indicator_code,
          indicator_label,
          value,
          unit,
          ref_year,
          source
        FROM ranked_country_indicators
        WHERE latest_rank = 1
        ORDER BY indicator_label ASC
      `,
      [countryCode],
    );

    return res.rows.map(
      (row): CountryEconomicIndicatorSnapshot => ({
        countryCode: row.country_code,
        country: row.country,
        indicatorCode: row.indicator_code,
        indicatorLabel: row.indicator_label,
        value: row.value,
        unit: row.unit,
        refYear: row.ref_year,
        source: row.source,
      }),
    );
  } catch {
    return null;
  }
}

export async function persistAirQualitySnapshots(points: AirQualityPoint[]) {
  if (!isDatabaseConfigured) {
    return;
  }

  await Promise.all(
    points.map((point) =>
      query(
        `
          INSERT INTO air_quality_snapshots (
            location,
            latitude,
            longitude,
            aqi,
            pm25,
            category,
            observed_at,
            source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)
          ON CONFLICT (source, location, observed_at) DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            aqi = EXCLUDED.aqi,
            pm25 = EXCLUDED.pm25,
            category = EXCLUDED.category
        `,
        [
          point.label,
          point.lat,
          point.lng,
          point.aqi,
          point.pm25,
          point.category,
          point.observedAt ?? new Date().toISOString(),
          point.source ?? "Open-Meteo Air Quality",
        ],
      ),
    ),
  );
}

export async function loadLatestStoredAirQualitySnapshots() {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const res = await query<AirQualityRow>(`
      WITH ranked_air AS (
        SELECT
          location,
          latitude,
          longitude,
          aqi,
          pm25,
          category,
          observed_at,
          source,
          ROW_NUMBER() OVER (
            PARTITION BY location
            ORDER BY observed_at DESC, created_at DESC
          ) as latest_rank
        FROM air_quality_snapshots
      )
      SELECT
        location,
        latitude,
        longitude,
        aqi,
        pm25,
        category,
        observed_at,
        source
      FROM ranked_air
      WHERE latest_rank = 1
      ORDER BY location ASC
    `);

    return res.rows.map(
      (row): AirQualityPoint => ({
        label: row.location,
        lat: row.latitude,
        lng: row.longitude,
        aqi: row.aqi,
        pm25: row.pm25,
        category: row.category,
        observedAt: row.observed_at,
        source: row.source,
      }),
    );
  } catch {
    return null;
  }
}

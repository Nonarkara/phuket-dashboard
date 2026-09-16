import { buildFreshness } from "./freshness";
import { loadMarineStatus } from "./governor";
import { loadRainfallPoints } from "./rainfall";
import type {
  ExecutiveStatus,
  GovernorScenarioId,
  HeatIndexCategory,
  MarineStatusResponse,
  MetricEvidence,
  OperationalWeatherResponse,
  RainfallPoint,
  SourceSummary,
} from "../types/dashboard";

const PHUKET_AIRPORT = { lat: 8.1132, lng: 98.3069 };

function weatherCodeLabel(code: number | null) {
  if (code === null) {
    return "Operationally stable";
  }

  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([45, 48].includes(code)) return "Fog";
  if ([1, 2, 3].includes(code)) return "Cloud cover";
  return "Clear to mixed";
}

// ─── Heat index ("feels like") ──────────────────────────────────
// NOAA/NWS Rothfusz regression (Steadman 1979 / Rothfusz 1990), the
// standard public formula behind US and (via the same physiology)
// most tropical heat-stress advisories. Phuket sits in the exact band
// this formula is tuned for: 27-34C air temp with 65-95% humidity,
// where "feels like" runs well above the thermometer reading and is
// the number that actually predicts heat-stress risk for outdoor
// tourists, tour operators, and beach/marine staff.
//
// Computed in Fahrenheit internally (the regression's native units),
// returned in Celsius for the Thai-facing UI.
function computeHeatIndexC(tempC: number, humidityPct: number): number {
  const T = tempC * 1.8 + 32;
  const RH = Math.min(100, Math.max(0, humidityPct));

  // Below ~80F/27C heat index tracks close to air temperature — NOAA's
  // simple averaging formula, not the full regression. The official
  // switchover test averages this simple estimate with T itself.
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
  let hiF = simple;

  if ((simple + T) / 2 >= 80) {
    hiF =
      -42.379 +
      2.04901523 * T +
      10.14333127 * RH -
      0.22475541 * T * RH -
      0.00683783 * T * T -
      0.05481717 * RH * RH +
      0.00122874 * T * T * RH +
      0.00085282 * T * RH * RH -
      0.00000199 * T * T * RH * RH;

    if (RH < 13 && T >= 80 && T <= 112) {
      hiF -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    } else if (RH > 85 && T >= 80 && T <= 87) {
      hiF += ((RH - 85) / 10) * ((87 - T) / 5);
    }
  }

  return (hiF - 32) / 1.8;
}

// NWS heat-index advisory bands (80/90/103/125F thresholds, converted
// to Celsius). "Caution" is where sustained outdoor activity starts to
// carry fatigue risk; "Danger"+ is where it becomes an operational call
// (shade breaks, hydration stations, event postponement).
function classifyHeatIndex(heatIndexC: number): HeatIndexCategory {
  if (heatIndexC >= 51) return "extreme-danger";
  if (heatIndexC >= 39) return "danger";
  if (heatIndexC >= 32) return "extreme-caution";
  if (heatIndexC >= 27) return "caution";
  return "normal";
}

function deriveStatus({
  rainfallMm,
  windKph,
  warningCount,
  heatIndexCategory,
}: {
  rainfallMm: number | null;
  windKph: number | null;
  warningCount: number;
  heatIndexCategory: HeatIndexCategory | null;
}): ExecutiveStatus {
  if (
    warningCount > 0 ||
    (rainfallMm ?? 0) >= 45 ||
    (windKph ?? 0) >= 35 ||
    heatIndexCategory === "danger" ||
    heatIndexCategory === "extreme-danger"
  ) {
    return "intervene";
  }

  if (
    (rainfallMm ?? 0) >= 20 ||
    (windKph ?? 0) >= 20 ||
    heatIndexCategory === "extreme-caution"
  ) {
    return "watch";
  }

  return "stable";
}

function summarizeSeaState(marine: MarineStatusResponse) {
  const lead = [...marine.corridors].sort((left, right) => {
    const weight = { intervene: 3, watch: 2, stable: 1 } as const;
    return weight[right.status] - weight[left.status];
  })[0];

  if (!lead) {
    return "No marine posture";
  }

  if (lead.waveHeightMeters !== null) {
    return `${lead.waveHeightMeters.toFixed(1)}m waves`;
  }

  return lead.alertPosture || lead.label;
}

async function fetchOpenMeteoWeather() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${PHUKET_AIRPORT.lat}&longitude=${PHUKET_AIRPORT.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&timezone=Asia%2FBangkok`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        weather_code?: number;
      };
    };

    if (!payload.current) {
      return null;
    }

    return payload.current;
  } catch {
    return null;
  }
}

async function fetchTmdWarningCount() {
  const uid = process.env.TMD_UID;
  const ukey = process.env.TMD_UKEY;

  if (!uid || !ukey) {
    return 0;
  }

  try {
    const response = await fetch(
      `https://data.tmd.go.th/api/WeatherWarningNews/V2/?uid=${uid}&ukey=${ukey}&format=json`,
      {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return 0;
    }

    const payload = (await response.json()) as {
      Warnings?: { Warning?: Array<Record<string, unknown>> };
    };
    return Array.isArray(payload.Warnings?.Warning)
      ? payload.Warnings.Warning.length
      : 0;
  } catch {
    return 0;
  }
}

function localRainfallPeak(rainfall: RainfallPoint[]) {
  const localNodes = rainfall.filter((point) =>
    ["Phuket Town", "Patong", "Phuket Airport", "Kamala"].includes(point.label),
  );
  const values = (localNodes.length > 0 ? localNodes : rainfall)
    .map((point) => point.value)
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
}

function buildWeatherSummary(
  status: ExecutiveStatus,
  rainfallMm: number | null,
  windKph: number | null,
  heatIndexCategory: HeatIndexCategory | null,
): string {
  const heatDriven =
    (heatIndexCategory === "danger" || heatIndexCategory === "extreme-danger") &&
    (rainfallMm ?? 0) < 45 &&
    (windKph ?? 0) < 35;
  const heatWatch =
    heatIndexCategory === "extreme-caution" && (rainfallMm ?? 0) < 20 && (windKph ?? 0) < 20;

  if (status === "intervene") {
    return heatDriven
      ? "Heat index is in the danger band — shift outdoor tour and beach staff to shade/hydration protocol, not just rain and wind."
      : "Weather pressure is strong enough to threaten road timing, pier departures, or visible queue discipline.";
  }

  if (status === "watch") {
    return heatWatch
      ? "Heat index is running well above air temperature — brief outdoor operators before midday exposure, alongside the rain and wind picture."
      : "Rain and wind need to stay in the transfer picture, but the corridor is still manageable.";
  }

  return "Weather pressure is present but not the lead operational constraint right now.";
}

function buildSourceSummary(
  mode: OperationalWeatherResponse["mode"],
  freshness: OperationalWeatherResponse["freshness"],
  warningCount: number,
  scenario: GovernorScenarioId,
): SourceSummary {
  const scenarioMode = scenario !== "live";

  return {
    label:
      scenarioMode
        ? "Scenario weather model"
        : mode === "live"
          ? "Operational weather model"
          : "Fallback weather model",
    mode,
    sources: scenarioMode
      ? [`${scenario} weather drill`, "Rainfall cache", "Marine corridor status"]
      : warningCount > 0
        ? ["Open-Meteo forecast", "Rainfall cache", "Marine corridor status", "TMD warnings"]
        : ["Open-Meteo forecast", "Rainfall cache", "Marine corridor status"],
    note:
      scenarioMode
        ? "Weather pressure is being forced into a deterministic drill mode."
        : warningCount > 0
          ? "Live TMD warnings are layered into the weather picture."
          : "Weather picture is built from Open-Meteo plus local rainfall and marine posture.",
    freshness,
  };
}

export async function loadOperationalWeather(options?: {
  rainfall?: RainfallPoint[];
  marine?: MarineStatusResponse;
  scenario?: GovernorScenarioId | null;
}): Promise<OperationalWeatherResponse> {
  const scenario = options?.scenario ?? "live";
  const scenarioMode = scenario !== "live";
  const [currentWeather, rainfall, marine, warningCount] = await Promise.all([
    scenarioMode ? Promise.resolve(null) : fetchOpenMeteoWeather(),
    options?.rainfall ? Promise.resolve(options.rainfall) : loadRainfallPoints(),
    options?.marine
      ? Promise.resolve(options.marine)
      : loadMarineStatus({ scenario }),
    scenarioMode ? Promise.resolve(0) : fetchTmdWarningCount(),
  ]);

  const generatedAt = new Date().toISOString();
  let rainfallMm = currentWeather?.precipitation ?? localRainfallPeak(rainfall);
  let windKph = currentWeather?.wind_speed_10m ?? null;
  let temperatureC = currentWeather?.temperature_2m ?? null;
  let humidityPct = currentWeather?.relative_humidity_2m ?? null;
  let condition = weatherCodeLabel(currentWeather?.weather_code ?? null);

  if (scenario === "tourism-surge-weekend") {
    rainfallMm = 8;
    windKph = 15;
    temperatureC = temperatureC ?? 31;
    humidityPct = humidityPct ?? 74;
    condition = "Tourism surge weekend";
  } else if (scenario === "red-monsoon-day") {
    rainfallMm = Math.max(rainfallMm ?? 0, 56);
    windKph = Math.max(windKph ?? 0, 38);
    temperatureC = temperatureC ?? 27;
    humidityPct = humidityPct ?? 92;
    condition = "Red monsoon";
  } else if (scenario === "stable-recovery-day") {
    rainfallMm = Math.max(rainfallMm ?? 0, 4);
    windKph = Math.max(windKph ?? 0, 12);
    temperatureC = temperatureC ?? 30;
    humidityPct = humidityPct ?? 70;
    condition = "Stable recovery";
  }

  const heatIndexC =
    temperatureC !== null && humidityPct !== null
      ? Math.round(computeHeatIndexC(temperatureC, humidityPct) * 10) / 10
      : null;
  const heatIndexCategory = heatIndexC !== null ? classifyHeatIndex(heatIndexC) : null;

  const status = deriveStatus({
    rainfallMm,
    windKph,
    warningCount: scenarioMode ? 0 : warningCount,
    heatIndexCategory,
  });
  const seaState = summarizeSeaState(marine);
  const mode = scenarioMode ? "modeled" : currentWeather ? "live" : "hybrid";
  const freshness = buildFreshness({
    checkedAt: generatedAt,
    observedAt:
      scenarioMode
        ? generatedAt
        : currentWeather?.time
          ? new Date(currentWeather.time).toISOString()
          : marine.freshness.observedAt ?? generatedAt,
    fallbackTier: scenarioMode ? "scenario" : currentWeather ? "live" : "reference",
    sourceIds: scenarioMode
      ? [`${scenario} weather drill`, "Marine corridor status"]
      : ["Open-Meteo forecast", "Rainfall cache", "Marine corridor status"],
  });
  const evidence: MetricEvidence[] = [
    {
      id: "ops-weather-rain",
      label: "Rain load",
      value: rainfallMm,
      displayValue: rainfallMm !== null ? `${rainfallMm.toFixed(1)} mm` : "--",
      source: "Rainfall cache",
      freshness,
    },
    {
      id: "ops-weather-wind",
      label: "Wind speed",
      value: windKph,
      displayValue: windKph !== null ? `${windKph.toFixed(0)} kph` : "--",
      source: "Open-Meteo forecast",
      freshness,
    },
  ];

  return {
    generatedAt,
    mode,
    status,
    condition,
    summary: buildWeatherSummary(status, rainfallMm, windKph, heatIndexCategory),
    temperatureC,
    humidityPct,
    rainfallMm,
    windKph,
    heatIndexC,
    heatIndexCategory,
    seaState,
    sourceSummary: buildSourceSummary(mode, freshness, warningCount, scenario),
    freshness,
    evidence,
  };
}

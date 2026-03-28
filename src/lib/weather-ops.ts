import { buildFreshness } from "./freshness";
import { loadMarineStatus } from "./governor";
import { loadRainfallPoints } from "./rainfall";
import type {
  ExecutiveStatus,
  GovernorScenarioId,
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

function deriveStatus({
  rainfallMm,
  windKph,
  warningCount,
}: {
  rainfallMm: number | null;
  windKph: number | null;
  warningCount: number;
}): ExecutiveStatus {
  if (warningCount > 0 || (rainfallMm ?? 0) >= 45 || (windKph ?? 0) >= 35) {
    return "intervene";
  }

  if ((rainfallMm ?? 0) >= 20 || (windKph ?? 0) >= 20) {
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
  const [currentWeather, rainfall, marine, warningCount] = await Promise.all([
    fetchOpenMeteoWeather(),
    options?.rainfall ? Promise.resolve(options.rainfall) : loadRainfallPoints(),
    options?.marine
      ? Promise.resolve(options.marine)
      : loadMarineStatus({ scenario: options?.scenario ?? "live" }),
    fetchTmdWarningCount(),
  ]);

  const generatedAt = new Date().toISOString();
  const scenario = options?.scenario ?? "live";
  const scenarioMode = scenario !== "live";
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

  const status = deriveStatus({
    rainfallMm,
    windKph,
    warningCount: scenarioMode ? 0 : warningCount,
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
    summary:
      status === "intervene"
        ? "Weather pressure is strong enough to threaten road timing, pier departures, or visible queue discipline."
        : status === "watch"
          ? "Rain and wind need to stay in the transfer picture, but the corridor is still manageable."
          : "Weather pressure is present but not the lead operational constraint right now.",
    temperatureC,
    humidityPct,
    rainfallMm,
    windKph,
    seaState,
    sourceSummary: buildSourceSummary(mode, freshness, warningCount, scenario),
    freshness,
    evidence,
  };
}

import {
  loadFires,
  loadIntelligencePackages,
  loadRainfall,
  loadRefugeeMovements,
} from "./intelligence";
import { loadThailandEconomics, loadThailandIncidents } from "./thailand-monitor";
import type {
  ConvergenceAlert,
  ConvergenceCorridor,
  ConvergenceEvidence,
  ConvergenceFamily,
  ConvergencePosture,
  CorridorConvergenceResponse,
  Coordinates,
  EconomicIndicator,
  FireEvent,
  IncidentFeature,
  IntelligenceItem,
  PackageStatus,
  RainfallPoint,
  RefugeeMovement,
  SourceHealth,
} from "../types/dashboard";

const CONVERGENCE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const ALERT_WINDOW_HOURS = 72;
const ONE_HOUR_MS = 60 * 60 * 1000;

const CORRIDORS: Record<string, ConvergenceCorridor> = {
  "phuket-andaman": {
    id: "phuket-andaman",
    label: "Phuket / Andaman Area",
    center: [98.3923, 7.8804],
    radiusKm: 180,
    aliases: [
      "Phuket",
      "Patong",
      "Kamala",
      "Kata",
      "Phang Nga",
      "Khao Lak",
      "Krabi",
      "Andaman",
      "west coast",
      "Phuket airport",
    ],
  },
};

interface CachedConvergenceSnapshot {
  payload: CorridorConvergenceResponse;
  cachedAt: number;
}

interface AlertTemplate {
  id: string;
  title: string;
  families: ConvergenceFamily[];
  emptySummary: string;
}

const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: "marine-access-disruption",
    title: "Marine and access disruption",
    families: ["incident", "news", "market"],
    emptySummary:
      "No corroborated marine or access disruption is active beyond baseline monitoring.",
  },
  {
    id: "tourism-logistics-stress",
    title: "Tourism and logistics stress",
    families: ["market", "news", "incident"],
    emptySummary:
      "Demand and local operating costs are not yet confirming a wider area stress spike.",
  },
  {
    id: "weather-mobility-pressure",
    title: "Weather and mobility pressure",
    families: ["weather", "movement", "thermal", "news"],
    emptySummary:
      "Weather, mobility, and thermal indicators are currently acting as background context.",
  },
];

const memoryCache = new Map<string, CachedConvergenceSnapshot>();

function getCorridor(id = "phuket-andaman") {
  return CORRIDORS[id] ?? null;
}

function normalizeText(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildAliasPattern(corridor: ConvergenceCorridor) {
  return new RegExp(
    corridor.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "i",
  );
}

function haversineKm(left: Coordinates, right: Coordinates) {
  const [leftLng, leftLat] = left;
  const [rightLng, rightLat] = right;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(rightLat - leftLat);
  const longitudeDelta = toRadians(rightLng - leftLng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function getFreshnessMultiplier(observedAt: string) {
  const ageHours = (Date.now() - toTimestamp(observedAt)) / ONE_HOUR_MS;

  if (!Number.isFinite(ageHours) || ageHours <= 24) {
    return 1;
  }

  if (ageHours <= 72) {
    return 0.7;
  }

  if (ageHours <= 24 * 7) {
    return 0.4;
  }

  return 0.2;
}

function getLatestTimestamp(values: string[]) {
  return (
    values
      .filter((value) => Number.isFinite(toTimestamp(value)))
      .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ??
    new Date().toISOString()
  );
}

function compareEvidence(left: ConvergenceEvidence, right: ConvergenceEvidence) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return toTimestamp(right.observedAt) - toTimestamp(left.observedAt);
}

function scoreToPosture(score: number): ConvergencePosture {
  if (score >= 75) {
    return "priority";
  }

  if (score >= 45) {
    return "watch";
  }

  return "monitor";
}

function familyBaseScore(
  family: ConvergenceFamily,
  magnitude: "alert" | "watch" | "stable",
) {
  const table = {
    incident: { alert: 45, watch: 30, stable: 15 },
    news: { alert: 28, watch: 18, stable: 10 },
    market: { alert: 25, watch: 15, stable: 8 },
    weather: { alert: 22, watch: 12, stable: 8 },
    thermal: { alert: 18, watch: 8, stable: 5 },
    movement: { alert: 10, watch: 5, stable: 3 },
  } satisfies Record<
    ConvergenceFamily,
    Record<"alert" | "watch" | "stable", number>
  >;

  return table[family][magnitude];
}

function buildReasonPrefix(
  corridor: ConvergenceCorridor,
  family: ConvergenceFamily,
  locationHint?: string,
) {
  const context =
    locationHint && locationHint.trim().length > 0
      ? `${locationHint} matches ${corridor.label}`
      : `${corridor.label} match`;

  switch (family) {
    case "incident":
      return `${context}; field signal intersects the area.`;
    case "news":
      return `${context}; reporting corroborates area relevance.`;
    case "market":
      return `${context}; demand or operating-cost stress is area-relevant.`;
    case "weather":
      return `${context}; rainfall shift can affect access and operations.`;
    case "thermal":
      return `${context}; thermal activity overlaps the area radius.`;
    case "movement":
      return `${context}; visitor and transfer movement pressure remains elevated.`;
    default:
      return context;
  }
}

function buildEvidenceScore(
  family: ConvergenceFamily,
  magnitude: "alert" | "watch" | "stable",
  observedAt: string,
) {
  const freshness = family === "movement" ? 0.25 : getFreshnessMultiplier(observedAt);
  return Math.round(familyBaseScore(family, magnitude) * freshness);
}

function corridorMatchesText(corridor: ConvergenceCorridor, value: string) {
  return buildAliasPattern(corridor).test(value);
}

function corridorMatchesCoordinates(
  corridor: ConvergenceCorridor,
  coordinates: Coordinates,
) {
  return haversineKm(corridor.center, coordinates) <= corridor.radiusKm;
}

function buildIncidentEvidence(
  corridor: ConvergenceCorridor,
  incidents: IncidentFeature[],
) {
  return incidents
    .filter((incident) => {
      const locationText = `${incident.properties.location} ${incident.properties.notes}`;
      return (
        corridorMatchesCoordinates(corridor, incident.geometry.coordinates) ||
        corridorMatchesText(corridor, locationText)
      );
    })
    .map<ConvergenceEvidence>((incident) => {
      const fatalities = incident.properties.fatalities ?? 0;
      const magnitude =
        fatalities >= 2 ? "alert" : fatalities >= 1 ? "watch" : "stable";
      const observedAt = incident.properties.eventDate || new Date().toISOString();

      return {
        id: `incident-${incident.id}`,
        family: "incident",
        title: `${incident.properties.type} / ${incident.properties.location}`,
        source: "Phuket monitor",
        observedAt,
        score: buildEvidenceScore("incident", magnitude, observedAt),
        reason: `${buildReasonPrefix(
          corridor,
          "incident",
          incident.properties.location,
        )} Signal count proxy: ${fatalities}.`,
        url: "/api/incidents",
      };
    })
    .sort(compareEvidence)
    .slice(0, 5);
}

function dedupeByTitle(items: IntelligenceItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeText(item.title);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildNewsEvidence(
  corridor: ConvergenceCorridor,
  items: IntelligenceItem[],
) {
  return dedupeByTitle(
    items.filter((item) => {
      if (item.kind !== "news") {
        return false;
      }

      const text = `${item.title} ${item.summary} ${item.source}`;
      return item.packageId === "marine-weather" || corridorMatchesText(corridor, text);
    }),
  )
    .map<ConvergenceEvidence>((item) => ({
      id: `news-${item.id}`,
      family: "news",
      title: item.title,
      source: item.source,
      observedAt: item.publishedAt,
      score: buildEvidenceScore("news", item.severity, item.publishedAt),
      reason: `${buildReasonPrefix(corridor, "news", item.packageId)} Leading package: ${item.packageId}.`,
      url: item.url,
    }))
    .sort(compareEvidence)
    .slice(0, 5);
}

function buildMarketEvidence(
  corridor: ConvergenceCorridor,
  indicators: EconomicIndicator[],
) {
  return indicators
    .filter((indicator) =>
      /hotel|occupancy|arrivals|tourism|diesel|fuel|usd\/thb|forex|fx|airport|phuket|krabi/i.test(
        `${indicator.label} ${indicator.category ?? ""} ${indicator.province ?? ""}`,
      ),
    )
    .map<ConvergenceEvidence>((indicator, index) => {
      const change = typeof indicator.change === "number" ? Math.abs(indicator.change) : 0;
      const magnitude =
        change >= 3 || /hotel occupancy|airport arrivals/i.test(indicator.label)
          ? "alert"
          : change >= 1
            ? "watch"
            : "stable";
      const observedAt = new Date().toISOString();

      return {
        id: `market-${index + 1}-${normalizeText(indicator.label)}`,
        family: "market",
        title: `${indicator.label} operating stress`,
        source: indicator.source ?? "Market cache",
        observedAt,
        score: buildEvidenceScore("market", magnitude, observedAt),
        reason: `${buildReasonPrefix(corridor, "market", indicator.label)} Change: ${indicator.change}.`,
        url: "/api/markets",
      };
    })
    .sort(compareEvidence)
    .slice(0, 4);
}

function buildWeatherEvidence(
  corridor: ConvergenceCorridor,
  rainfall: RainfallPoint[],
) {
  return rainfall
    .filter((point) => {
      const coordinates: Coordinates = [point.lng, point.lat];
      return (
        corridorMatchesCoordinates(corridor, coordinates) ||
        corridorMatchesText(corridor, point.label)
      );
    })
    .map<ConvergenceEvidence>((point, index) => {
      const value = Math.abs(point.value);
      const magnitude = value >= 45 ? "alert" : value >= 25 ? "watch" : "stable";
      const observedAt = new Date().toISOString();

      return {
        id: `weather-${index + 1}-${normalizeText(point.label)}`,
        family: "weather",
        title: `${point.label} rain load`,
        source: "Rainfall cache",
        observedAt,
        score: buildEvidenceScore("weather", magnitude, observedAt),
        reason: `${buildReasonPrefix(corridor, "weather", point.label)} Shift: ${point.value.toFixed(1)}.`,
        url: "/api/rainfall",
      };
    })
    .sort(compareEvidence)
    .slice(0, 4);
}

function buildThermalEvidence(
  corridor: ConvergenceCorridor,
  fires: FireEvent[],
) {
  return fires
    .filter((fire) =>
      corridorMatchesCoordinates(corridor, [fire.longitude, fire.latitude]),
    )
    .map<ConvergenceEvidence>((fire, index) => {
      const brightness = fire.brightness ?? 0;
      const magnitude = brightness >= 320 ? "alert" : brightness >= 290 ? "watch" : "stable";
      const observedAt =
        typeof fire.acq_date === "string" ? fire.acq_date : new Date().toISOString();

      return {
        id: `thermal-${index + 1}-${fire.latitude}-${fire.longitude}`,
        family: "thermal",
        title: "Thermal hotspot cluster",
        source: "NASA FIRMS",
        observedAt,
        score: buildEvidenceScore("thermal", magnitude, observedAt),
        reason: `${buildReasonPrefix(corridor, "thermal", "thermal cluster")} Brightness: ${brightness.toFixed(0)}.`,
        url: "/api/fires",
      };
    })
    .sort(compareEvidence)
    .slice(0, 4);
}

function buildMovementEvidence(
  corridor: ConvergenceCorridor,
  movements: RefugeeMovement[],
) {
  return movements
    .filter(
      (movement) =>
        corridorMatchesCoordinates(corridor, movement.source) ||
        corridorMatchesText(corridor, movement.label) ||
        /phuket|patong|airport|chalong|krabi/i.test(movement.label),
    )
    .map<ConvergenceEvidence>((movement, index) => {
      const magnitude = movement.count >= 20000 ? "alert" : movement.count >= 10000 ? "watch" : "stable";
      const observedAt = new Date().toISOString();

      return {
        id: `movement-${index + 1}-${movement.count}`,
        family: "movement",
        title: "Visitor movement pressure",
        source: "Mobility cache",
        observedAt,
        score: buildEvidenceScore("movement", magnitude, observedAt),
        reason: `${buildReasonPrefix(corridor, "movement", movement.label)} Count: ${movement.count.toLocaleString()}.`,
        url: "/api/movements",
      };
    })
    .sort(compareEvidence)
    .slice(0, 3);
}

function buildFamilyScoreMap(evidence: ConvergenceEvidence[]) {
  const scores = new Map<ConvergenceFamily, number>();

  for (const item of evidence) {
    scores.set(item.family, Math.max(scores.get(item.family) ?? 0, item.score));
  }

  return scores;
}

function scoreWithConvergenceBonus(scores: Map<ConvergenceFamily, number>) {
  const families = Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .map(([family]) => family);
  let total = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);

  if (families.length >= 3) {
    total += 30;
  } else if (families.length >= 2) {
    total += 15;
  }

  const hasSecurityNarrative = families.includes("incident") || families.includes("news");
  const hasStructuralSupport = families.includes("market") || families.includes("weather");

  if (hasSecurityNarrative && hasStructuralSupport) {
    total += 10;
  }

  return Math.min(100, total);
}

function buildAlertSummary(alert: AlertTemplate, evidence: ConvergenceEvidence[]) {
  const lead = evidence[0];

  if (!lead) {
    return alert.emptySummary;
  }

  return `${lead.title} is the lead ${lead.family} signal, with ${evidence.length} corroborating items inside the ${ALERT_WINDOW_HOURS}-hour active window.`;
}

function buildDataGaps(
  families: ConvergenceFamily[],
  evidence: ConvergenceEvidence[],
  sources: SourceHealth[],
) {
  const missingFamilies = families.filter(
    (family) => !evidence.some((item) => item.family === family),
  );
  const offlineSources = sources
    .filter((source) => source.status !== "live")
    .slice(0, 3)
    .map((source) => source.label);
  const gaps: string[] = [];

  if (missingFamilies.length > 0) {
    gaps.push(`No direct ${missingFamilies.join(", ")} evidence in the current area scope.`);
  }

  if (offlineSources.length > 0) {
    gaps.push(`Source gaps: ${offlineSources.join(", ")}.`);
  }

  return gaps;
}

function buildAlert(
  template: AlertTemplate,
  evidencePool: ConvergenceEvidence[],
  sources: SourceHealth[],
): ConvergenceAlert {
  const alertEvidence = evidencePool
    .filter((item) => template.families.includes(item.family))
    .sort(compareEvidence)
    .slice(0, 5);
  const familyScores = buildFamilyScoreMap(alertEvidence);
  const score = scoreWithConvergenceBonus(familyScores);

  return {
    id: template.id,
    title: template.title,
    summary: buildAlertSummary(template, alertEvidence),
    score,
    posture: scoreToPosture(score),
    windowHours: ALERT_WINDOW_HOURS,
    families: Array.from(new Set(alertEvidence.map((item) => item.family))),
    evidence: alertEvidence,
    dataGaps: buildDataGaps(template.families, alertEvidence, sources),
    updatedAt: getLatestTimestamp(alertEvidence.map((item) => item.observedAt)),
  };
}

function buildSourceCoverage(sources: SourceHealth[]) {
  const counts: Record<PackageStatus, number> = {
    live: 0,
    stale: 0,
    offline: 0,
  };

  for (const source of sources) {
    counts[source.status] += 1;
  }

  return {
    live: counts.live,
    stale: counts.stale,
    offline: counts.offline,
    total: sources.length,
    labels: sources.map((source) => source.label),
  };
}

function buildTopLevelSummary(
  corridor: ConvergenceCorridor,
  posture: ConvergencePosture,
  score: number,
  alerts: ConvergenceAlert[],
) {
  const leadAlert = alerts[0];
  const leadFamilies = leadAlert?.families.join(", ") || "baseline signals";

  if (posture === "priority") {
    return `${corridor.label} is on priority status. ${leadFamilies} are converging, led by ${leadAlert?.title.toLowerCase() ?? "marine disruption risk"}.`;
  }

  if (posture === "watch") {
    return `${corridor.label} is on elevated status with a convergence score of ${score}. ${leadFamilies} are starting to reinforce each other.`;
  }

  return `${corridor.label} remains in baseline status. The area has background pressure, but corroboration is not yet strong enough for escalation.`;
}

async function buildCorridorConvergence(
  corridor: ConvergenceCorridor,
): Promise<CorridorConvergenceResponse> {
  const [packagePayload, incidents, indicators, fires, rainfall, movements] =
    await Promise.all([
      loadIntelligencePackages(),
      loadThailandIncidents(),
      loadThailandEconomics(),
      loadFires(),
      loadRainfall(),
      loadRefugeeMovements(),
    ]);

  const evidencePool = [
    ...buildIncidentEvidence(corridor, incidents),
    ...buildNewsEvidence(
      corridor,
      packagePayload.packages.flatMap((pkg) => pkg.items),
    ),
    ...buildMarketEvidence(corridor, indicators),
    ...buildWeatherEvidence(corridor, rainfall),
    ...buildThermalEvidence(corridor, fires),
    ...buildMovementEvidence(corridor, movements),
  ].sort(compareEvidence);

  const overallFamilyScores = buildFamilyScoreMap(evidencePool);
  const score = scoreWithConvergenceBonus(overallFamilyScores);
  const posture = scoreToPosture(score);
  const alerts = ALERT_TEMPLATES.map((template) =>
    buildAlert(template, evidencePool, packagePayload.sources),
  )
    .filter((alert) => alert.evidence.length > 0 || alert.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const activeFamilies = Array.from(overallFamilyScores.entries())
    .filter(([, familyScore]) => familyScore > 0)
    .map(([family]) => family);
  const staleOrOfflineSources = packagePayload.sources
    .filter((source) => source.status !== "live")
    .map((source) => source.label);
  const dataGaps = [
    ...(["incident", "news", "market", "weather", "thermal", "movement"] as const)
      .filter((family) => !activeFamilies.includes(family))
      .map((family) => `No area-matched ${family} evidence is currently active.`),
    ...(staleOrOfflineSources.length > 0
      ? [`Source coverage gaps: ${staleOrOfflineSources.slice(0, 4).join(", ")}.`]
      : []),
  ].slice(0, 5);
  const generatedAt = getLatestTimestamp([
    packagePayload.generatedAt,
    ...evidencePool.map((item) => item.observedAt),
  ]);

  return {
    generatedAt,
    corridor,
    posture,
    score,
    summary: buildTopLevelSummary(corridor, posture, score, alerts),
    alerts,
    sourceCoverage: buildSourceCoverage(packagePayload.sources),
    dataGaps,
  };
}

export function getConvergenceCorridor(id = "phuket-andaman") {
  return getCorridor(id);
}

export async function loadCorridorConvergence(
  corridorId = "phuket-andaman",
): Promise<CorridorConvergenceResponse> {
  const corridor = getCorridor(corridorId);

  if (!corridor) {
    throw new Error(`Unsupported corridor: ${corridorId}`);
  }

  const cached = memoryCache.get(corridor.id);

  if (cached && Date.now() - cached.cachedAt <= CONVERGENCE_CACHE_MAX_AGE_MS) {
    return cached.payload;
  }

  const payload = await buildCorridorConvergence(corridor);
  memoryCache.set(corridor.id, {
    payload,
    cachedAt: Date.now(),
  });

  return payload;
}

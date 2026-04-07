import { loadFlightArrivals } from "./airport-arrivals";
import { buildFreshness } from "./freshness";
import { summarizeFreshness } from "./freshness";
import { loadMarineStatus } from "./governor";
import {
  currentBangkokMinuteOfDay,
  minutesToBangkokIso,
  modeledTouchpointStatus,
  nextScheduledDepartureMinute,
  TOUCHPOINT_CONFIGS,
} from "./operations-model";
import { loadPksbBusPositions } from "./pksb-live";
import { loadRainfallPoints } from "./rainfall";
import { loadTrafficFeed } from "./traffic";
import { loadMaritimeSecurity } from "./war-room-integrations";
import { loadOperationalWeather } from "./weather-ops";
import type {
  DemandSupplySnapshot,
  FeedMode,
  GovernorScenarioId,
  InterchangeTouchpoint,
  InterchangeVehicle,
  MaritimeSecurityResponse,
  OperationsConstraint,
  OperationsDashboardResponse,
  PksbBusPosition,
  SourceSummary,
} from "../types/dashboard";

function parseClockTimeToMinutes(value: string) {
  const [hourRaw = "0", minuteRaw = "0"] = value.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesUntilClock(clock: string, nowMinutes: number) {
  const targetMinutes = parseClockTimeToMinutes(clock);
  if (targetMinutes === null) {
    return null;
  }

  let delta = targetMinutes - nowMinutes;
  if (delta < -360) {
    delta += 24 * 60;
  }

  return delta;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function sourceSummaryWithMode(
  summary: SourceSummary,
  mode: FeedMode,
  note?: string,
): SourceSummary {
  return {
    ...summary,
    mode,
    note: note ?? summary.note,
  };
}

function deriveOverallMode(modes: FeedMode[]): FeedMode {
  if (modes.every((mode) => mode === "live")) {
    return "live";
  }

  if (modes.every((mode) => mode === "modeled")) {
    return "modeled";
  }

  if (modes.includes("degraded")) {
    return "degraded";
  }

  return "hybrid";
}

function buildAirportDemandSnapshot(input: {
  arrivals: Awaited<ReturnType<typeof loadFlightArrivals>>;
  nowMinutes: number;
}): DemandSupplySnapshot {
  const activeFlights = input.arrivals.arrivals.filter((flight) => {
    if (flight.status === "landed") {
      return false;
    }

    const minutesUntil = minutesUntilClock(flight.estimatedTime, input.nowMinutes);
    return minutesUntil === null ? false : minutesUntil <= 120;
  });
  const demandPax = activeFlights.reduce(
    (sum, flight) => sum + (flight.paxEstimate ?? 0),
    0,
  );
  const demandRate = Math.round(demandPax / 2);
  const delayedFlights = activeFlights.filter((flight) => flight.status === "delayed").length;
  const status =
    delayedFlights >= 2 || demandRate >= 1100
      ? "intervene"
      : demandRate >= 700
        ? "watch"
        : "stable";

  return {
    id: "airport-demand",
    label: "Airport demand",
    status,
    summary:
      delayedFlights >= 2
        ? "Arrival demand is still building, and delay spillover is tightening the transfer window."
        : status === "watch"
          ? "Arrival banks are active enough to shape the road and pier picture for the next two hours."
          : "Airport demand is steady and manageable in the current two-hour bank.",
    demandRate,
    supplyRate: 0,
    gapRate: demandRate,
    unit: "pax/hour",
    windowLabel: "Next 2 hours",
    sourceSummary: sourceSummaryWithMode(
      input.arrivals.sourceSummary,
      input.arrivals.mode,
    ),
    updatedAt: input.arrivals.generatedAt,
  };
}

function buildCityTransferSnapshot(input: {
  airportDemand: DemandSupplySnapshot;
  buses: Awaited<ReturnType<typeof loadPksbBusPositions>>;
  trafficEventCount: number;
}): DemandSupplySnapshot {
  const activeBuses = input.buses.buses.filter(
    (bus) => bus.status === "moving" || bus.status === "dwelling",
  ).length;
  const demandRate = input.airportDemand.demandRate;
  const supplyRate = Math.round(activeBuses * 68 + 240);
  const gapRate = demandRate - supplyRate;
  const status =
    gapRate > 180 || input.trafficEventCount >= 3
      ? "intervene"
      : gapRate > 0 || input.trafficEventCount > 0
        ? "watch"
        : "stable";

  return {
    id: "city-transfer-supply",
    label: "City transfer supply",
    status,
    summary:
      status === "intervene"
        ? "Transfer lift is lagging demand and needs active smoothing between airport, town, and piers."
        : status === "watch"
          ? "Transfer lift is still workable, but there is not much slack if weather or road friction worsens."
          : "Transfer lift is keeping ahead of the current airport bank.",
    demandRate,
    supplyRate,
    gapRate,
    unit: "pax/hour",
    windowLabel: "Current operating hour",
    sourceSummary: sourceSummaryWithMode(
      input.buses.sourceSummary,
      input.buses.mode,
      input.buses.mode === "live"
        ? "City lift is being estimated from active PKSB vehicles plus a fixed road-transfer buffer."
        : "City lift is being estimated from modeled PKSB service plus a fixed road-transfer buffer.",
    ),
    updatedAt: input.buses.generatedAt,
  };
}

function buildTrafficConstraint(input: {
  eventCount: number;
  transferGap: number;
}): OperationsConstraint {
  const status =
    input.eventCount >= 3 || input.transferGap > 180
      ? "intervene"
      : input.eventCount > 0 || input.transferGap > 0
        ? "watch"
        : "stable";

  return {
    id: "traffic-friction",
    label: "Traffic friction",
    status,
    summary:
      input.eventCount >= 3
        ? "Confirmed Phuket road events are already strong enough to threaten transfer timing."
        : input.eventCount > 0
          ? "Road friction is visible and should stay in the transfer picture."
          : "No confirmed Phuket incidents are live, but arrival pressure still makes the airport corridor worth watching.",
    metrics: [
      { label: "Live events", value: String(input.eventCount) },
      { label: "Transfer gap", value: `${input.transferGap > 0 ? "+" : ""}${input.transferGap} pax/h` },
    ],
    sourceSummary: {
      label: "Longdo traffic feed",
      mode: input.eventCount > 0 ? "live" : "hybrid",
      sources: ["Longdo/ITIC", "Transfer gap model"],
      note: "Traffic friction uses confirmed Phuket events plus transfer demand pressure.",
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildMarineConstraint(input: {
  marine: Awaited<ReturnType<typeof loadMarineStatus>>;
  maritime: MaritimeSecurityResponse;
}): OperationsConstraint {
  const leadMarine = [...input.marine.corridors].sort((left, right) => {
    const weight = { intervene: 3, watch: 2, stable: 1 } as const;
    return weight[right.status] - weight[left.status];
  })[0];
  const status =
    leadMarine?.status === "intervene" || input.maritime.posture === "intervene"
      ? "intervene"
      : leadMarine?.status === "watch" || input.maritime.posture === "watch"
        ? "watch"
        : "stable";

  return {
    id: "marine-constraint",
    label: "Marine constraint",
    status,
    summary:
      input.maritime.mode === "modeled"
        ? "Ferry motion is modeled, but pier timing and lane visibility are still being kept in the operator picture."
        : leadMarine?.summary ??
          "Marine posture is stable across the active Phuket-linked corridors.",
    metrics: [
      {
        label: "Sea state",
        value:
          leadMarine?.waveHeightMeters !== null && leadMarine?.waveHeightMeters !== undefined
            ? `${leadMarine.waveHeightMeters.toFixed(1)}m`
            : leadMarine?.alertPosture ?? "--",
      },
      {
        label: "Tracked boats",
        value: String(input.maritime.vessels.length),
      },
    ],
    sourceSummary: sourceSummaryWithMode(
      input.maritime.sourceSummary,
      input.maritime.mode,
    ),
    updatedAt: input.maritime.generatedAt,
    evidence: leadMarine?.evidence,
  };
}

function buildTouchpoints(input: {
  nowMinutes: number;
  airportDemand: DemandSupplySnapshot;
  buses: PksbBusPosition[];
  busesSource: SourceSummary;
  maritime: MaritimeSecurityResponse;
}): InterchangeTouchpoint[] {
  return TOUCHPOINT_CONFIGS.map((config) => {
    const nextDepartureMinute = nextScheduledDepartureMinute(config, input.nowMinutes);
    const demandRate = Math.round(input.airportDemand.demandRate * config.demandShare);
    const supplyRate = Math.round(
      (60 / config.departureIntervalMinutes) * config.capacityPerDeparture,
    );
    const candidateBuses = input.buses
      .filter((bus) =>
        config.busRouteHints.includes(bus.routeId) &&
        (bus.status === "moving" || bus.status === "dwelling"),
      )
      .map((bus) => {
        const distanceKm = haversineKm(
          bus.lat,
          bus.lng,
          config.center[1],
          config.center[0],
        );
        const speedKph = Math.max(bus.speedKph, 14);
        const etaMinutes = Math.round((distanceKm / speedKph) * 60);

        return {
          bus,
          etaMinutes,
          distanceKm,
        };
      })
      .sort((left, right) => left.etaMinutes - right.etaMinutes)
      .slice(0, 2);

    const minBusEta = candidateBuses[0]?.etaMinutes ?? null;
    const slackMinutes =
      nextDepartureMinute !== null && minBusEta !== null
        ? nextDepartureMinute - input.nowMinutes - minBusEta
        : null;
    const status = modeledTouchpointStatus(slackMinutes);
    const ferryVehicle: InterchangeVehicle = {
      id: `touchpoint-ferry-${config.id}`,
      label: `${config.label} departure`,
      kind: "ferry",
      status:
        nextDepartureMinute !== null && nextDepartureMinute - input.nowMinutes <= 10
          ? "boarding"
          : "docked",
      etaMinutes:
        nextDepartureMinute !== null ? nextDepartureMinute - input.nowMinutes : null,
      scheduledAt:
        nextDepartureMinute !== null
          ? minutesToBangkokIso(nextDepartureMinute)
          : null,
      routeLabel: config.destinationLabel,
      lat: config.center[1],
      lng: config.center[0],
      updatedAt: input.maritime.generatedAt,
    };

    const busVehicles: InterchangeVehicle[] = candidateBuses.map(({ bus, etaMinutes }) => ({
      id: `touchpoint-bus-${config.id}-${bus.id}`,
      label: bus.licensePlate,
      kind: "bus",
      status: etaMinutes <= 3 ? "holding" : "approaching",
      etaMinutes,
      scheduledAt: null,
      routeLabel: bus.routeId,
      lat: bus.lat,
      lng: bus.lng,
      updatedAt: bus.updatedAt,
    }));

    return {
      id: config.id,
      label: config.label,
      area: config.area,
      status,
      summary:
        slackMinutes !== null && slackMinutes < 8
          ? "Bus lift is arriving too close to the departure window. This touchpoint needs active handoff discipline."
          : slackMinutes !== null && slackMinutes < 18
            ? "This touchpoint is workable, but there is not much slack between buses and boats."
            : "Bus and boat timing are aligned with enough slack to absorb normal delay.",
      nextDepartureAt:
        nextDepartureMinute !== null
          ? minutesToBangkokIso(nextDepartureMinute)
          : null,
      transferSlackMinutes: slackMinutes,
      demandRate,
      supplyRate,
      unit: "pax/hour",
      vehicles: [...busVehicles, ferryVehicle],
      sourceSummary: {
        label: config.label,
        mode: deriveOverallMode([input.busesSource.mode, input.maritime.mode]),
        sources: [...input.busesSource.sources, ...input.maritime.sourceSummary.sources],
        note: "Touchpoint timing combines live-or-modeled buses with the ferry departure clock.",
      },
      updatedAt: new Date().toISOString(),
    };
  });
}

function buildActions(input: {
  airportDemand: DemandSupplySnapshot;
  cityTransferSupply: DemandSupplySnapshot;
  traffic: OperationsConstraint;
  weatherStatus: OperationsDashboardResponse["weatherConstraint"]["status"];
  touchpoints: InterchangeTouchpoint[];
  scenario: GovernorScenarioId;
}) {
  const actions = [
    input.cityTransferSupply.gapRate > 0
      ? "Stage extra transfer lift between the airport corridor and Phuket Town before the next arrival bank compresses."
      : "Keep airport transfer dispatch steady and avoid overreacting while the current bank remains manageable.",
    input.traffic.status !== "stable"
      ? "Keep Patong Hill and airport access in the active road watch until the transfer gap narrows."
      : "Use the open road picture to push passengers out of the airport corridor early.",
    input.weatherStatus !== "stable"
      ? "Hold pier messaging tight and keep boarding windows matched to the weather picture."
      : "Keep the pier clock synced to bus arrival timing so the handoff stays clean on the operator wall.",
  ];

  if (input.scenario === "tourism-surge-weekend") {
    actions.unshift(
      "Treat the airport bank as a tourism surge: pre-stage buses early and keep pier loading teams ahead of queue formation.",
    );
  }

  if (input.scenario === "red-monsoon-day") {
    actions.unshift(
      "Run the monsoon drill hard: shorten boarding windows, hold unsafe departures, and keep transfer messaging brutally clear.",
    );
  }

  if (input.touchpoints.some((touchpoint) => touchpoint.status === "intervene")) {
    actions.unshift(
      "Treat the lead pier touchpoint as time-critical: board early, tighten queue control, and keep buses moving into the gate.",
    );
  }

  return actions.slice(0, 4);
}

function applyAirportScenario(
  snapshot: DemandSupplySnapshot,
  scenario: GovernorScenarioId,
): DemandSupplySnapshot {
  if (scenario === "live") {
    return snapshot;
  }

  const demandMultiplier =
    scenario === "tourism-surge-weekend"
      ? 1.24
      : scenario === "red-monsoon-day"
        ? 0.9
        : 0.95;
  const demandRate = Math.round(snapshot.demandRate * demandMultiplier);
  const status =
    scenario === "tourism-surge-weekend"
      ? demandRate >= 1200
        ? "intervene"
        : "watch"
      : scenario === "red-monsoon-day"
        ? "watch"
        : snapshot.status;

  return {
    ...snapshot,
    demandRate,
    gapRate: demandRate,
    status,
    summary:
      scenario === "tourism-surge-weekend"
        ? "Weekend arrival banks are running hotter than the base day and are compressing the city transfer window."
        : scenario === "red-monsoon-day"
          ? "Arrival demand is softer than a peak tourism day, but delay drag is still pushing pressure into the ground operation."
          : "Recovery-mode arrivals are rebuilding without returning to full tourism pressure yet.",
  };
}

function applyCityTransferScenario(
  snapshot: DemandSupplySnapshot,
  scenario: GovernorScenarioId,
): DemandSupplySnapshot {
  if (scenario === "live") {
    return snapshot;
  }

  const supplyMultiplier =
    scenario === "tourism-surge-weekend"
      ? 1.08
      : scenario === "red-monsoon-day"
        ? 0.78
        : 0.92;
  const supplyRate = Math.round(snapshot.supplyRate * supplyMultiplier);
  const gapRate = snapshot.demandRate - supplyRate;
  const status =
    gapRate > 180 || scenario === "red-monsoon-day"
      ? "intervene"
      : gapRate > 0
        ? "watch"
        : "stable";

  return {
    ...snapshot,
    supplyRate,
    gapRate,
    status,
    summary:
      scenario === "tourism-surge-weekend"
        ? "Extra lift is on the street, but arrival demand is still leaning hard on the airport and pier corridors."
        : scenario === "red-monsoon-day"
          ? "Road weather and slower dispatch are cutting into bus lift, so the airport-to-city handoff is fragile."
          : "Transfer lift is recovering, but there is still not much spare capacity to waste.",
  };
}

function scenarioTrafficEventCount(baseCount: number, scenario: GovernorScenarioId) {
  if (scenario === "tourism-surge-weekend") {
    return baseCount + 1;
  }

  if (scenario === "red-monsoon-day") {
    return baseCount + 3;
  }

  if (scenario === "stable-recovery-day") {
    return Math.max(baseCount, 1);
  }

  return baseCount;
}

function applyTouchpointScenario(
  touchpoints: InterchangeTouchpoint[],
  scenario: GovernorScenarioId,
): InterchangeTouchpoint[] {
  if (scenario === "live") {
    return touchpoints;
  }

  return touchpoints.map((touchpoint) => {
    const demandMultiplier =
      scenario === "tourism-surge-weekend"
        ? 1.18
        : scenario === "red-monsoon-day"
          ? 0.94
          : 0.96;
    const supplyMultiplier =
      scenario === "tourism-surge-weekend"
        ? 1.04
        : scenario === "red-monsoon-day"
          ? 0.82
          : 0.92;
    const slackOffset =
      scenario === "tourism-surge-weekend"
        ? -4
        : scenario === "red-monsoon-day"
          ? -10
          : 3;
    const transferSlackMinutes =
      touchpoint.transferSlackMinutes === null
        ? null
        : touchpoint.transferSlackMinutes + slackOffset;
    const demandRate = Math.round(touchpoint.demandRate * demandMultiplier);
    const supplyRate = Math.round(touchpoint.supplyRate * supplyMultiplier);

    return {
      ...touchpoint,
      demandRate,
      supplyRate,
      transferSlackMinutes,
      status: modeledTouchpointStatus(transferSlackMinutes),
      summary:
        scenario === "tourism-surge-weekend"
          ? "Passenger lift is heavy and the bus-to-boat join needs queue discipline before the next departure wave."
          : scenario === "red-monsoon-day"
            ? "Weather drag is collapsing the handoff window. This pier needs active control on buses, boarding, and departures."
            : "The touchpoint is recovering and has started to rebuild operating slack.",
    };
  });
}

export async function loadOperationsDashboard(options?: {
  scenario?: GovernorScenarioId | null;
}): Promise<OperationsDashboardResponse> {
  const scenario = options?.scenario ?? "live";
  const scenarioTraffic = {
    generatedAt: new Date().toISOString(),
    provider: "Longdo/ITIC",
    status: "scenario",
    events: [],
  };
  const [arrivals, buses, traffic, rainfall, marine, maritime] = await Promise.all([
    loadFlightArrivals({ scenario }),
    loadPksbBusPositions({ scenario }),
    scenario === "live" ? loadTrafficFeed() : Promise.resolve(scenarioTraffic),
    loadRainfallPoints(),
    loadMarineStatus({ scenario }),
    loadMaritimeSecurity({ scenario }),
  ]);
  const weather = await loadOperationalWeather({ rainfall, marine, scenario });
  const nowMinutes = currentBangkokMinuteOfDay();
  const airportDemand = applyAirportScenario(
    buildAirportDemandSnapshot({ arrivals, nowMinutes }),
    scenario,
  );
  const cityTransferSupply = applyCityTransferScenario(buildCityTransferSnapshot({
    airportDemand,
    buses,
    trafficEventCount: scenarioTrafficEventCount(traffic.events.length, scenario),
  }), scenario);
  const effectiveTrafficEvents = scenarioTrafficEventCount(traffic.events.length, scenario);
  const trafficFriction = buildTrafficConstraint({
    eventCount: effectiveTrafficEvents,
    transferGap: cityTransferSupply.gapRate,
  });
  const marineConstraint = buildMarineConstraint({ marine, maritime });
  const touchpoints = applyTouchpointScenario(buildTouchpoints({
    nowMinutes,
    airportDemand,
    buses: buses.buses,
    busesSource: buses.sourceSummary,
    maritime,
  }), scenario);
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    mode:
      scenario === "live"
        ? deriveOverallMode([
            arrivals.mode,
            buses.mode,
            weather.mode,
            maritime.mode,
          ])
        : "modeled",
    airportDemand,
    cityTransferSupply,
    trafficFriction,
    weatherConstraint: weather,
    marineConstraint,
    touchpoints,
    actions: buildActions({
      airportDemand,
      cityTransferSupply,
      traffic: trafficFriction,
      weatherStatus: weather.status,
      touchpoints,
      scenario,
    }),
    sources: Array.from(
      new Set([
        ...arrivals.sourceSummary.sources,
        ...buses.sourceSummary.sources,
        ...weather.sourceSummary.sources,
        ...maritime.sourceSummary.sources,
        traffic.provider,
      ]),
    ),
    freshness:
      scenario === "live"
        ? summarizeFreshness(
            [
              arrivals.sourceSummary.freshness,
              buses.freshness,
              weather.freshness,
              maritime.freshness,
            ].filter(Boolean),
            generatedAt,
          )
        : buildFreshness({
            checkedAt: generatedAt,
            observedAt: generatedAt,
            fallbackTier: "scenario",
            sourceIds: [`${scenario} operations drill`],
          }),
  };
}

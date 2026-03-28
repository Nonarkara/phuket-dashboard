import { simulateBusPositions } from "./pksb-simulation";
import { buildFreshness } from "./freshness";
import type {
  FeedMode,
  GovernorScenarioId,
  PksbBusPosition,
  PksbBusPositionResponse,
  SourceSummary,
} from "../types/dashboard";

const PKSB_API = process.env.PKSB_API_URL ?? "http://localhost:3099";

interface SmartBusVehicle {
  id: string;
  routeId: string;
  licensePlate: string;
  vehicleId: string;
  coordinates: [number, number];
  heading: number;
  speedKph: number;
  status: "moving" | "dwelling" | "unknown";
  updatedAt: string;
}

interface SmartBusAllResponse {
  vehicles: SmartBusVehicle[];
  updatedAt: string;
}

function buildSourceSummary(
  mode: FeedMode,
  generatedAt: string,
  scenario: GovernorScenarioId,
): SourceSummary {
  const freshness = buildFreshness({
    checkedAt: generatedAt,
    observedAt: generatedAt,
    fallbackTier: mode === "live" ? "live" : "scenario",
    sourceIds:
      mode === "live"
        ? ["PKSB live API"]
        : scenario === "live"
          ? ["PKSB modeled service"]
          : ["PKSB scenario model"],
  });

  return {
    label:
      mode === "live"
        ? "PKSB live vehicle feed"
        : scenario === "live"
          ? "PKSB modeled service clock"
          : "PKSB scenario service clock",
    mode,
    sources:
      mode === "live"
        ? ["PKSB live API", "Smart Bus vehicle tracker"]
        : scenario === "live"
          ? ["PKSB modeled service", "Public timetable fallback"]
          : ["PKSB scenario model", "Public timetable fallback"],
    note:
      mode === "live"
        ? "Vehicle locations are coming from the PKSB live feed."
        : scenario === "live"
          ? "PKSB live API is unavailable, so bus motion is running on the timetable model."
          : "Bus motion is running on the scenario clock so the transfer drill stays deterministic.",
    freshness,
  };
}

function normalizeLiveBuses(vehicles: SmartBusVehicle[]): PksbBusPosition[] {
  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    routeId: vehicle.routeId,
    licensePlate: vehicle.licensePlate,
    vehicleId: vehicle.vehicleId,
    lng: vehicle.coordinates[1],
    lat: vehicle.coordinates[0],
    heading: vehicle.heading,
    speedKph: vehicle.speedKph,
    status: vehicle.status,
    updatedAt: vehicle.updatedAt,
  }));
}

function applyBusScenario(
  buses: PksbBusPosition[],
  scenario: GovernorScenarioId,
) {
  if (scenario === "live") {
    return buses;
  }

  if (scenario === "tourism-surge-weekend") {
    const base = buses.map((bus) => ({
      ...bus,
      speedKph: bus.status === "moving" ? Math.max(bus.speedKph + 4, 18) : bus.speedKph,
    }));
    const extraBuses = base.slice(0, 2).map((bus, index) => ({
      ...bus,
      id: `${bus.id}-surge-${index}`,
      vehicleId: `${bus.vehicleId}-SURGE-${index + 1}`,
      licensePlate: `${bus.licensePlate}S${index + 1}`,
      lat: bus.lat + 0.006 * (index + 1),
      lng: bus.lng + 0.004 * (index === 0 ? 1 : -1),
      updatedAt: new Date().toISOString(),
    }));
    return [...base, ...extraBuses];
  }

  if (scenario === "red-monsoon-day") {
    return buses.map((bus, index) => ({
      ...bus,
      status: index % 3 === 0 ? "unknown" : bus.status,
      speedKph: index % 3 === 0 ? 0 : Math.max(8, bus.speedKph - 6),
    }));
  }

  return buses.map((bus) => ({
    ...bus,
    speedKph: bus.status === "moving" ? Math.max(12, bus.speedKph - 2) : bus.speedKph,
  }));
}

export async function loadPksbBusPositions(options?: {
  scenario?: GovernorScenarioId | null;
}): Promise<PksbBusPositionResponse> {
  let buses: PksbBusPosition[];
  let mode: FeedMode = "modeled";
  let observedAt: string | null = null;
  const scenario = options?.scenario ?? "live";

  if (scenario === "live") {
    try {
      const response = await fetch(`${PKSB_API}/api/vehicles/all`, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });

      if (response.ok) {
        const payload = (await response.json()) as SmartBusAllResponse;
        buses = normalizeLiveBuses(payload.vehicles ?? []);
        mode = buses.length > 0 ? "live" : "modeled";
        observedAt = payload.updatedAt ?? payload.vehicles?.[0]?.updatedAt ?? null;
      } else {
        buses = simulateBusPositions();
      }
    } catch {
      buses = simulateBusPositions();
    }
  } else {
    buses = simulateBusPositions();
  }

  if (mode !== "live") {
    buses = simulateBusPositions();
  }

  buses = applyBusScenario(buses, scenario);

  const generatedAt = new Date().toISOString();
  const sourceSummary = buildSourceSummary(mode, generatedAt, scenario);

  return {
    generatedAt,
    buses,
    mode,
    sourceSummary,
    freshness: buildFreshness({
      checkedAt: generatedAt,
      observedAt: observedAt ?? generatedAt,
      fallbackTier: mode === "live" ? "live" : "scenario",
      sourceIds: sourceSummary.sources,
    }),
  };
}

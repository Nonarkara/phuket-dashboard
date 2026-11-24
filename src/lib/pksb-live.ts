import { simulateBusPositions } from "./pksb-simulation";
import { buildFreshness } from "./freshness";
import { recordSourceHealth } from "./source-health";
import type {
  FeedMode,
  GovernorScenarioId,
  PksbBusPosition,
  PksbBusPositionResponse,
  SourceSummary,
} from "../types/dashboard";

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
  vehicles?: SmartBusVehicle[];
  updatedAt?: string;
}

function buildSourceSummary(
  mode: FeedMode,
  generatedAt: string,
  observedAt: string | null,
  scenario: GovernorScenarioId,
): SourceSummary {
  const fallbackTier =
    mode === "live"
      ? "live"
      : mode === "degraded"
        ? "unavailable"
        : "scenario";
  const freshness = buildFreshness({
    checkedAt: generatedAt,
    observedAt: mode === "degraded" ? null : observedAt ?? generatedAt,
    fallbackTier,
    sourceIds:
      mode === "live"
        ? ["PKSB live API"]
        : mode === "degraded"
          ? ["PKSB live API"]
          : ["PKSB scenario model"],
  });

  return {
    label:
      mode === "live"
        ? "PKSB live vehicle feed"
        : mode === "degraded"
          ? "PKSB live vehicle feed"
          : "PKSB scenario service clock (example)",
    mode,
    sources:
      mode === "live"
        ? ["PKSB live API", "Smart Bus vehicle tracker"]
        : mode === "degraded"
          ? ["PKSB live API"]
          : ["PKSB scenario model", "Public timetable example"],
    note:
      mode === "live"
        ? "Vehicle locations are coming from the PKSB live feed."
        : mode === "degraded"
          ? "No record from Phuket Smart Bus right now."
          : `Bus motion is running on the ${scenario} scenario clock so the transfer drill stays deterministic.`,
    freshness,
  };
}

function normalizeLiveBuses(vehicles: unknown): PksbBusPosition[] {
  if (!Array.isArray(vehicles)) {
    return [];
  }

  return vehicles
    .filter((vehicle): vehicle is SmartBusVehicle => {
      if (!vehicle || typeof vehicle !== "object") return false;
      const coords = (vehicle as SmartBusVehicle).coordinates;
      return (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        typeof coords[0] === "number" &&
        typeof coords[1] === "number" &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1])
      );
    })
    .map((vehicle) => ({
      id: String(vehicle.id ?? vehicle.vehicleId ?? ""),
      routeId: String(vehicle.routeId ?? "unknown"),
      licensePlate: String(vehicle.licensePlate ?? ""),
      vehicleId: String(vehicle.vehicleId ?? ""),
      lng: vehicle.coordinates[1],
      lat: vehicle.coordinates[0],
      heading: typeof vehicle.heading === "number" ? vehicle.heading : 0,
      speedKph: typeof vehicle.speedKph === "number" ? vehicle.speedKph : 0,
      status:
        vehicle.status === "moving" ||
        vehicle.status === "dwelling" ||
        vehicle.status === "unknown"
          ? vehicle.status
          : "unknown",
      updatedAt: vehicle.updatedAt ?? new Date().toISOString(),
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

export function buildUnavailablePksbBusResponse(
  reason = "upstream_unavailable",
): PksbBusPositionResponse {
  const generatedAt = new Date().toISOString();
  const sourceSummary = buildSourceSummary("degraded", generatedAt, null, "live");
  return {
    ok: false,
    reason,
    as_of: null,
    items: [],
    generatedAt,
    buses: [],
    mode: "degraded",
    sourceSummary,
    freshness: sourceSummary.freshness!,
  };
}

export async function loadPksbBusPositions(options?: {
  scenario?: GovernorScenarioId | null;
  apiUrl?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<PksbBusPositionResponse> {
  const scenario = options?.scenario ?? "live";
  const generatedAt = new Date().toISOString();

  // Explicit operator drill scenarios stay deterministic and labeled as modeled example data.
  if (scenario !== "live") {
    const simulated = applyBusScenario(
      simulateBusPositions({ ignoreOperatingHours: true }),
      scenario,
    );
    const sourceSummary = buildSourceSummary("modeled", generatedAt, generatedAt, scenario);
    return {
      ok: true,
      reason: null,
      as_of: generatedAt,
      items: simulated,
      generatedAt,
      buses: simulated,
      mode: "modeled",
      sourceSummary,
      freshness: sourceSummary.freshness!,
    };
  }

  // Live mode: never fabricate buses. Return an honest empty state if upstream is unavailable.
  const apiBase = options?.apiUrl !== undefined ? options.apiUrl : process.env.PKSB_API_URL;
  if (!apiBase) {
    recordSourceHealth("pksb-buses", "unavailable");
    return buildUnavailablePksbBusResponse("upstream_unavailable");
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetchFn(`${apiBase.replace(/\/$/, "")}/api/vehicles/all`, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      recordSourceHealth("pksb-buses", "unavailable");
      return buildUnavailablePksbBusResponse("upstream_unavailable");
    }

    const payload = (await response.json()) as SmartBusAllResponse;
    const buses = normalizeLiveBuses(payload?.vehicles);
    const observedAt = payload?.updatedAt ?? buses[0]?.updatedAt ?? generatedAt;

    recordSourceHealth("pksb-buses", "ok", observedAt);
    const sourceSummary = buildSourceSummary("live", generatedAt, observedAt, "live");
    return {
      ok: true,
      reason: null,
      as_of: observedAt,
      items: buses,
      generatedAt,
      buses,
      mode: "live",
      sourceSummary,
      freshness: sourceSummary.freshness!,
    };
  } catch {
    recordSourceHealth("pksb-buses", "unavailable");
    return buildUnavailablePksbBusResponse("upstream_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

import { buildFreshness } from "./freshness";
import type {
  FeedMode,
  FlightArrival,
  FlightArrivalsResponse,
  GovernorScenarioId,
  SourceSummary,
} from "../types/dashboard";

const AVIATION_STACK_KEY = process.env.AVIATION_STACK_KEY ?? "";
const HKT_IATA = "HKT";

const HKT_ROUTES: Omit<
  FlightArrival,
  "scheduledTime" | "estimatedTime" | "status" | "gate"
>[] = [
  { flightNumber: "MU5037", airline: "China Eastern", airlineCode: "MU", origin: "Shanghai Pudong", originCode: "PVG", originLat: 31.14, originLon: 121.81, country: "China", countryCode: "CN", aircraft: "A320neo", paxEstimate: 180, distance: 3100 },
  { flightNumber: "CZ3041", airline: "China Southern", airlineCode: "CZ", origin: "Guangzhou", originCode: "CAN", originLat: 23.39, originLon: 113.30, country: "China", countryCode: "CN", aircraft: "B737-800", paxEstimate: 170, distance: 2200 },
  { flightNumber: "HU7935", airline: "Hainan Airlines", airlineCode: "HU", origin: "Beijing Capital", originCode: "PEK", originLat: 40.08, originLon: 116.58, country: "China", countryCode: "CN", aircraft: "B787-9", paxEstimate: 250, distance: 3800 },
  { flightNumber: "CA821", airline: "Air China", airlineCode: "CA", origin: "Chengdu", originCode: "CTU", originLat: 30.57, originLon: 103.95, country: "China", countryCode: "CN", aircraft: "A330-200", paxEstimate: 220, distance: 2500 },
  { flightNumber: "SU270", airline: "Aeroflot", airlineCode: "SU", origin: "Moscow SVO", originCode: "SVO", originLat: 55.97, originLon: 37.41, country: "Russia", countryCode: "RU", aircraft: "A330-300", paxEstimate: 290, distance: 7400 },
  { flightNumber: "S72855", airline: "S7 Airlines", airlineCode: "S7", origin: "Novosibirsk", originCode: "OVB", originLat: 55.01, originLon: 82.65, country: "Russia", countryCode: "RU", aircraft: "A320neo", paxEstimate: 180, distance: 5200 },
  { flightNumber: "UT571", airline: "UTair", airlineCode: "UT", origin: "Moscow VKO", originCode: "VKO", originLat: 55.60, originLon: 37.27, country: "Russia", countryCode: "RU", aircraft: "B767-200", paxEstimate: 220, distance: 7350 },
  { flightNumber: "SQ978", airline: "Singapore Airlines", airlineCode: "SQ", origin: "Singapore", originCode: "SIN", originLat: 1.35, originLon: 103.99, country: "Singapore", countryCode: "SG", aircraft: "A350-900", paxEstimate: 300, distance: 940 },
  { flightNumber: "AK882", airline: "AirAsia", airlineCode: "AK", origin: "Kuala Lumpur", originCode: "KUL", originLat: 2.74, originLon: 101.70, country: "Malaysia", countryCode: "MY", aircraft: "A320", paxEstimate: 180, distance: 780 },
  { flightNumber: "VZ304", airline: "Thai VietJet", airlineCode: "VZ", origin: "Ho Chi Minh City", originCode: "SGN", originLat: 10.82, originLon: 106.65, country: "Vietnam", countryCode: "VN", aircraft: "A321", paxEstimate: 200, distance: 1200 },
  { flightNumber: "TG201", airline: "Thai Airways", airlineCode: "TG", origin: "Bangkok BKK", originCode: "BKK", originLat: 13.68, originLon: 100.75, country: "Thailand", countryCode: "TH", aircraft: "A350-900", paxEstimate: 300, distance: 690 },
  { flightNumber: "FD3011", airline: "Thai AirAsia", airlineCode: "FD", origin: "Bangkok DMK", originCode: "DMK", originLat: 13.91, originLon: 100.61, country: "Thailand", countryCode: "TH", aircraft: "A320", paxEstimate: 180, distance: 685 },
  { flightNumber: "DD508", airline: "Nok Air", airlineCode: "DD", origin: "Bangkok DMK", originCode: "DMK", originLat: 13.91, originLon: 100.61, country: "Thailand", countryCode: "TH", aircraft: "B737-800", paxEstimate: 170, distance: 685 },
  { flightNumber: "WE201", airline: "Thai Smile", airlineCode: "WE", origin: "Bangkok BKK", originCode: "BKK", originLat: 13.68, originLon: 100.75, country: "Thailand", countryCode: "TH", aircraft: "A320", paxEstimate: 180, distance: 690 },
  { flightNumber: "6E1045", airline: "IndiGo", airlineCode: "6E", origin: "Mumbai", originCode: "BOM", originLat: 19.09, originLon: 72.87, country: "India", countryCode: "IN", aircraft: "A321neo", paxEstimate: 220, distance: 3100 },
  { flightNumber: "AI983", airline: "Air India", airlineCode: "AI", origin: "Delhi", originCode: "DEL", originLat: 28.56, originLon: 77.10, country: "India", countryCode: "IN", aircraft: "B787-8", paxEstimate: 250, distance: 3400 },
  { flightNumber: "EK378", airline: "Emirates", airlineCode: "EK", origin: "Dubai", originCode: "DXB", originLat: 25.25, originLon: 55.36, country: "UAE", countryCode: "AE", aircraft: "B777-300ER", paxEstimate: 350, distance: 5300 },
  { flightNumber: "QR836", airline: "Qatar Airways", airlineCode: "QR", origin: "Doha", originCode: "DOH", originLat: 25.26, originLon: 51.57, country: "Qatar", countryCode: "QA", aircraft: "A350-900", paxEstimate: 300, distance: 5400 },
  { flightNumber: "LH772", airline: "Lufthansa", airlineCode: "LH", origin: "Frankfurt", originCode: "FRA", originLat: 50.03, originLon: 8.57, country: "Germany", countryCode: "DE", aircraft: "A350-900", paxEstimate: 290, distance: 9200 },
  { flightNumber: "BA33", airline: "British Airways", airlineCode: "BA", origin: "London Heathrow", originCode: "LHR", originLat: 51.47, originLon: -0.46, country: "UK", countryCode: "GB", aircraft: "B787-9", paxEstimate: 250, distance: 9700 },
  { flightNumber: "KE637", airline: "Korean Air", airlineCode: "KE", origin: "Seoul Incheon", originCode: "ICN", originLat: 37.46, originLon: 126.44, country: "South Korea", countryCode: "KR", aircraft: "A330-300", paxEstimate: 270, distance: 3700 },
  { flightNumber: "TG661", airline: "Thai Airways", airlineCode: "TG", origin: "Tokyo Narita", originCode: "NRT", originLat: 35.77, originLon: 140.39, country: "Japan", countryCode: "JP", aircraft: "B787-8", paxEstimate: 240, distance: 4800 },
  { flightNumber: "JQ27", airline: "Jetstar", airlineCode: "JQ", origin: "Sydney", originCode: "SYD", originLat: -33.95, originLon: 151.18, country: "Australia", countryCode: "AU", aircraft: "B787-8", paxEstimate: 300, distance: 7500 },
  { flightNumber: "KC931", airline: "Air Astana", airlineCode: "KC", origin: "Almaty", originCode: "ALA", originLat: 43.35, originLon: 77.04, country: "Kazakhstan", countryCode: "KZ", aircraft: "A321neo", paxEstimate: 200, distance: 5100 },
];

interface AviationStackFlight {
  arrival?: Record<string, unknown>;
  departure?: Record<string, unknown>;
  airline?: Record<string, unknown>;
  flight?: Record<string, unknown>;
  flight_status?: string;
}

function buildSourceSummary(
  mode: FeedMode,
  source: FlightArrivalsResponse["source"],
  generatedAt: string,
): SourceSummary {
  const freshness = buildFreshness({
    checkedAt: generatedAt,
    observedAt: generatedAt,
    fallbackTier: source === "live" ? "live" : "scenario",
    sourceIds: source === "live" ? ["AviationStack"] : ["Modeled HKT schedule"],
  });

  return {
    label: source === "live" ? "AviationStack arrivals" : "Modeled HKT arrival banks",
    mode,
    sources:
      source === "live"
        ? ["AviationStack", "Phuket flight arrival feed"]
        : ["Modeled HKT schedule", "Operator fallback schedule"],
    note:
      source === "live"
        ? "Live arrival board is active."
        : "Live arrival provider is unavailable, so the board is running on a deterministic HKT schedule model.",
    freshness,
  };
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function currentBangkokMinuteOfDay() {
  const now = new Date();
  const bangkokOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + bangkokOffset + 24 * 60) % (24 * 60);
}

function generateDailySchedule(): FlightArrival[] {
  const currentMinutes = currentBangkokMinuteOfDay();
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const seed = dayOfYear;
  const gates = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2"];

  const arrivals = HKT_ROUTES.map((route, index) => {
    const opStartMin = 6 * 60;
    const opEndMin = 24 * 60 + 30;
    const opRange = opEndMin - opStartMin;
    const slotMin = opStartMin + Math.round((index / HKT_ROUTES.length) * opRange);
    const jitter = ((seed * 7 + index * 13) % 31) - 15;
    const scheduledMin = Math.max(opStartMin, Math.min(opEndMin, slotMin + jitter));
    const delayMin =
      ((seed * 7 + index * 13) % 20) < 14 ? 0 : ((seed * 3 + index * 7) % 15) + 5;
    const estimatedMin = scheduledMin + delayMin;

    let status: FlightArrival["status"];
    if (scheduledMin + 30 < currentMinutes) {
      status = "landed";
    } else if (Math.abs(scheduledMin - currentMinutes) <= 30) {
      status = "en-route";
    } else if (scheduledMin <= currentMinutes + 90 && scheduledMin > currentMinutes) {
      status = delayMin > 0 ? "delayed" : "on-time";
    } else {
      status = "scheduled";
    }

    return {
      ...route,
      scheduledTime: formatTime(scheduledMin),
      estimatedTime: formatTime(estimatedMin),
      status,
      gate: gates[(index + seed) % gates.length],
      terminal: index < 4 ? "Domestic" : "International",
    };
  });

  return arrivals.sort((left, right) => {
    const statusOrder = { "en-route": 0, "on-time": 1, delayed: 2, scheduled: 3, landed: 4 };
    const leftOrder = statusOrder[left.status] ?? 5;
    const rightOrder = statusOrder[right.status] ?? 5;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.scheduledTime.localeCompare(right.scheduledTime);
  });
}

function applyArrivalScenario(
  arrivals: FlightArrival[],
  scenario: GovernorScenarioId,
): FlightArrival[] {
  if (scenario === "live") {
    return arrivals;
  }

  return arrivals.map((arrival, index) => {
    if (scenario === "tourism-surge-weekend") {
      const baseDelay = arrival.status === "landed" ? 0 : index % 5 === 0 ? 12 : 0;
      const status: FlightArrival["status"] =
        arrival.status === "landed"
          ? "landed"
          : baseDelay > 0
            ? "delayed"
            : arrival.status;
      return {
        ...arrival,
        paxEstimate: Math.round(arrival.paxEstimate * 1.24),
        estimatedTime:
          arrival.status === "landed"
            ? arrival.estimatedTime
            : formatTime(
                (parseInt(arrival.estimatedTime.slice(0, 2), 10) * 60 +
                  parseInt(arrival.estimatedTime.slice(3, 5), 10) +
                  baseDelay) %
                  (24 * 60),
              ),
        status,
      };
    }

    if (scenario === "red-monsoon-day") {
      const forcedDelay = arrival.status === "landed" ? 0 : 18 + (index % 3) * 6;
      const status: FlightArrival["status"] =
        arrival.status === "landed" ? "landed" : "delayed";
      return {
        ...arrival,
        paxEstimate: Math.round(arrival.paxEstimate * 0.86),
        estimatedTime:
          arrival.status === "landed"
            ? arrival.estimatedTime
            : formatTime(
                (parseInt(arrival.scheduledTime.slice(0, 2), 10) * 60 +
                  parseInt(arrival.scheduledTime.slice(3, 5), 10) +
                  forcedDelay) %
                  (24 * 60),
              ),
        status,
      };
    }

    return {
      ...arrival,
      paxEstimate: Math.round(arrival.paxEstimate * 0.94),
    };
  });
}

function normalizeLiveFlight(payload: AviationStackFlight): FlightArrival {
  const arrival = payload.arrival ?? {};
  const departure = payload.departure ?? {};
  const airline = payload.airline ?? {};
  const flight = payload.flight ?? {};

  return {
    flightNumber: String(flight.iata ?? flight.icao ?? ""),
    airline: String(airline.name ?? ""),
    airlineCode: String(airline.iata ?? ""),
    origin: String(departure.airport ?? ""),
    originCode: String(departure.iata ?? ""),
    originLat: 0,
    originLon: 0,
    scheduledTime: String(arrival.scheduled ?? "").slice(11, 16),
    estimatedTime: String(arrival.estimated ?? arrival.scheduled ?? "").slice(11, 16),
    status: String(payload.flight_status ?? "scheduled") as FlightArrival["status"],
    gate: String(arrival.gate ?? ""),
    terminal: String(arrival.terminal ?? ""),
    country: "",
    countryCode: "",
    paxEstimate: 200,
    distance: 0,
  };
}

export async function loadFlightArrivals(options?: {
  scenario?: GovernorScenarioId | null;
}): Promise<FlightArrivalsResponse> {
  let arrivals: FlightArrival[];
  let source: FlightArrivalsResponse["source"] = "simulation";
  const scenario = options?.scenario ?? "live";

  if (scenario === "live" && AVIATION_STACK_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_STACK_KEY}&arr_iata=${HKT_IATA}&flight_status=active,scheduled,landed&limit=30`;
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as { data?: AviationStackFlight[] };
        if (Array.isArray(data.data) && data.data.length > 0) {
          arrivals = data.data.map(normalizeLiveFlight);
          source = "live";
        } else {
          arrivals = generateDailySchedule();
        }
      } else {
        arrivals = generateDailySchedule();
      }
    } catch {
      arrivals = generateDailySchedule();
    }
  } else {
    arrivals = generateDailySchedule();
  }

  arrivals = applyArrivalScenario(arrivals, scenario);

  const generatedAt = new Date().toISOString();
  const byCountry: Record<string, number> = {};
  for (const arrival of arrivals) {
    const key = arrival.country || arrival.countryCode || "Unknown";
    byCountry[key] = (byCountry[key] ?? 0) + 1;
  }

  const mode: FeedMode = source === "live" && scenario === "live" ? "live" : "modeled";

  return {
    airport: "Phuket International Airport",
    iata: HKT_IATA,
    timezone: "Asia/Bangkok",
    generatedAt,
    totalFlights: arrivals.length,
    arrivals,
    byCountry,
    mode,
    source,
    sourceSummary: buildSourceSummary(mode, source, generatedAt),
  };
}

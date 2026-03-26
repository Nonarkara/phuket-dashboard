import { NextResponse } from "next/server";

/**
 * Phuket Airport (HKT) Flight Arrivals
 *
 * Uses AviationStack API (free tier: 100 requests/month) as primary,
 * with a rich simulation fallback based on real HKT flight schedules.
 * The simulation uses actual airline routes, flight numbers, and realistic
 * timing to show what the governor would see on a typical day.
 */

const AVIATION_STACK_KEY = process.env.AVIATION_STACK_KEY ?? "";
const HKT_IATA = "HKT";

interface FlightArrival {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCode: string;
  originLat: number;
  originLon: number;
  scheduledTime: string;    // HH:MM local
  estimatedTime: string;    // HH:MM local
  status: "landed" | "on-time" | "delayed" | "en-route" | "scheduled";
  gate?: string;
  terminal?: string;
  aircraft?: string;
  paxEstimate: number;      // estimated passengers
  country: string;
  countryCode: string;
  distance: number;         // km from origin
}

interface ArrivalsResponse {
  airport: string;
  iata: string;
  timezone: string;
  generatedAt: string;
  totalFlights: number;
  arrivals: FlightArrival[];
  byCountry: Record<string, number>;
  source: "live" | "simulation";
}

// ─── Real HKT routes with coordinates ────────────────────────────

const HKT_ROUTES: Omit<FlightArrival, "scheduledTime" | "estimatedTime" | "status" | "gate">[] = [
  // China
  { flightNumber: "MU5037", airline: "China Eastern", airlineCode: "MU", origin: "Shanghai Pudong", originCode: "PVG", originLat: 31.14, originLon: 121.81, country: "China", countryCode: "CN", aircraft: "A320neo", paxEstimate: 180, distance: 3100 },
  { flightNumber: "CZ3041", airline: "China Southern", airlineCode: "CZ", origin: "Guangzhou", originCode: "CAN", originLat: 23.39, originLon: 113.30, country: "China", countryCode: "CN", aircraft: "B737-800", paxEstimate: 170, distance: 2200 },
  { flightNumber: "HU7935", airline: "Hainan Airlines", airlineCode: "HU", origin: "Beijing Capital", originCode: "PEK", originLat: 40.08, originLon: 116.58, country: "China", countryCode: "CN", aircraft: "B787-9", paxEstimate: 250, distance: 3800 },
  { flightNumber: "CA821", airline: "Air China", airlineCode: "CA", origin: "Chengdu", originCode: "CTU", originLat: 30.57, originLon: 103.95, country: "China", countryCode: "CN", aircraft: "A330-200", paxEstimate: 220, distance: 2500 },
  // Russia
  { flightNumber: "SU270", airline: "Aeroflot", airlineCode: "SU", origin: "Moscow SVO", originCode: "SVO", originLat: 55.97, originLon: 37.41, country: "Russia", countryCode: "RU", aircraft: "A330-300", paxEstimate: 290, distance: 7400 },
  { flightNumber: "S72855", airline: "S7 Airlines", airlineCode: "S7", origin: "Novosibirsk", originCode: "OVB", originLat: 55.01, originLon: 82.65, country: "Russia", countryCode: "RU", aircraft: "A320neo", paxEstimate: 180, distance: 5200 },
  { flightNumber: "UT571", airline: "UTair", airlineCode: "UT", origin: "Moscow VKO", originCode: "VKO", originLat: 55.60, originLon: 37.27, country: "Russia", countryCode: "RU", aircraft: "B767-200", paxEstimate: 220, distance: 7350 },
  // Southeast Asia
  { flightNumber: "SQ978", airline: "Singapore Airlines", airlineCode: "SQ", origin: "Singapore", originCode: "SIN", originLat: 1.35, originLon: 103.99, country: "Singapore", countryCode: "SG", aircraft: "A350-900", paxEstimate: 300, distance: 940 },
  { flightNumber: "AK882", airline: "AirAsia", airlineCode: "AK", origin: "Kuala Lumpur", originCode: "KUL", originLat: 2.74, originLon: 101.70, country: "Malaysia", countryCode: "MY", aircraft: "A320", paxEstimate: 180, distance: 780 },
  { flightNumber: "VZ304", airline: "Thai VietJet", airlineCode: "VZ", origin: "Ho Chi Minh City", originCode: "SGN", originLat: 10.82, originLon: 106.65, country: "Vietnam", countryCode: "VN", aircraft: "A321", paxEstimate: 200, distance: 1200 },
  // Domestic Thailand
  { flightNumber: "TG201", airline: "Thai Airways", airlineCode: "TG", origin: "Bangkok BKK", originCode: "BKK", originLat: 13.68, originLon: 100.75, country: "Thailand", countryCode: "TH", aircraft: "A350-900", paxEstimate: 300, distance: 690 },
  { flightNumber: "FD3011", airline: "Thai AirAsia", airlineCode: "FD", origin: "Bangkok DMK", originCode: "DMK", originLat: 13.91, originLon: 100.61, country: "Thailand", countryCode: "TH", aircraft: "A320", paxEstimate: 180, distance: 685 },
  { flightNumber: "DD508", airline: "Nok Air", airlineCode: "DD", origin: "Bangkok DMK", originCode: "DMK", originLat: 13.91, originLon: 100.61, country: "Thailand", countryCode: "TH", aircraft: "B737-800", paxEstimate: 170, distance: 685 },
  { flightNumber: "WE201", airline: "Thai Smile", airlineCode: "WE", origin: "Bangkok BKK", originCode: "BKK", originLat: 13.68, originLon: 100.75, country: "Thailand", countryCode: "TH", aircraft: "A320", paxEstimate: 180, distance: 690 },
  // India
  { flightNumber: "6E1045", airline: "IndiGo", airlineCode: "6E", origin: "Mumbai", originCode: "BOM", originLat: 19.09, originLon: 72.87, country: "India", countryCode: "IN", aircraft: "A321neo", paxEstimate: 220, distance: 3100 },
  { flightNumber: "AI983", airline: "Air India", airlineCode: "AI", origin: "Delhi", originCode: "DEL", originLat: 28.56, originLon: 77.10, country: "India", countryCode: "IN", aircraft: "B787-8", paxEstimate: 250, distance: 3400 },
  // Middle East
  { flightNumber: "EK378", airline: "Emirates", airlineCode: "EK", origin: "Dubai", originCode: "DXB", originLat: 25.25, originLon: 55.36, country: "UAE", countryCode: "AE", aircraft: "B777-300ER", paxEstimate: 350, distance: 5300 },
  { flightNumber: "QR836", airline: "Qatar Airways", airlineCode: "QR", origin: "Doha", originCode: "DOH", originLat: 25.26, originLon: 51.57, country: "Qatar", countryCode: "QA", aircraft: "A350-900", paxEstimate: 300, distance: 5400 },
  // Europe
  { flightNumber: "LH772", airline: "Lufthansa", airlineCode: "LH", origin: "Frankfurt", originCode: "FRA", originLat: 50.03, originLon: 8.57, country: "Germany", countryCode: "DE", aircraft: "A350-900", paxEstimate: 290, distance: 9200 },
  { flightNumber: "BA33", airline: "British Airways", airlineCode: "BA", origin: "London Heathrow", originCode: "LHR", originLat: 51.47, originLon: -0.46, country: "UK", countryCode: "GB", aircraft: "B787-9", paxEstimate: 250, distance: 9700 },
  // Korea/Japan
  { flightNumber: "KE637", airline: "Korean Air", airlineCode: "KE", origin: "Seoul Incheon", originCode: "ICN", originLat: 37.46, originLon: 126.44, country: "South Korea", countryCode: "KR", aircraft: "A330-300", paxEstimate: 270, distance: 3700 },
  { flightNumber: "TG661", airline: "Thai Airways", airlineCode: "TG", origin: "Tokyo Narita", originCode: "NRT", originLat: 35.77, originLon: 140.39, country: "Japan", countryCode: "JP", aircraft: "B787-8", paxEstimate: 240, distance: 4800 },
  // Australia
  { flightNumber: "JQ27", airline: "Jetstar", airlineCode: "JQ", origin: "Sydney", originCode: "SYD", originLat: -33.95, originLon: 151.18, country: "Australia", countryCode: "AU", aircraft: "B787-8", paxEstimate: 300, distance: 7500 },
  // Kazakhstan (emerging market)
  { flightNumber: "KC931", airline: "Air Astana", airlineCode: "KC", origin: "Almaty", originCode: "ALA", originLat: 43.35, originLon: 77.04, country: "Kazakhstan", countryCode: "KZ", aircraft: "A321neo", paxEstimate: 200, distance: 5100 },
];

function generateDailySchedule(): FlightArrival[] {
  const now = new Date();
  const hourNow = now.getHours();
  const minNow = now.getMinutes();
  const currentMinutes = hourNow * 60 + minNow;

  // Distribute flights across the day (HKT operates roughly 06:00–01:00)
  const timeSlots = [
    6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5,
    11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5,
    16, 17, 18, 19, 20, 21, 22, 23, 0.5,
  ];

  // Use day-of-year as seed for deterministic but daily-changing schedule
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const seed = dayOfYear;

  const arrivals: FlightArrival[] = [];
  const gates = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2"];

  for (let i = 0; i < HKT_ROUTES.length && i < timeSlots.length; i++) {
    const route = HKT_ROUTES[(i + seed) % HKT_ROUTES.length];
    const slotHour = timeSlots[i];
    const hour = Math.floor(slotHour);
    const minute = Math.round((slotHour % 1) * 60);
    const scheduledMin = hour * 60 + minute;

    // Randomish delay (seeded)
    const delayMin = ((seed * 7 + i * 13) % 20) < 14 ? 0 : ((seed * 3 + i * 7) % 15) + 5;
    const estMin = scheduledMin + delayMin;

    let status: FlightArrival["status"];
    if (scheduledMin + 60 < currentMinutes) {
      status = "landed";
    } else if (scheduledMin <= currentMinutes + 30) {
      status = "en-route";
    } else if (delayMin > 0) {
      status = "delayed";
    } else if (scheduledMin <= currentMinutes + 120) {
      status = "on-time";
    } else {
      status = "scheduled";
    }

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    arrivals.push({
      ...route,
      scheduledTime: formatTime(scheduledMin),
      estimatedTime: formatTime(estMin),
      status,
      gate: gates[(i + seed) % gates.length],
      terminal: "International",
    });
  }

  return arrivals.sort((a, b) => {
    const statusOrder = { "en-route": 0, "on-time": 1, delayed: 2, scheduled: 3, landed: 4 };
    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
  });
}

export async function GET() {
  let arrivals: FlightArrival[];
  let source: "live" | "simulation" = "simulation";

  // Try AviationStack if configured
  if (AVIATION_STACK_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_STACK_KEY}&arr_iata=${HKT_IATA}&flight_status=active,scheduled,landed&limit=30`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json() as { data?: Array<Record<string, unknown>> };
        if (data?.data?.length) {
          arrivals = data.data.map((f) => {
            const arr = f.arrival as Record<string, unknown>;
            const dep = f.departure as Record<string, unknown>;
            const al = f.airline as Record<string, unknown>;
            const flt = f.flight as Record<string, unknown>;
            return {
              flightNumber: String(flt?.iata ?? flt?.icao ?? ""),
              airline: String(al?.name ?? ""),
              airlineCode: String(al?.iata ?? ""),
              origin: String(dep?.airport ?? ""),
              originCode: String(dep?.iata ?? ""),
              originLat: 0, originLon: 0,
              scheduledTime: String(arr?.scheduled ?? "").slice(11, 16),
              estimatedTime: String(arr?.estimated ?? arr?.scheduled ?? "").slice(11, 16),
              status: String(f.flight_status) as FlightArrival["status"],
              gate: String(arr?.gate ?? ""),
              terminal: String(arr?.terminal ?? ""),
              country: "",
              countryCode: "",
              paxEstimate: 200,
              distance: 0,
            };
          });
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

  // Count by country
  const byCountry: Record<string, number> = {};
  for (const a of arrivals) {
    const key = a.country || a.countryCode || "Unknown";
    byCountry[key] = (byCountry[key] ?? 0) + 1;
  }

  const response: ArrivalsResponse = {
    airport: "Phuket International Airport",
    iata: HKT_IATA,
    timezone: "Asia/Bangkok",
    generatedAt: new Date().toISOString(),
    totalFlights: arrivals.length,
    arrivals,
    byCountry,
    source,
  };

  return NextResponse.json(response);
}

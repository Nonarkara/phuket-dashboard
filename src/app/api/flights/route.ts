import { NextResponse } from "next/server";
import { cached } from "../../../lib/cache";
import type { FlightData } from "../../../types/dashboard";

const AIRLABS_KEY = process.env.AIRLABS_API_KEY ?? "";
// SE Asia bbox: SW(1°N,92°E) → NE(21.5°N,108°E)
const AIRLABS_URL = `https://airlabs.co/api/v9/flights?api_key=${AIRLABS_KEY}&bbox=1.0,92.0,21.5,108.0`;

// ponytail: free tier = 1000 calls/month — 90s cache ≈ 960 calls/day (upgrade key for tighter refresh)
const CACHE_TTL = 90;

interface AirlabsFlight {
  hex?: string;
  flag?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  dir?: number;
  speed?: number;
  flight_iata?: string;
  flight_icao?: string;
  airline_iata?: string;
  aircraft_icao?: string;
  dep_iata?: string;
  arr_iata?: string;
  status?: string;
}

const FALLBACK: FlightData[] = [
  { icao24: "896101", callsign: "EK378", longitude: 98.240, latitude: 8.040, altitude: 2400, velocity: 240, heading: 75, origin_country: "UAE", on_ground: false, airline_iata: "EK", dep_iata: "DXB", arr_iata: "HKT", aircraft_icao: "B773", flight_status: "en-route" },
  { icao24: "154202", callsign: "SU270", longitude: 98.380, latitude: 8.240, altitude: 4800, velocity: 260, heading: 210, origin_country: "RU", on_ground: false, airline_iata: "SU", dep_iata: "SVO", arr_iata: "HKT", aircraft_icao: "A333", flight_status: "en-route" },
  { icao24: "883100", callsign: "TG201", longitude: 98.330, latitude: 8.160, altitude: 1200, velocity: 180, heading: 255, origin_country: "TH", on_ground: false, airline_iata: "TG", dep_iata: "BKK", arr_iata: "HKT", aircraft_icao: "A359", flight_status: "en-route" },
  { icao24: "765304", callsign: "SQ978", longitude: 98.290, latitude: 7.860, altitude: 3600, velocity: 230, heading: 165, origin_country: "SG", on_ground: false, airline_iata: "SQ", dep_iata: "HKT", arr_iata: "SIN", aircraft_icao: "A359", flight_status: "en-route" },
  { icao24: "883205", callsign: "FD3011", longitude: 98.305, latitude: 8.115, altitude: 450, velocity: 140, heading: 90, origin_country: "TH", on_ground: false, airline_iata: "FD", dep_iata: "DMK", arr_iata: "HKT", aircraft_icao: "A320", flight_status: "en-route" },
  { icao24: "800406", callsign: "6E1045", longitude: 98.080, latitude: 7.950, altitude: 7200, velocity: 270, heading: 95, origin_country: "IN", on_ground: false, airline_iata: "6E", dep_iata: "BOM", arr_iata: "HKT", aircraft_icao: "A21N", flight_status: "en-route" },
  { icao24: "3C6707", callsign: "LH772", longitude: 98.150, latitude: 8.350, altitude: 9100, velocity: 290, heading: 140, origin_country: "DE", on_ground: false, airline_iata: "LH", dep_iata: "FRA", arr_iata: "HKT", aircraft_icao: "A359", flight_status: "en-route" },
];

async function loadFlights(): Promise<FlightData[]> {
  if (!AIRLABS_KEY) return FALLBACK;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(AIRLABS_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) return FALLBACK;

    const payload = (await res.json()) as { response?: AirlabsFlight[] };
    const raw = payload.response ?? [];
    if (!raw.length) return FALLBACK;

    const flights: FlightData[] = raw
      .filter((f) => f.lat != null && f.lng != null && f.status === "en-route")
      .map((f) => ({
        icao24: f.hex ?? "",
        callsign: f.flight_iata ?? f.flight_icao ?? f.hex ?? "",
        longitude: f.lng ?? 0,
        latitude: f.lat ?? 0,
        altitude: f.alt ?? 0,
        velocity: f.speed ?? 0,
        heading: f.dir ?? 0,
        origin_country: f.flag ?? "",
        on_ground: false,
        flight_iata: f.flight_iata,
        airline_iata: f.airline_iata,
        aircraft_icao: f.aircraft_icao,
        dep_iata: f.dep_iata,
        arr_iata: f.arr_iata,
        flight_status: f.status,
      }));

    return flights.length > 0 ? flights : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function GET() {
  const flights = await cached("regional-flights:airlabs", CACHE_TTL, loadFlights);
  return NextResponse.json(flights);
}

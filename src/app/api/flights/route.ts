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
  { icao24: "883100", callsign: "THA601", longitude: 100.747, latitude: 13.690, altitude: 10668, velocity: 882, heading: 340, origin_country: "TH", on_ground: false, airline_iata: "TG", dep_iata: "BKK", arr_iata: "PEK" },
  { icao24: "883101", callsign: "THA215", longitude: 98.930, latitude: 18.770, altitude: 8525, velocity: 756, heading: 180, origin_country: "TH", on_ground: false, airline_iata: "TG", dep_iata: "CNX", arr_iata: "HKT" },
  { icao24: "706402", callsign: "MAS372", longitude: 101.680, latitude: 3.130, altitude: 11277, velocity: 900, heading: 45, origin_country: "MY", on_ground: false, airline_iata: "MH", dep_iata: "KUL", arr_iata: "NRT" },
  { icao24: "706403", callsign: "AXM610", longitude: 100.510, latitude: 6.920, altitude: 9144, velocity: 828, heading: 0, origin_country: "MY", on_ground: false, airline_iata: "D7", dep_iata: "KUL", arr_iata: "HKT" },
  { icao24: "4BB0EF", callsign: "THY61",  longitude: 98.600, latitude: 8.600, altitude: 10992, velocity: 920, heading: 333, origin_country: "TR", on_ground: false, airline_iata: "TK", dep_iata: "KUL", arr_iata: "IST", aircraft_icao: "A359" },
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

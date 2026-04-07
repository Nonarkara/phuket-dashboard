import { NextResponse } from "next/server";
import { cached } from "../../../lib/cache";
import type { FlightData } from "../../../types/dashboard";

// Bounding box covering Thailand, Cambodia, Myanmar, and Malaysia
const BOUNDS = {
  lamin: 1.0,   // Southern Malaysia
  lamax: 21.5,  // Northern Myanmar
  lomin: 92.0,  // Western Myanmar
  lomax: 108.0, // Eastern Cambodia
};

const OPENSKY_URL = `https://opensky-network.org/api/states/all?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;

const fallbackFlights: FlightData[] = [
  { icao24: "883100", callsign: "THA601", longitude: 100.747, latitude: 13.690, altitude: 10668, velocity: 245, heading: 340, origin_country: "Thailand", on_ground: false },
  { icao24: "883101", callsign: "THA215", longitude: 98.930, latitude: 18.770, altitude: 8525, velocity: 210, heading: 180, origin_country: "Thailand", on_ground: false },
  { icao24: "706402", callsign: "MAS372", longitude: 101.680, latitude: 3.130, altitude: 11277, velocity: 250, heading: 45, origin_country: "Malaysia", on_ground: false },
  { icao24: "706403", callsign: "MAS715", longitude: 100.510, latitude: 6.920, altitude: 9144, velocity: 230, heading: 0, origin_country: "Malaysia", on_ground: false },
  { icao24: "740001", callsign: "KHV301", longitude: 104.840, latitude: 11.560, altitude: 7620, velocity: 195, heading: 270, origin_country: "Cambodia", on_ground: false },
  { icao24: "740002", callsign: "KHV505", longitude: 103.860, latitude: 13.360, altitude: 6096, velocity: 180, heading: 150, origin_country: "Cambodia", on_ground: false },
  { icao24: "880101", callsign: "UBA201", longitude: 96.130, latitude: 16.870, altitude: 8230, velocity: 205, heading: 90, origin_country: "Myanmar", on_ground: false },
  { icao24: "880102", callsign: "UBA502", longitude: 96.870, latitude: 21.970, altitude: 10055, velocity: 220, heading: 200, origin_country: "Myanmar", on_ground: false },
  { icao24: "883105", callsign: "THA932", longitude: 99.420, latitude: 9.650, altitude: 9449, velocity: 225, heading: 15, origin_country: "Thailand", on_ground: false },
  { icao24: "883106", callsign: "BKP447", longitude: 100.920, latitude: 12.670, altitude: 5486, velocity: 175, heading: 310, origin_country: "Thailand", on_ground: false },
  { icao24: "706410", callsign: "AXM610", longitude: 103.980, latitude: 1.340, altitude: 4572, velocity: 160, heading: 60, origin_country: "Malaysia", on_ground: false },
  { icao24: "883110", callsign: "NOK123", longitude: 100.750, latitude: 13.920, altitude: 2438, velocity: 140, heading: 210, origin_country: "Thailand", on_ground: false },
];

interface OpenSkyState {
  0: string;     // icao24
  1: string;     // callsign
  2: string;     // origin_country
  3: number;     // time_position
  4: number;     // last_contact
  5: number;     // longitude
  6: number;     // latitude
  7: number;     // baro_altitude
  8: boolean;    // on_ground
  9: number;     // velocity
  10: number;    // true_track (heading)
}

async function loadRegionalFlights(): Promise<FlightData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(OPENSKY_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackFlights;
    }

    const payload = (await response.json()) as { states?: OpenSkyState[] };

    if (!payload.states || payload.states.length === 0) {
      return fallbackFlights;
    }

    const flights: FlightData[] = payload.states
      .filter(
        (state: OpenSkyState) =>
          state[5] !== null &&
          state[6] !== null &&
          !state[8],
      )
      .slice(0, 200)
      .map((state: OpenSkyState) => ({
        icao24: state[0] ?? "",
        callsign: (state[1] ?? "").trim(),
        longitude: state[5],
        latitude: state[6],
        altitude: state[7] ?? 0,
        velocity: state[9] ?? 0,
        heading: state[10] ?? 0,
        origin_country: state[2] ?? "",
        on_ground: !!state[8],
      }));

    return flights.length > 0 ? flights : fallbackFlights;
  } catch {
    return fallbackFlights;
  }
}

export async function GET() {
  const flights = await cached("regional-flights:opensky", 30, loadRegionalFlights);
  return NextResponse.json(flights);
}

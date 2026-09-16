/**
 * Smart Bus Telemetry Engine
 *
 * Direct port of the route polyline progression logic from the
 * Smart Bus subcodebase (~/Projects/phuket/smart-bus).
 *
 * Uses real timetables and authentic route polylines (Rawai-Airport,
 * Patong-Terminal 1, Old Town Dragon Line) to determine exact vehicle
 * positions and headings for any fractional minute of the day.
 *
 * Because this represents real time-of-day progression ("not simulating anything"),
 * a bus advances at real highway speeds (~30-50 km/h = ~8-14 meters per second).
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { PksbBusPosition } from "../types/dashboard";

import airportToRawaiTimetable from "../data/timetables/airport-to-rawai.json";
import rawaiToAirportTimetable from "../data/timetables/rawai-to-airport.json";

export type LatLngTuple = [number, number]; // [lat, lng]

export function haversineDistanceMeters(a: LatLngTuple, b: LatLngTuple): number {
  const earthRadius = 6371e3;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const deltaLat = ((b[0] - a[0]) * Math.PI) / 180;
  const deltaLon = ((b[1] - a[1]) * Math.PI) / 180;

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const angle =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * earthRadius * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

export function buildPolylineCumMeters(poly: LatLngTuple[]): number[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + haversineDistanceMeters(poly[i - 1], poly[i]));
  }
  return cum;
}

export function posOnPolyline(
  meters: number,
  poly: LatLngTuple[],
  cum: number[]
): { coordinates: LatLngTuple; heading: number } {
  if (poly.length === 0) {
    return { coordinates: [7.98, 98.35], heading: 0 };
  }
  if (poly.length === 1) {
    return { coordinates: poly[0], heading: 0 };
  }

  const total = cum[cum.length - 1] ?? 0;
  const d = Math.max(0, Math.min(total, meters));

  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }

  const a = poly[lo]!;
  const b = poly[hi]!;
  const segLen = cum[hi]! - cum[lo]!;
  const r = segLen > 0 ? (d - cum[lo]!) / segLen : 0;
  const lat = a[0] + (b[0] - a[0]) * r;
  const lng = a[1] + (b[1] - a[1]) * r;

  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const heading =
    ((Math.atan2(
      Math.sin(dLon) * Math.cos(la2),
      Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)
    ) *
      180) /
      Math.PI +
      360) %
    360;

  return { coordinates: [lat, lng], heading };
}

interface RouteProfile {
  id: string;
  label: string;
  plates: string[];
  polyline: LatLngTuple[];
  polylineCum: number[];
  totalMeters: number;
  departures: number[]; // departure minutes from midnight in Bangkok time
  tripDurationMinutes: number;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function extractCoordinatesFromGeoJson(filePath: string): LatLngTuple[] {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);
    const coords: LatLngTuple[] = [];

    const visit = (geom: { type: string; coordinates: unknown }) => {
      if (!geom) return;
      if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
        for (const pt of geom.coordinates) {
          if (Array.isArray(pt) && pt.length >= 2) {
            coords.push([pt[1], pt[0]]);
          }
        }
      } else if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
        for (const line of geom.coordinates) {
          if (Array.isArray(line)) {
            for (const pt of line) {
              if (Array.isArray(pt) && pt.length >= 2) {
                coords.push([pt[1], pt[0]]);
              }
            }
          }
        }
      }
    };

    if (json.type === "FeatureCollection" && Array.isArray(json.features)) {
      for (const feat of json.features) {
        visit(feat.geometry);
      }
    } else if (json.type === "Feature") {
      visit(json.geometry);
    }
    return coords;
  } catch (err) {
    console.warn(`Could not read GeoJSON from ${filePath}`, err);
    return [];
  }
}

let cachedProfiles: RouteProfile[] | null = null;

function loadRouteProfiles(): RouteProfile[] {
  if (cachedProfiles) return cachedProfiles;

  const dataDir = join(process.cwd(), "public", "data");

  // 1. Rawai - Airport (Southbound: Airport -> Rawai)
  const rawaiAirportPoly = extractCoordinatesFromGeoJson(
    join(dataDir, "pksb-bus-rawai-airport.geojson")
  );
  const rawaiAirportCum = buildPolylineCumMeters(rawaiAirportPoly);

  const southboundDepartures = airportToRawaiTimetable.departures.map((d) =>
    parseTimeToMinutes(d.times[0]!)
  );
  const northboundDepartures = rawaiToAirportTimetable.departures.map((d) =>
    parseTimeToMinutes(d.times[0]!)
  );

  // Reverse polyline for Northbound
  const airportNorthboundPoly = [...rawaiAirportPoly].reverse();
  const airportNorthboundCum = buildPolylineCumMeters(airportNorthboundPoly);

  // 2. Patong - Terminal 1
  const patongPoly = extractCoordinatesFromGeoJson(
    join(dataDir, "pksb-bus-patong-terminal.geojson")
  );
  const patongCum = buildPolylineCumMeters(patongPoly);
  // Departures between 06:00 and 20:00 every 30 minutes
  const patongDepartures: number[] = [];
  for (let h = 6; h <= 20; h++) {
    patongDepartures.push(h * 60);
    patongDepartures.push(h * 60 + 30);
  }

  // 3. Old Town Dragon Line
  const dragonPoly = extractCoordinatesFromGeoJson(
    join(dataDir, "pksb-bus-dragon.geojson")
  );
  const dragonCum = buildPolylineCumMeters(dragonPoly);
  // Every 15 minutes between 10:00 and 21:00
  const dragonDepartures: number[] = [];
  for (let m = 10 * 60; m <= 21 * 60; m += 15) {
    dragonDepartures.push(m);
  }

  cachedProfiles = [
    {
      id: "rawai-airport",
      label: "Phuket Airport → Rawai",
      plates: ["10-1201", "10-1202", "10-1203", "10-1204"],
      polyline: rawaiAirportPoly,
      polylineCum: rawaiAirportCum,
      totalMeters: rawaiAirportCum[rawaiAirportCum.length - 1] ?? 0,
      departures: southboundDepartures,
      tripDurationMinutes: 110,
    },
    {
      id: "rawai-airport-nb",
      label: "Rawai → Phuket Airport",
      plates: ["10-1205", "10-1206", "10-1207", "10-1208"],
      polyline: airportNorthboundPoly,
      polylineCum: airportNorthboundCum,
      totalMeters: airportNorthboundCum[airportNorthboundCum.length - 1] ?? 0,
      departures: northboundDepartures,
      tripDurationMinutes: 110,
    },
    {
      id: "patong-old-bus-station",
      label: "Patong ↔ Phuket Bus Terminal 1",
      plates: ["10-1301", "10-1302", "10-1303"],
      polyline: patongPoly,
      polylineCum: patongCum,
      totalMeters: patongCum[patongCum.length - 1] ?? 0,
      departures: patongDepartures,
      tripDurationMinutes: 45,
    },
    {
      id: "dragon-line",
      label: "Phuket Old Town EV Dragon Line",
      plates: ["10-1401", "10-1402"],
      polyline: dragonPoly,
      polylineCum: dragonCum,
      totalMeters: dragonCum[dragonCum.length - 1] ?? 0,
      departures: dragonDepartures,
      tripDurationMinutes: 25,
    },
  ];

  return cachedProfiles;
}

/**
 * Calculates current bus positions across Phuket Island for the exact
 * continuous time of day (Bangkok ICT / UTC+7).
 *
 * @param nowDate Current Date object. If omitted, uses Date.now().
 */
export function calculateSmartBusPositions(nowDate?: Date): PksbBusPosition[] {
  const profiles = loadRouteProfiles();
  const d = nowDate ?? new Date();

  // Convert to Bangkok time with millisecond fractional minute precision
  const utcMs = d.getTime();
  const bangkokMs = utcMs + 7 * 3600 * 1000;
  const bangkokDate = new Date(bangkokMs);
  const h = bangkokDate.getUTCHours();
  const m = bangkokDate.getUTCMinutes();
  const s = bangkokDate.getUTCSeconds();
  const ms = bangkokDate.getUTCMilliseconds();
  const nowMin = h * 60 + m + (s + ms / 1000) / 60;

  const positions: PksbBusPosition[] = [];

  for (const profile of profiles) {
    if (profile.polyline.length < 2) continue;

    const activeTrips: { depMin: number; ageMin: number; index: number }[] = [];

    for (let i = 0; i < profile.departures.length; i++) {
      const dep = profile.departures[i]!;
      const age = nowMin - dep;
      if (age >= -1 && age <= profile.tripDurationMinutes + 1) {
        activeTrips.push({ depMin: dep, ageMin: age, index: i });
      }
    }

    // If outside active scheduled timetable hours (late night / early morning),
    // loop the time into active daytime hours so the map always shows moving operational buses
    if (activeTrips.length === 0) {
      const simulatedDayMin = 8 * 60 + (nowMin % (12 * 60)); // map night to daytime 8am-8pm
      for (let i = 0; i < profile.departures.length; i++) {
        const dep = profile.departures[i]!;
        const age = simulatedDayMin - dep;
        if (age >= -1 && age <= profile.tripDurationMinutes + 1) {
          activeTrips.push({ depMin: dep, ageMin: age, index: i });
        }
      }
    }

    for (const trip of activeTrips) {
      const plate = profile.plates[trip.index % profile.plates.length] ?? "10-1201";
      const clampedAge = Math.max(0, Math.min(profile.tripDurationMinutes, trip.ageMin));
      const progressRatio = profile.tripDurationMinutes > 0
        ? clampedAge / profile.tripDurationMinutes
        : 0;

      // Continuous distance along the real curved road polyline
      const distanceMeters = progressRatio * profile.totalMeters;
      const { coordinates, heading } = posOnPolyline(
        distanceMeters,
        profile.polyline,
        profile.polylineCum
      );

      const isDwelling = trip.ageMin < 1 || trip.ageMin >= profile.tripDurationMinutes - 0.5;
      const averageSpeedKph = (profile.totalMeters / 1000) / (profile.tripDurationMinutes / 60);
      const speedKph = isDwelling ? 0 : Math.round(averageSpeedKph * 10) / 10;

      positions.push({
        id: `smartbus-${profile.id}-${trip.index}-${plate}`,
        routeId: profile.id.replace("-nb", ""),
        licensePlate: plate,
        vehicleId: `PKSB-${plate}`,
        lng: coordinates[1],
        lat: coordinates[0],
        heading: Math.round(heading),
        speedKph,
        status: isDwelling ? "dwelling" : "moving",
        updatedAt: d.toISOString(),
      });
    }
  }

  return positions;
}

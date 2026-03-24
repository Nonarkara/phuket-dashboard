/**
 * PKSB Bus Simulation Engine
 *
 * Simulates bus movement along Phuket Smart Bus routes using real
 * timetable data and stop coordinates from the PKSB GeoJSON files.
 * Produces realistic positions for display when the live PKSB API
 * is unavailable (e.g., on Render deployment).
 */

import { readFileSync } from "fs";
import { join } from "path";

interface StopCoord {
  lat: number;
  lng: number;
  name: string;
  no: number;
}

interface SimulatedBus {
  id: string;
  routeId: string;
  licensePlate: string;
  vehicleId: string;
  lng: number;
  lat: number;
  heading: number;
  speedKph: number;
  status: "moving" | "dwelling";
  updatedAt: string;
}

let cachedStops: Record<string, StopCoord[]> | null = null;

function loadStops(): Record<string, StopCoord[]> {
  if (cachedStops) return cachedStops;

  try {
    const filePath = join(process.cwd(), "public", "data", "pksb-bus-stops.geojson");
    const raw = readFileSync(filePath, "utf-8");
    const geojson = JSON.parse(raw);
    const byRoute: Record<string, StopCoord[]> = {};

    for (const feature of geojson.features ?? []) {
      const props = feature.properties ?? {};
      const coords = feature.geometry?.coordinates;
      if (!coords || !props.route) continue;

      const route = props.route as string;
      if (!byRoute[route]) byRoute[route] = [];

      byRoute[route].push({
        lat: coords[1],
        lng: coords[0],
        name: props.stop_name_eng ?? `Stop ${props.no}`,
        no: props.no ?? byRoute[route].length + 1,
      });
    }

    // Sort stops by stop number
    for (const route of Object.keys(byRoute)) {
      byRoute[route].sort((a, b) => a.no - b.no);
    }

    cachedStops = byRoute;
    return byRoute;
  } catch {
    return {};
  }
}

function parseTimeRange(timeStr: string): { startHour: number; endHour: number; freqMin: number } {
  // Format: "10:00AM ~ 9:00PM Running Every 15 Minutes"
  const rangeMatch = timeStr.match(/(\d{1,2}):(\d{2})(AM|PM)\s*~\s*(\d{1,2}):(\d{2})(AM|PM)/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1]);
    if (rangeMatch[3].toUpperCase() === "PM" && startH !== 12) startH += 12;
    if (rangeMatch[3].toUpperCase() === "AM" && startH === 12) startH = 0;

    let endH = parseInt(rangeMatch[4]);
    if (rangeMatch[6].toUpperCase() === "PM" && endH !== 12) endH += 12;
    if (rangeMatch[6].toUpperCase() === "AM" && endH === 12) endH = 0;

    const freqMatch = timeStr.match(/every\s+(\d+)\s+minutes/i);
    const freqMin = freqMatch ? parseInt(freqMatch[1]) : 30;

    return { startHour: startH, endHour: endH, freqMin };
  }

  // Format: "8:00AM,9:00AM,10:00AM,..." — hourly departures
  const times = timeStr.split(",").map((t) => t.trim());
  if (times.length > 1) {
    const hours = times.map((t) => {
      const m = t.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
      if (!m) return -1;
      let h = parseInt(m[1]);
      if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      return h;
    }).filter((h) => h >= 0);

    return {
      startHour: Math.min(...hours),
      endHour: Math.max(...hours) + 1,
      freqMin: hours.length > 1 ? Math.round(((hours[hours.length - 1] - hours[0]) * 60) / (hours.length - 1)) : 60,
    };
  }

  return { startHour: 8, endHour: 21, freqMin: 30 };
}

function computeHeading(from: StopCoord, to: StopCoord): number {
  const dLng = to.lng - from.lng;
  const dLat = to.lat - from.lat;
  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  return (angle + 360) % 360;
}

function interpolate(a: StopCoord, b: StopCoord, t: number): { lat: number; lng: number } {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

const ROUTE_CONFIGS: Array<{
  key: string;
  id: string;
  label: string;
  color: string;
  plates: string[];
  timeStr: string;
}> = [
  {
    key: "dragon_line",
    id: "dragon",
    label: "Dragon Line",
    color: "#db0000",
    plates: ["10-1201", "10-1202"],
    timeStr: "10:00AM ~ 9:00PM Running Every 15 Minutes",
  },
  {
    key: "main_line",
    id: "rawai-airport",
    label: "Rawai-Airport",
    color: "#35c6f3",
    plates: ["10-1203", "10-1204", "10-1205"],
    timeStr: "8:00AM ~ 8:00PM Running Every 60 Minutes",
  },
  {
    key: "patong_line",
    id: "patong-terminal",
    label: "Patong-Terminal",
    color: "#ffa500",
    plates: ["10-1206", "10-1207", "10-1208"],
    timeStr: "6:00AM ~ 8:00PM Running Every 60 Minutes",
  },
];

export function simulateBusPositions(): SimulatedBus[] {
  const stops = loadStops();
  const now = new Date();
  // Convert to Bangkok time (UTC+7)
  const bangkokOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const bangkokMinutes = (utcMinutes + bangkokOffset) % (24 * 60);
  const bangkokHour = Math.floor(bangkokMinutes / 60);
  const bangkokMinute = bangkokMinutes % 60;
  const currentMinuteOfDay = bangkokHour * 60 + bangkokMinute;

  const buses: SimulatedBus[] = [];

  for (const route of ROUTE_CONFIGS) {
    const routeStops = stops[route.key];
    if (!routeStops || routeStops.length < 2) continue;

    const { startHour, endHour, freqMin } = parseTimeRange(route.timeStr);
    const serviceStart = startHour * 60;
    const serviceEnd = endHour * 60;

    // Not in service hours
    if (currentMinuteOfDay < serviceStart || currentMinuteOfDay >= serviceEnd) continue;

    const minutesSinceStart = currentMinuteOfDay - serviceStart;

    // Time for one full trip (all stops, ~3 min per stop segment)
    const tripDuration = (routeStops.length - 1) * 3; // minutes
    const totalStops = routeStops.length;

    // Generate buses spaced by frequency
    for (let plateIdx = 0; plateIdx < route.plates.length; plateIdx++) {
      // Offset each bus by a fraction of the frequency
      const busOffset = plateIdx * Math.floor(freqMin / route.plates.length);
      const elapsed = (minutesSinceStart + busOffset) % (tripDuration * 2); // round trip

      // Determine if going forward or returning
      const isReturn = elapsed >= tripDuration;
      const tripElapsed = isReturn ? elapsed - tripDuration : elapsed;

      // Which segment are we in?
      const segmentDuration = 3; // minutes per segment
      const segmentIndex = Math.min(
        Math.floor(tripElapsed / segmentDuration),
        totalStops - 2,
      );
      const segmentProgress = (tripElapsed % segmentDuration) / segmentDuration;

      // Get stops (reverse order if returning)
      const orderedStops = isReturn ? [...routeStops].reverse() : routeStops;
      const fromStop = orderedStops[segmentIndex];
      const toStop = orderedStops[segmentIndex + 1];

      if (!fromStop || !toStop) continue;

      const pos = interpolate(fromStop, toStop, segmentProgress);
      const heading = computeHeading(fromStop, toStop);
      const isDwelling = segmentProgress < 0.1 || segmentProgress > 0.9;

      buses.push({
        id: `sim-${route.id}-${plateIdx}`,
        routeId: route.id,
        licensePlate: route.plates[plateIdx],
        vehicleId: `PKSB-${route.plates[plateIdx]}`,
        lng: pos.lng,
        lat: pos.lat,
        heading: Math.round(heading),
        speedKph: isDwelling ? 0 : 15 + Math.random() * 10,
        status: isDwelling ? "dwelling" : "moving",
        updatedAt: now.toISOString(),
      });
    }
  }

  return buses;
}

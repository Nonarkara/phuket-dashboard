import type { Coordinates, ExecutiveStatus } from "../types/dashboard";

export interface TouchpointConfig {
  id: string;
  label: string;
  area: string;
  center: Coordinates;
  laneEnd: Coordinates;
  destinationLabel: string;
  departureStartMinute: number;
  departureEndMinute: number;
  departureIntervalMinutes: number;
  travelMinutes: number;
  capacityPerDeparture: number;
  demandShare: number;
  busRouteHints: string[];
}

export const TOUCHPOINT_CONFIGS: TouchpointConfig[] = [
  {
    id: "rassada-pier",
    label: "Rassada Pier",
    area: "Chalong / Rassada / Ao Po",
    center: [98.4215, 7.8799],
    laneEnd: [98.553, 7.796],
    destinationLabel: "Phi Phi ferry lane",
    departureStartMinute: 7 * 60 + 30,
    departureEndMinute: 18 * 60 + 30,
    departureIntervalMinutes: 60,
    travelMinutes: 75,
    capacityPerDeparture: 220,
    demandShare: 0.48,
    busRouteHints: ["rawai-airport", "patong-old-bus-station"],
  },
  {
    id: "chalong-pier",
    label: "Chalong Pier",
    area: "Chalong / Rassada / Ao Po",
    center: [98.3409, 7.8227],
    laneEnd: [98.384, 7.758],
    destinationLabel: "South island launch lane",
    departureStartMinute: 8 * 60,
    departureEndMinute: 17 * 60,
    departureIntervalMinutes: 45,
    travelMinutes: 35,
    capacityPerDeparture: 120,
    demandShare: 0.32,
    busRouteHints: ["rawai-airport", "dragon-line"],
  },
  {
    id: "ao-po-marina",
    label: "Ao Po Marina",
    area: "Chalong / Rassada / Ao Po",
    center: [98.4624, 8.0724],
    laneEnd: [98.574, 8.149],
    destinationLabel: "Phang Nga bay lane",
    departureStartMinute: 8 * 60 + 15,
    departureEndMinute: 17 * 60 + 15,
    departureIntervalMinutes: 90,
    travelMinutes: 55,
    capacityPerDeparture: 160,
    demandShare: 0.2,
    busRouteHints: ["rawai-airport"],
  },
];

export function currentBangkokMinuteOfDay(date = new Date()) {
  const bangkokOffset = 7 * 60;
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + bangkokOffset + 24 * 60) % (24 * 60);
}

export function minutesToBangkokIso(
  minutes: number,
  date = new Date(),
) {
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  const bangkokMidnightUtc = utcMidnight - 7 * 60 * 60 * 1000;
  return new Date(bangkokMidnightUtc + minutes * 60 * 1000).toISOString();
}

export function nextScheduledDepartureMinute(
  config: TouchpointConfig,
  minuteOfDay: number,
) {
  if (minuteOfDay <= config.departureStartMinute) {
    return config.departureStartMinute;
  }

  if (minuteOfDay > config.departureEndMinute) {
    return null;
  }

  const elapsed = minuteOfDay - config.departureStartMinute;
  const intervals = Math.ceil(elapsed / config.departureIntervalMinutes);
  const nextMinute =
    config.departureStartMinute + intervals * config.departureIntervalMinutes;

  return nextMinute <= config.departureEndMinute ? nextMinute : null;
}

export function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  progress: number,
): Coordinates {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ];
}

export function modeledTouchpointStatus(slackMinutes: number | null): ExecutiveStatus {
  if (slackMinutes === null) {
    return "stable";
  }

  if (slackMinutes < 8) {
    return "intervene";
  }

  if (slackMinutes < 18) {
    return "watch";
  }

  return "stable";
}

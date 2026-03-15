import type { Coordinates, GovernorScenarioId } from "../types/dashboard";

export interface GovernorCorridorDefinition {
  id: string;
  label: string;
  aliases: string[];
  focusAreas: string[];
  center: Coordinates;
  view: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  defaultAction: string;
}

export interface MarinePointDefinition {
  id: string;
  label: string;
  locationLabel: string;
  focusArea: string;
  center: Coordinates;
  aliases: string[];
  defaultAction: string;
}

export interface CityZoneDefinition {
  id: string;
  label: string;
  aliases: string[];
  focusAreas: string[];
  defaultAction: string;
}

export const DEFAULT_GOVERNOR_SCENARIO: GovernorScenarioId = "live";

export const GOVERNOR_CORRIDORS: GovernorCorridorDefinition[] = [
  {
    id: "airport-patong",
    label: "Airport -> Patong",
    aliases: ["airport", "patong", "thepkasattri", "kamala", "transfer", "hill"],
    focusAreas: ["Airport corridor", "Patong coast"],
    center: [98.309, 8.004],
    view: {
      longitude: 98.309,
      latitude: 8.004,
      zoom: 10.6,
      pitch: 44,
      bearing: -10,
    },
    defaultAction: "Clear airport road access and coordinate transfer messaging.",
  },
  {
    id: "old-town",
    label: "Old Town",
    aliases: ["old town", "phuket town", "talad", "market", "downtown"],
    focusAreas: ["Phuket Old Town"],
    center: [98.3923, 7.884],
    view: {
      longitude: 98.3923,
      latitude: 7.884,
      zoom: 12.1,
      pitch: 46,
      bearing: -4,
    },
    defaultAction: "Keep downtown access open and calm misinformation around town activity.",
  },
  {
    id: "east-coast-ports",
    label: "Chalong / Rassada / Ao Po",
    aliases: [
      "chalong",
      "rassada",
      "ao po",
      "pier",
      "marina",
      "ferry",
      "port",
    ],
    focusAreas: ["Chalong / Rassada / Ao Po"],
    center: [98.393, 7.83],
    view: {
      longitude: 98.433,
      latitude: 7.88,
      zoom: 10.45,
      pitch: 46,
      bearing: 12,
    },
    defaultAction: "Inspect pier readiness and synchronize ferry operator messaging.",
  },
  {
    id: "west-beaches",
    label: "Patong / Karon / Kata",
    aliases: ["patong", "karon", "kata", "beach", "surf", "rip current", "bangla"],
    focusAreas: ["Patong coast", "Karon beachfront", "Kata coast"],
    center: [98.294, 7.848],
    view: {
      longitude: 98.29,
      latitude: 7.848,
      zoom: 11.15,
      pitch: 47,
      bearing: -18,
    },
    defaultAction: "Message beach safety, surf conditions, and beach flag discipline.",
  },
  {
    id: "ao-nang-krabi",
    label: "Ao Nang / Krabi",
    aliases: ["ao nang", "krabi", "railey", "phi phi", "krabi beach"],
    focusAreas: ["Ao Nang"],
    center: [98.842, 8.038],
    view: {
      longitude: 98.842,
      latitude: 8.038,
      zoom: 10.35,
      pitch: 40,
      bearing: 8,
    },
    defaultAction: "Coordinate Krabi-side operators on sea access and visitor flow.",
  },
  {
    id: "khao-lak-phang-nga",
    label: "Khao Lak / Phang Nga",
    aliases: ["khao lak", "phang nga", "takua pa", "takua-pa", "similan"],
    focusAreas: ["Khao Lak"],
    center: [98.36, 8.58],
    view: {
      longitude: 98.36,
      latitude: 8.58,
      zoom: 9.85,
      pitch: 38,
      bearing: -6,
    },
    defaultAction: "Watch runoff, beach safety, and coach access on the Khao Lak side.",
  },
];

export const MARINE_POINTS: MarinePointDefinition[] = [
  {
    id: "patong-coast",
    label: "Patong coast",
    locationLabel: "Patong beachfront",
    focusArea: "Patong coast",
    center: [98.2945, 7.8964],
    aliases: ["patong", "west beach", "surf", "beach"],
    defaultAction: "Push surf safety messaging and keep lifeguard posture elevated.",
  },
  {
    id: "karon-beachfront",
    label: "Karon beachfront",
    locationLabel: "Karon beachfront",
    focusArea: "Karon beachfront",
    center: [98.294, 7.834],
    aliases: ["karon", "beach", "surf"],
    defaultAction: "Recheck flags and beach warning signage before peak visitor hours.",
  },
  {
    id: "kata-coast",
    label: "Kata coast",
    locationLabel: "Kata beachfront",
    focusArea: "Kata coast",
    center: [98.299, 7.8198],
    aliases: ["kata", "kata noi", "beach"],
    defaultAction: "Stage beach patrol updates and direct operators to calmer launch windows.",
  },
  {
    id: "chalong-pier",
    label: "Chalong Pier",
    locationLabel: "Chalong Pier",
    focusArea: "Chalong / Rassada / Ao Po",
    center: [98.3409, 7.8227],
    aliases: ["chalong", "pier", "boat", "port"],
    defaultAction: "Inspect pier operations and review small-craft departure tempo.",
  },
  {
    id: "rassada-pier",
    label: "Rassada Pier",
    locationLabel: "Rassada Pier",
    focusArea: "Chalong / Rassada / Ao Po",
    center: [98.4215, 7.8799],
    aliases: ["rassada", "pier", "ferry", "port"],
    defaultAction: "Confirm ferry queue discipline and passenger holding plans.",
  },
  {
    id: "ao-po-marina",
    label: "Ao Po Marina",
    locationLabel: "Ao Po Marina",
    focusArea: "Chalong / Rassada / Ao Po",
    center: [98.4624, 8.0724],
    aliases: ["ao po", "marina", "port", "bay"],
    defaultAction: "Check marina density and keep yacht operators aligned on weather windows.",
  },
  {
    id: "phi-phi-corridor",
    label: "Phi Phi corridor",
    locationLabel: "Phi Phi ferry lane",
    focusArea: "Phi Phi corridor",
    center: [98.553, 7.796],
    aliases: ["phi phi", "ferry lane", "ferry", "marine corridor"],
    defaultAction: "Review ferry lane continuity and pause small departures if seas worsen.",
  },
  {
    id: "ao-nang-waterfront",
    label: "Ao Nang waterfront",
    locationLabel: "Ao Nang beachfront",
    focusArea: "Ao Nang",
    center: [98.8237, 8.0323],
    aliases: ["ao nang", "krabi", "longtail", "beachfront"],
    defaultAction: "Align Krabi waterfront operators on launch timing and passenger queues.",
  },
  {
    id: "khao-lak-coast",
    label: "Khao Lak coast",
    locationLabel: "Khao Lak coast",
    focusArea: "Khao Lak",
    center: [98.2487, 8.6367],
    aliases: ["khao lak", "phang nga", "takua pa", "coast"],
    defaultAction: "Keep beach and coach operators synced on rain and surf conditions.",
  },
];

export const CITY_ZONES: CityZoneDefinition[] = [
  {
    id: "patong",
    label: "Patong",
    aliases: ["patong", "bangla", "beach road"],
    focusAreas: ["Patong coast"],
    defaultAction: "Keep beach and nightlife messaging aligned with current safety posture.",
  },
  {
    id: "old-town",
    label: "Phuket Old Town",
    aliases: ["old town", "phuket town", "downtown"],
    focusAreas: ["Phuket Old Town"],
    defaultAction: "Protect downtown access and keep the city-vibe narrative calm and factual.",
  },
  {
    id: "airport-corridor",
    label: "Airport corridor",
    aliases: ["airport", "arrivals", "transfer", "bridge"],
    focusAreas: ["Airport corridor"],
    defaultAction: "Manage transfers early and clear chokepoints before flight banks arrive.",
  },
  {
    id: "east-coast-ports",
    label: "Chalong / Rassada / Ao Po",
    aliases: ["chalong", "rassada", "ao po", "pier", "marina"],
    focusAreas: ["Chalong / Rassada / Ao Po"],
    defaultAction: "Watch pier density and keep operator instructions consistent across ports.",
  },
  {
    id: "ao-nang",
    label: "Ao Nang",
    aliases: ["ao nang", "krabi", "railey"],
    focusAreas: ["Ao Nang"],
    defaultAction: "Coordinate with Krabi-side operators before beach and boat pressure compounds.",
  },
  {
    id: "khao-lak",
    label: "Khao Lak",
    aliases: ["khao lak", "takua pa", "phang nga"],
    focusAreas: ["Khao Lak"],
    defaultAction: "Keep weather, road, and coach information synchronized for resort operators.",
  },
];

export function findCorridorById(corridorId: string) {
  return GOVERNOR_CORRIDORS.find((corridor) => corridor.id === corridorId);
}

export function normalizeText(value: string) {
  return value.toLowerCase();
}

export function textMatchesAliases(value: string, aliases: string[]) {
  const normalized = normalizeText(value);
  return aliases.some((alias) => normalized.includes(alias.toLowerCase()));
}

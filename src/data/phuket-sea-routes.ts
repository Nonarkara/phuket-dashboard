/**
 * Phuket sea routes — pier-to-island ferry / speedboat connections.
 * Approximate paths based on commonly-published ferry timetables. Coordinates
 * are [lon, lat] pairs to match deck.gl conventions.
 */

export interface SeaRoute {
  id: string;
  name: string;
  pier: string;
  operatorClass: "ferry" | "speedboat" | "longtail";
  path: [number, number][];
}

export const PHUKET_SEA_ROUTES: SeaRoute[] = [
  // ── Rassada Pier (Phuket Town) — main long-range ferries ─────────
  {
    id: "rassada-phiphi",
    name: "Rassada → Koh Phi Phi Don",
    pier: "Rassada",
    operatorClass: "ferry",
    path: [
      [98.408, 7.831],
      [98.5, 7.785],
      [98.65, 7.755],
      [98.78, 7.74],
    ],
  },
  {
    id: "rassada-krabi",
    name: "Rassada → Krabi (Klong Jilad)",
    pier: "Rassada",
    operatorClass: "ferry",
    path: [
      [98.408, 7.831],
      [98.55, 7.85],
      [98.74, 7.95],
      [98.939, 8.058],
    ],
  },
  {
    id: "rassada-lanta",
    name: "Rassada → Koh Lanta",
    pier: "Rassada",
    operatorClass: "ferry",
    path: [
      [98.408, 7.831],
      [98.55, 7.78],
      [98.78, 7.74],
      [98.95, 7.66],
      [99.044, 7.626],
    ],
  },
  // ── Chalong Pier — south coast departures ────────────────────────
  {
    id: "chalong-coral",
    name: "Chalong → Coral Island (Koh Hae)",
    pier: "Chalong",
    operatorClass: "speedboat",
    path: [
      [98.357, 7.823],
      [98.36, 7.78],
    ],
  },
  {
    id: "chalong-racha",
    name: "Chalong → Racha Yai / Racha Noi",
    pier: "Chalong",
    operatorClass: "speedboat",
    path: [
      [98.357, 7.823],
      [98.367, 7.7],
      [98.367, 7.605],
    ],
  },
  {
    id: "chalong-phiphi",
    name: "Chalong → Phi Phi (speedboat)",
    pier: "Chalong",
    operatorClass: "speedboat",
    path: [
      [98.357, 7.823],
      [98.55, 7.78],
      [98.78, 7.74],
    ],
  },
  // ── Bang Rong Pier — eastern Phuket, Phang Nga Bay ───────────────
  {
    id: "bangrong-yaoyai",
    name: "Bang Rong → Koh Yao Yai",
    pier: "Bang Rong",
    operatorClass: "ferry",
    path: [
      [98.397, 8.046],
      [98.49, 7.99],
      [98.581, 7.94],
    ],
  },
  {
    id: "bangrong-yaonoi",
    name: "Bang Rong → Koh Yao Noi",
    pier: "Bang Rong",
    operatorClass: "ferry",
    path: [
      [98.397, 8.046],
      [98.49, 8.085],
      [98.572, 8.117],
    ],
  },
  // ── Ao Po Pier — north-east Phuket ───────────────────────────────
  {
    id: "aopo-naka",
    name: "Ao Po → Koh Naka Yai",
    pier: "Ao Po",
    operatorClass: "longtail",
    path: [
      [98.439, 8.027],
      [98.475, 8.045],
      [98.508, 8.06],
    ],
  },
];

export const PHUKET_PIERS: { id: string; name: string; lng: number; lat: number }[] = [
  { id: "rassada", name: "Rassada Pier", lng: 98.408, lat: 7.831 },
  { id: "chalong", name: "Chalong Pier", lng: 98.357, lat: 7.823 },
  { id: "bangrong", name: "Bang Rong Pier", lng: 98.397, lat: 8.046 },
  { id: "aopo", name: "Ao Po Pier", lng: 98.439, lat: 8.027 },
];

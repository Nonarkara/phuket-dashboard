/**
 * Phuket waterways — major rivers and canals, for flood-risk visualisation.
 * Approximate centerlines derived from OpenStreetMap waterway features.
 * Coordinates are [lon, lat] pairs.
 */

export interface Waterway {
  id: string;
  name: string;
  kind: "river" | "canal";
  path: [number, number][];
}

export const PHUKET_WATERWAYS: Waterway[] = [
  {
    id: "klong-bang-yai",
    name: "Klong Bang Yai (Bang Yai River)",
    kind: "river",
    path: [
      [98.345, 7.975],
      [98.355, 7.952],
      [98.378, 7.92],
      [98.394, 7.895],
      [98.41, 7.87],
      [98.425, 7.842],
      [98.44, 7.83],
    ],
  },
  {
    id: "klong-tha-jin",
    name: "Klong Tha Jin (Phuket Town drainage)",
    kind: "canal",
    path: [
      [98.385, 7.892],
      [98.395, 7.882],
      [98.41, 7.87],
      [98.42, 7.86],
    ],
  },
  {
    id: "klong-pakphra",
    name: "Klong Pak Phra (north channel)",
    kind: "canal",
    path: [
      [98.27, 8.205],
      [98.31, 8.19],
      [98.36, 8.165],
      [98.41, 8.135],
    ],
  },
  {
    id: "klong-kata",
    name: "Klong Kata (south coast)",
    kind: "canal",
    path: [
      [98.305, 7.835],
      [98.308, 7.823],
      [98.302, 7.812],
      [98.299, 7.806],
    ],
  },
  {
    id: "klong-banglae",
    name: "Klong Bang Lae (Patong drainage)",
    kind: "canal",
    path: [
      [98.295, 7.91],
      [98.298, 7.9],
      [98.302, 7.892],
      [98.31, 7.886],
    ],
  },
  {
    id: "klong-rawai",
    name: "Klong Rawai (south wetlands)",
    kind: "canal",
    path: [
      [98.32, 7.795],
      [98.327, 7.78],
      [98.34, 7.768],
    ],
  },
];

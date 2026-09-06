// ─── NST City Flood-Fill Zones ──────────────────────────────────
// Where water goes once it reaches the city, in the order it goes
// there. Traced from the 2017 / 2020 / 2024 inundation pattern:
// western fringe ponds first, the city core follows, the low northern
// and eastern plains hold water while tide constrains the outlets.
// Elevations are representative plain heights (m MSL), not surveyed.

export interface NstZoneDefinition {
  id: string;
  name: string;
  nameTh: string;
  fillOrder: number;
  elevationM: number;
  outlet: string;
  polygon: [number, number][];
  note: string;
}

export const NST_FLOOD_ZONES: NstZoneDefinition[] = [
  {
    id: "z-west-fringe",
    name: "Western fringe — Tha Ngiu / Kamphaeng Sao / Chai Montri",
    nameTh: "ท่างิ้ว-กำแพงเซา-ไชยมนตรี",
    fillOrder: 1,
    elevationM: 7,
    outlet: "Tha Ngiu split",
    polygon: [[99.9, 8.41], [99.945, 8.41], [99.945, 8.45], [99.9, 8.45]],
    note: "First to pond when Tha Di exceeds the city channel. Evacuation staging area.",
  },
  {
    id: "z-city-core",
    name: "City core — Nai Mueang / Tha Wang / Pho Sadet",
    nameTh: "ในเมือง-ท่าวัง-โพธิ์เสด็จ",
    fillOrder: 2,
    elevationM: 4,
    outlet: "Khlong Pak Nakhon",
    polygon: [[99.945, 8.42], [99.985, 8.42], [99.985, 8.46], [99.945, 8.46]],
    note: "Hospital, market, and Ratchadamnoen corridor. ~2 h after the fringe ponds.",
  },
  {
    id: "z-north-lowland",
    name: "Northern lowland — Tha Sak / Pak Phun",
    nameTh: "ท่าซัก-ปากพูน",
    fillOrder: 3,
    elevationM: 1.5,
    outlet: "Pak Phun",
    polygon: [[99.95, 8.46], [100.01, 8.46], [100.01, 8.54], [99.95, 8.54]],
    note: "Holds water for days; drains only on the ebb.",
  },
  {
    id: "z-east-plain",
    name: "Eastern plain — Pak Nakhon / Tha Rai",
    nameTh: "ปากนคร-ท่าไร่",
    fillOrder: 3,
    elevationM: 1.5,
    outlet: "Pak Nakhon",
    polygon: [[99.985, 8.43], [100.045, 8.43], [100.045, 8.475], [99.985, 8.475]],
    note: "Tidal backwater zone. High tide + city discharge = standing water.",
  },
  {
    id: "z-south-corridor",
    name: "Southern corridor — Sai / diversion canal",
    nameTh: "ไสย-คลองผันน้ำ",
    fillOrder: 4,
    elevationM: 3,
    outlet: "Diversion outfall",
    polygon: [[99.91, 8.37], [100.06, 8.37], [100.06, 8.41], [99.91, 8.41]],
    note: "Relieved by the diversion canal when gates are open; ponds only if outfall backs up.",
  },
];

export type GlanceLang = "en" | "th" | "zh";

export type OperatorGlance = {
  corridor: string;
  arrivals: number;
  buses: number;
  roads: number;
  boats: number;
};

export function glanceLangFromParam(value: string | null | undefined): GlanceLang | null {
  const v = (value ?? "").toLowerCase();
  if (v === "en" || v.startsWith("en-")) return "en";
  if (v === "th" || v.startsWith("th-")) return "th";
  if (v === "zh" || v.startsWith("zh")) return "zh";
  return null;
}

const COPY = {
  en: {
    arrivals: (n: number) => `${n}/60m`,
    buses: (n: number) => `${n} bus`,
    roads: (n: number) => `${n} rd`,
    boats: (n: number) => `${n} boat`,
    aria: (g: Required<OperatorGlance>) =>
      `${g.corridor}. Arrivals in the next 60 minutes: ${g.arrivals}. Buses moving: ${g.buses}. Road events: ${g.roads}. Boat contacts: ${g.boats}.`,
    brief: [
      ["Arrivals in the next 60 minutes", "arrivals"],
      ["Buses moving", "buses"],
      ["Road events", "roads"],
      ["Boat contacts", "boats"],
    ] as const,
  },
  th: {
    arrivals: (n: number) => `${n}/60น`,
    buses: (n: number) => `${n} รถ`,
    roads: (n: number) => `${n} ถนน`,
    boats: (n: number) => `${n} เรือ`,
    aria: (g: Required<OperatorGlance>) =>
      `${g.corridor}. ผู้โดยสารถึงใน 60 นาที: ${g.arrivals}. รถโดยสารที่กำลังวิ่ง: ${g.buses}. เหตุการณ์บนถนน: ${g.roads}. เรือที่ติดต่อได้: ${g.boats}.`,
    brief: [
      ["ผู้โดยสารถึงใน 60 นาที", "arrivals"],
      ["รถโดยสารที่กำลังวิ่ง", "buses"],
      ["เหตุการณ์บนถนน", "roads"],
      ["เรือที่ติดต่อได้", "boats"],
    ] as const,
  },
  zh: {
    arrivals: (n: number) => `${n}/60分`,
    buses: (n: number) => `${n}巴`,
    roads: (n: number) => `${n}路`,
    boats: (n: number) => `${n}船`,
    aria: (g: Required<OperatorGlance>) =>
      `${g.corridor}. 未来60分钟进港: ${g.arrivals}. 行驶中的巴士: ${g.buses}. 道路事件: ${g.roads}. 船舶联系: ${g.boats}.`,
    brief: [
      ["未来60分钟进港", "arrivals"],
      ["行驶中的巴士", "buses"],
      ["道路事件", "roads"],
      ["船舶联系", "boats"],
    ] as const,
  },
} as const;

export function glancePresentation(lang: GlanceLang, glance: OperatorGlance | null) {
  const corridor = glance?.corridor ?? "Phuket";
  const arrivals = glance?.arrivals ?? 0;
  const buses = glance?.buses ?? 0;
  const roads = glance?.roads ?? 0;
  const boats = glance?.boats ?? 0;
  const copy = COPY[lang];
  const full = { corridor, arrivals, buses, roads, boats };
  return {
    corridor,
    counts: [
      copy.arrivals(arrivals),
      copy.buses(buses),
      copy.roads(roads),
      copy.boats(boats),
    ],
    aria: copy.aria(full),
    brief: copy.brief.map(([label, key]) => ({
      label,
      value: full[key],
    })),
  };
}

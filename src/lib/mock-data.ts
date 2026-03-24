import type {
  AseanGdpDatum,
  ApiSourceResponse,
  BriefingPayload,
  CopernicusPreviewResponse,
  EconomicIndicator,
  FireEvent,
  MarketRadarResponse,
  IncidentFeature,
  NewsResponse,
  RainfallPoint,
  RefugeeMovement,
  TickerResponse,
} from "../types/dashboard";

export const fallbackIncidents: IncidentFeature[] = [
  {
    id: "PHU-001",
    geometry: { coordinates: [98.3089, 7.8804] },
    properties: {
      title: "Road safety alert",
      type: "Road safety alert",
      fatalities: 1,
      notes:
        "Motorbike crash risk rose on the Patong Hill approach after evening rain and dense visitor traffic.",
      location: "Patong Hill",
      eventDate: "2026-03-11T17:20:00.000Z",
    },
  },
  {
    id: "PHU-002",
    geometry: { coordinates: [98.2785, 7.9663] },
    properties: {
      title: "Marine advisory",
      type: "Marine advisory",
      fatalities: 0,
      notes:
        "Small-boat operators were advised to delay departures off Kamala and the west coast as swell and gusts strengthened.",
      location: "Kamala coast",
      eventDate: "2026-03-11T12:40:00.000Z",
    },
  },
  {
    id: "PHU-003",
    geometry: { coordinates: [98.5308, 8.4383] },
    properties: {
      title: "Flooded roadway",
      type: "Flooded roadway",
      fatalities: 0,
      notes:
        "Runoff and standing water slowed vehicle movement near Takua Pa and Khao Lak after a heavy burst of rain.",
      location: "Takua Pa / Khao Lak",
      eventDate: "2026-03-10T09:15:00.000Z",
    },
  },
  {
    id: "PHU-004",
    geometry: { coordinates: [98.9126, 8.0863] },
    properties: {
      title: "Arrival surge",
      type: "Tourism surge",
      fatalities: 0,
      notes:
        "Airport arrivals and transfer demand strengthened across the Phuket-Krabi visitor route ahead of the weekend.",
      location: "Phuket-Krabi route",
      eventDate: "2026-03-10T06:50:00.000Z",
    },
  },
];

export const fallbackFires: FireEvent[] = [
  {
    latitude: 9.97,
    longitude: 98.63,
    brightness: 304,
    confidence: "nominal",
    acq_date: "2026-03-10T17:00:00.000Z",
  },
];

export const fallbackEconomicIndicators: EconomicIndicator[] = [
  {
    label: "Hotel Occupancy",
    value: 78.4,
    unit: "%",
    change: 3.2,
    up: true,
    category: "Tourism",
    source: "Fallback",
  },
  {
    label: "Airport Arrivals",
    value: 53.1,
    unit: "k",
    change: 4.7,
    up: true,
    category: "Mobility",
    source: "Fallback",
  },
  {
    label: "Diesel",
    value: 32.6,
    change: 0.4,
    up: true,
    category: "Energy",
    source: "Fallback",
  },
  {
    label: "USD/THB",
    value: 35.7,
    change: -0.6,
    up: false,
    category: "FX",
    source: "Fallback",
  },
];

export const fallbackAseanGdp: AseanGdpDatum[] = [
  {
    countryCode: "IDN",
    country: "Indonesia",
    gdpUsd: 1_390_000_000_000,
    gdpPerCapitaUsd: 4_980,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "THA",
    country: "Thailand",
    gdpUsd: 515_000_000_000,
    gdpPerCapitaUsd: 7_180,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "SGP",
    country: "Singapore",
    gdpUsd: 530_000_000_000,
    gdpPerCapitaUsd: 89_400,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "PHL",
    country: "Philippines",
    gdpUsd: 472_000_000_000,
    gdpPerCapitaUsd: 4_140,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "VNM",
    country: "Vietnam",
    gdpUsd: 476_000_000_000,
    gdpPerCapitaUsd: 4_710,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "MYS",
    country: "Malaysia",
    gdpUsd: 422_000_000_000,
    gdpPerCapitaUsd: 12_450,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "TLS",
    country: "Timor-Leste",
    gdpUsd: 2_300_000_000,
    gdpPerCapitaUsd: 1_730,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "MMR",
    country: "Myanmar",
    gdpUsd: 64_000_000_000,
    gdpPerCapitaUsd: 1_180,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "KHM",
    country: "Cambodia",
    gdpUsd: 49_000_000_000,
    gdpPerCapitaUsd: 2_870,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "BRN",
    country: "Brunei",
    gdpUsd: 17_000_000_000,
    gdpPerCapitaUsd: 39_900,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
  {
    countryCode: "LAO",
    country: "Laos",
    gdpUsd: 16_000_000_000,
    gdpPerCapitaUsd: 2_120,
    gdpYear: 2024,
    gdpPerCapitaYear: 2024,
    source: "Fallback macro snapshot",
  },
].sort((left, right) => right.gdpUsd - left.gdpUsd);

export const fallbackMarketRadarResponse: MarketRadarResponse = {
  generatedAt: "2026-03-11T09:00:00.000Z",
  data: fallbackEconomicIndicators,
  signals: fallbackEconomicIndicators,
  aseanGdp: fallbackAseanGdp,
  sources: ["Tourism snapshot", "Regional FX reference", "Fallback macro snapshot"],
};

export const fallbackRefugees: RefugeeMovement[] = [
  {
    source: [98.3057, 8.1132],
    target: [98.2965, 7.8964],
    count: 18200,
    label: "18,200 arrivals/day Airport -> Patong",
  },
  {
    source: [98.3917, 7.884],
    target: [98.3409, 7.8227],
    count: 6400,
    label: "6,400 trips/day Old Town -> Chalong",
  },
];

export const fallbackRainfall: RainfallPoint[] = [
  { lat: 7.8804, lng: 98.3923, value: 31.4, label: "Phuket Town" },
  { lat: 7.8964, lng: 98.2965, value: 42.8, label: "Patong" },
  { lat: 8.6367, lng: 98.2487, value: 55.2, label: "Khao Lak" },
  { lat: 8.0863, lng: 98.9126, value: 24.6, label: "Krabi" },
];

export const fallbackNews: NewsResponse = {
  generatedAt: "2026-03-11T09:00:00.000Z",
  news: [
    {
      id: "news-01",
      title: "West coast marine conditions remain the lead operating signal",
      summary:
        "Wave height, gusts, and small-boat advisories remain the most time-sensitive operating signals around Phuket's west coast.",
      source: "Phuket monitor",
      tag: "Marine",
      publishedAt: "2026-03-11T09:00:00.000Z",
      severity: "alert",
    },
    {
      id: "news-02",
      title: "Airport arrivals and hotel occupancy continue to rise",
      summary:
        "Visitor demand is still the main economic support for Phuket and nearby provinces, with transport load climbing into the weekend.",
      source: "Economic radar",
      tag: "Tourism",
      publishedAt: "2026-03-11T09:00:00.000Z",
      severity: "watch",
    },
    {
      id: "news-03",
      title: "Rain and runoff remain the main mobility constraint",
      summary:
        "Rainfall products, AQI, and roadway checks should be cross-read before escalating a local safety signal.",
      source: "Operations desk",
      tag: "Weather",
      publishedAt: "2026-03-11T09:00:00.000Z",
      severity: "stable",
    },
  ],
};

export const fallbackTicker: TickerResponse = {
  generatedAt: "2026-03-11T09:00:00.000Z",
  items: [
    {
      id: "ticker-01",
      label: "Visitor flows",
      value: "18.2k/day",
      delta: "+8% wk/wk",
      tone: "up",
    },
    {
      id: "ticker-02",
      label: "Hotel occupancy",
      value: "78.4%",
      delta: "+3.2",
      tone: "up",
    },
    {
      id: "ticker-03",
      label: "Marine advisory",
      value: "West coast",
      delta: "small craft",
      tone: "neutral",
    },
    {
      id: "ticker-04",
      label: "Rain load",
      value: "4 zones",
      delta: "elevated",
      tone: "up",
    },
  ],
};

export const fallbackBriefing: BriefingPayload = {
  title: "Phuket operations briefing",
  summary:
    "West coast marine safety and rain-linked road mobility remain the most actionable near-term signals, while tourism demand continues to run hot across Phuket and nearby provinces.",
  updatedAt: "2026-03-11T09:00:00.000Z",
  priorities: [
    "Keep west coast marine advisories and pier conditions on the front page during monsoon bursts.",
    "Cross-check Patong, Kathu, and airport access roads after heavy rain or late-evening peaks.",
    "Track arrivals, occupancy, and diesel together when evaluating short-term tourism pressure.",
  ],
  marketSignals: [
    "Hotel occupancy remains the lead demand signal.",
    "Diesel and FX shifts should be tracked as second-order cost indicators.",
  ],
  outlook:
    "Tourism demand is supportive, but monsoon bursts can quickly reshape marine access, road safety, and transfer reliability across the Andaman side.",
};

export const fallbackSources: ApiSourceResponse = {
  generatedAt: "2026-03-11T09:00:00.000Z",
  freshness: {
    checkedAt: "2026-03-11T09:00:00.000Z",
    observedAt: null,
    ageMinutes: null,
    maxAgeMinutes: 24 * 60,
    isFresh: false,
    fallbackTier: "reference",
    sourceIds: ["Phuket Dashboard reference catalog"],
  },
  sources: [
    {
      id: "source-01",
      label: "Operations briefing",
      url: "https://phuket-dashboard.local/api/briefings/latest",
      kind: "internal",
      target: "Phuket Dashboard",
      classification: "reference",
    },
    {
      id: "source-02",
      label: "Economic radar",
      url: "https://phuket-dashboard.local/api/markets",
      kind: "internal",
      target: "Phuket Dashboard",
      classification: "reference",
    },
    {
      id: "source-03",
      label: "Signal ticker",
      url: "https://phuket-dashboard.local/api/ticker",
      kind: "internal",
      target: "Phuket Dashboard",
      classification: "reference",
    },
    {
      id: "source-04",
      label: "Open-Meteo weather",
      url: "https://api.open-meteo.com/v1/forecast",
      kind: "external",
      target: "Open-Meteo",
      classification: "reference",
    },
    {
      id: "source-05",
      label: "Open-Meteo air quality",
      url: "https://air-quality-api.open-meteo.com/v1/air-quality",
      kind: "external",
      target: "Open-Meteo",
      classification: "reference",
    },
    {
      id: "source-06",
      label: "NASA GIBS true color",
      url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/",
      kind: "external",
      target: "NASA GIBS",
      classification: "reference",
    },
    {
      id: "source-07",
      label: "GISTDA Disaster Platform",
      url: "https://disaster.gistda.or.th/services/open-api",
      kind: "external",
      target: "GISTDA",
      classification: "reference",
    },
    {
      id: "source-08",
      label: "TMD / NDWC alerts",
      url: "https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=api&ukey=api12345",
      kind: "external",
      target: "TMD / NDWC",
      classification: "reference",
    },
    {
      id: "source-09",
      label: "AIS provider",
      url: "https://www.aishub.net/api",
      kind: "external",
      target: "MarineTraffic / AISHub",
      classification: "reference",
    },
    {
      id: "source-10",
      label: "TAT Data API",
      url: "https://tatdataapi.io",
      kind: "external",
      target: "Tourism Authority of Thailand",
      classification: "reference",
    },
  ],
};

export const fallbackCopernicusPreview: CopernicusPreviewResponse = {
  updatedAt: "2026-03-11T09:00:00.000Z",
  focusDate: "2026-02-25",
  imagerySources: [
    {
      id: "viirsTrueColor",
      label: "VIIRS True Color",
      description: "Broad true-color composite for fast regional situational review.",
    },
    {
      id: "modisFalseColor",
      label: "MODIS False Color",
      description: "False-color land and burn-scar view with stronger terrain and vegetation contrast.",
    },
    {
      id: "blueMarble",
      label: "Blue Marble Relief",
      description: "Shaded relief base for terrain-first orientation across coastlines, hills, and island approaches.",
    },
  ],
};

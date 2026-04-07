import type {
  Feature,
  FeatureCollection,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";

export type Coordinates = [number, number];

export type FallbackTier =
  | "live"
  | "database"
  | "cache"
  | "scenario"
  | "reference"
  | "unavailable";

export interface DataFreshness {
  observedAt: string | null;
  checkedAt: string;
  ageMinutes: number | null;
  maxAgeMinutes: number;
  isFresh: boolean;
  fallbackTier: FallbackTier;
  sourceIds?: string[];
}

export type FeedMode = "live" | "hybrid" | "modeled" | "degraded";

export interface SourceSummary {
  label: string;
  mode: FeedMode;
  sources: string[];
  note?: string;
  freshness?: DataFreshness;
}

export interface MetricEvidence {
  id: string;
  label: string;
  value: number | string | null;
  displayValue: string;
  source: string;
  unit?: string | null;
  observedAt?: string | null;
  formula?: string;
  freshness: DataFreshness;
}

export interface ProvinceSelection {
  name: string;
  type?: string;
  notes?: string;
  fatalities?: number;
  iso?: string;
  location?: string;
  eventDate?: string;
  externalUrl?: string;
  source?: string;
}

export interface IncidentProperties {
  title: string;
  type: string;
  fatalities: number;
  notes: string;
  location: string;
  eventDate: string;
}

export interface IncidentFeature {
  id: string;
  geometry: {
    coordinates: Coordinates;
  };
  properties: IncidentProperties;
}

export interface FireEvent {
  latitude: number;
  longitude: number;
  brightness: number;
  confidence: string;
  acq_date: string;
}

export interface TrafficEvent {
  title: string;
  description: string;
  lat: number;
  lng: number;
  type: string;
  start: string | null;
  stop: string | null;
}

export interface TrafficResponse {
  generatedAt: string;
  provider: string;
  status: string;
  events: TrafficEvent[];
}

export interface FlightData {
  icao24: string;
  callsign: string;
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  origin_country: string;
  on_ground: boolean;
}

export interface FlightArrival {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCode: string;
  originLat: number;
  originLon: number;
  scheduledTime: string;
  estimatedTime: string;
  status: "landed" | "on-time" | "delayed" | "en-route" | "scheduled";
  gate?: string;
  terminal?: string;
  aircraft?: string;
  paxEstimate: number;
  country: string;
  countryCode: string;
  distance: number;
}

export interface FlightArrivalsResponse {
  airport: string;
  iata: string;
  timezone: string;
  generatedAt: string;
  totalFlights: number;
  arrivals: FlightArrival[];
  byCountry: Record<string, number>;
  mode: FeedMode;
  source: "live" | "simulation";
  sourceSummary: SourceSummary;
}

export interface RefugeeMovement {
  source: Coordinates;
  target: Coordinates;
  count: number;
  label: string;
}

export interface RainfallPoint {
  lat: number;
  lng: number;
  value: number;
  label: string;
}

export interface AirQualityPoint {
  lat: number;
  lng: number;
  label: string;
  aqi: number;
  pm25: number;
  category: string;
  observedAt?: string;
  source?: string;
}

export interface PksbRouteProperties {
  id: string;
  routeId: "dragon_line" | "main_line" | "patong_line";
  routeLabel: string;
  directionLabel: string;
  color: string;
  lengthMeters?: number | null;
}

export type PksbRouteFeature = Feature<MultiLineString, PksbRouteProperties>;

export type PksbRouteCollection = FeatureCollection<
  MultiLineString,
  PksbRouteProperties
>;

export interface PksbStopProperties {
  id: string;
  routeId: "dragon_line" | "main_line" | "patong_line";
  routeLabel: string;
  routeColor: string;
  stopNumber: number;
  stopNameEn: string;
  stopNameTh: string;
  direction: string;
  routeDirection: string;
  timetable: string;
  mapUrl?: string;
}

export type PksbStopFeature = Feature<Point, PksbStopProperties>;

export type PksbStopCollection = FeatureCollection<Point, PksbStopProperties>;

export interface PksbTransitResponse {
  generatedAt: string;
  source: string[];
  routes: PksbRouteCollection;
  stops: PksbStopCollection;
}

export interface PksbBusPosition {
  id: string;
  routeId: string;
  licensePlate: string;
  vehicleId: string;
  lng: number;
  lat: number;
  heading: number;
  speedKph: number;
  status: "moving" | "dwelling" | "unknown";
  updatedAt: string;
}

export interface PksbBusPositionResponse {
  generatedAt: string;
  buses: PksbBusPosition[];
  mode: FeedMode;
  sourceSummary: SourceSummary;
  freshness: DataFreshness;
}

export interface OperationsMetric {
  label: string;
  value: string;
}

export interface DemandSupplySnapshot {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  demandRate: number;
  supplyRate: number;
  gapRate: number;
  unit: string;
  windowLabel: string;
  sourceSummary: SourceSummary;
  updatedAt: string;
  evidence?: MetricEvidence[];
}

export interface OperationsConstraint {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  metrics: OperationsMetric[];
  sourceSummary: SourceSummary;
  updatedAt: string;
  evidence?: MetricEvidence[];
}

export interface InterchangeVehicle {
  id: string;
  label: string;
  kind: "bus" | "ferry";
  status: "approaching" | "holding" | "boarding" | "departing" | "docked";
  etaMinutes: number | null;
  scheduledAt: string | null;
  routeLabel?: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface InterchangeTouchpoint {
  id: string;
  label: string;
  area: string;
  status: ExecutiveStatus;
  summary: string;
  nextDepartureAt: string | null;
  transferSlackMinutes: number | null;
  demandRate: number;
  supplyRate: number;
  unit: string;
  vehicles: InterchangeVehicle[];
  sourceSummary: SourceSummary;
  updatedAt: string;
}

export interface OperationalWeatherResponse {
  generatedAt: string;
  mode: FeedMode;
  status: ExecutiveStatus;
  condition: string;
  summary: string;
  temperatureC: number | null;
  humidityPct: number | null;
  rainfallMm: number | null;
  windKph: number | null;
  seaState: string;
  sourceSummary: SourceSummary;
  freshness: DataFreshness;
  evidence?: MetricEvidence[];
}

export interface OperationsDashboardResponse {
  generatedAt: string;
  mode: FeedMode;
  airportDemand: DemandSupplySnapshot;
  cityTransferSupply: DemandSupplySnapshot;
  trafficFriction: OperationsConstraint;
  weatherConstraint: OperationalWeatherResponse;
  marineConstraint: OperationsConstraint;
  touchpoints: InterchangeTouchpoint[];
  actions: string[];
  sources: string[];
  freshness: DataFreshness;
}

export interface PublicCamera {
  id: string;
  label: string;
  location: string;
  locationLabel: string;
  lat: number;
  lng: number;
  provider: string;
  type: "beach" | "traffic" | "bay";
  validationState: "verified" | "candidate";
  focusArea: string;
  strategicNote: string;
  notes: string;
  accessUrl?: string | null;
  corridorIds?: string[];
  lastValidatedAt?: string;
  lastCheckedAt?: string;
  lastFrameAt?: string | null;
  lastHttpStatus?: number | null;
  validationMethod?: string;
  operationalState?: "live" | "reachable" | "offline" | "candidate";
  contentType?: string | null;
  freshness?: DataFreshness;
  candidateSourceNote?: string;
}

export interface CameraScoutItem extends PublicCamera {
  validationState: "candidate";
}

export interface PublicCameraResponse {
  generatedAt: string;
  source: string[];
  cameras: PublicCamera[];
  scoutTargets: CameraScoutItem[];
  freshness: DataFreshness;
  lastSweepAt: string;
  expectedVerifiedFeeds: number;
  verifiedLiveCount: number;
  reachableCount: number;
  scoutCount: number;
}

export interface RegionBorderProperties {
  NAME_0?: string;
  ISO_A3?: string;
  ADM0_A3?: string;
}

export interface RegionBorderFeature {
  properties: RegionBorderProperties;
}

export interface RegionBorderCollection {
  type: "FeatureCollection";
  features: RegionBorderFeature[];
}

export interface ConflictZoneProperties {
  id: string;
  name: string;
  status: string;
  priority: number;
  summary: string;
}

export type ConflictZoneFeature = Feature<
  Polygon | MultiPolygon,
  ConflictZoneProperties
>;

export type ConflictZoneCollection = FeatureCollection<
  Polygon | MultiPolygon,
  ConflictZoneProperties
>;

export interface EconomicIndicator {
  label: string;
  value: number | string;
  unit?: string | null;
  category?: string | null;
  source?: string | null;
  change: number | string;
  up: boolean;
  province?: string | null;
}

export interface AseanGdpDatum {
  countryCode: string;
  country: string;
  gdpUsd: number;
  gdpPerCapitaUsd: number;
  gdpYear: number;
  gdpPerCapitaYear: number;
  source: string;
}

export interface CountryEconomicIndicatorSnapshot {
  countryCode: string;
  country: string;
  indicatorCode: string;
  indicatorLabel: string;
  value: number;
  unit: string | null;
  refYear: number;
  source: string;
}

export interface AseanProfileMetric {
  id: string;
  label: string;
  value: number | null;
  unit: string | null;
  year: number | null;
  source: string;
  note?: string;
  secondaryValue?: number | null;
  secondaryUnit?: string | null;
  secondaryYear?: number | null;
}

export interface AseanProfileNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface AseanCountryProfileResponse {
  generatedAt: string;
  country: {
    code: string;
    label: string;
    aliases: string[];
  };
  metrics: AseanProfileMetric[];
  news: AseanProfileNewsItem[];
  sources: string[];
}

export interface MarketRadarResponse {
  generatedAt: string;
  data: EconomicIndicator[];
  signals: EconomicIndicator[];
  aseanGdp: AseanGdpDatum[];
  sources: string[];
}

export interface DatabaseTableSummary {
  id: string;
  label: string;
  description: string;
  category: string;
  columns: string[];
  rowCount: number | null;
  latestValue: string | null;
}

export interface DatabaseCatalogResponse {
  databaseConfigured: boolean;
  generatedAt: string;
  totalRows: number;
  tables: DatabaseTableSummary[];
}

export interface DatabaseTablePreviewResponse {
  databaseConfigured: boolean;
  generatedAt: string;
  table: DatabaseTableSummary;
  limit: number;
  rows: Array<Record<string, unknown>>;
}

export interface ConflictTrendSeries {
  labels: string[];
  current: number[];
  yoy: number[];
}

export interface FatalityTrendSeries {
  labels: string[];
  data: number[];
}

export interface ConflictTrendsResponse {
  provincialData: ConflictTrendSeries;
  fatalities: FatalityTrendSeries;
}

export type SignalTone = "up" | "down" | "neutral";
export type NewsSeverity = "alert" | "watch" | "stable";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  tag: string;
  publishedAt: string;
  severity: NewsSeverity;
}

export interface NewsResponse {
  news: NewsItem[];
  generatedAt: string;
}

export interface TickerItem {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: SignalTone;
}

export interface TickerResponse {
  items: TickerItem[];
  generatedAt: string;
}

export interface BriefingPayload {
  title: string;
  summary: string;
  updatedAt: string;
  priorities: string[];
  marketSignals: string[];
  outlook: string;
}

export interface ApiSourceEntry {
  id: string;
  label: string;
  url: string;
  kind: string;
  target: string;
  health?: PackageStatus;
  checkedAt?: string;
  classification?: "operational" | "reference";
  freshness?: DataFreshness;
}

export interface ApiSourceResponse {
  generatedAt: string;
  sources: ApiSourceEntry[];
  freshness: DataFreshness;
}

export interface CopernicusPreviewLayer {
  id: string;
  label: string;
  description: string;
}

export interface CopernicusPreviewResponse {
  updatedAt: string;
  focusDate: string;
  imagerySources: CopernicusPreviewLayer[];
}

export type PackageStatus = "live" | "stale" | "offline";

export interface SourceHealth {
  id: string;
  label: string;
  url: string;
  status: PackageStatus;
  checkedAt: string;
  responseTimeMs: number | null;
  message: string | null;
}

export interface IntelligenceItem {
  id: string;
  packageId: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  url: string;
  tags: string[];
  score: number;
  severity: NewsSeverity;
  kind: "news" | "incident" | "market" | "weather" | "movement" | "thermal";
}

export interface IntelligencePackageStats {
  total: number;
  elevated: number;
  dominantTags: string[];
  incidents: number;
  markets: number;
  weather: number;
}

export interface IntelligencePackage {
  id: string;
  title: string;
  headline: string;
  summary: string;
  description: string;
  priorities: string[];
  dominantTags: string[];
  sourceLabels: string[];
  updatedAt: string;
  status: PackageStatus;
  items: IntelligenceItem[];
  stats: IntelligencePackageStats;
}

export interface IntelligencePackageResponse {
  generatedAt: string;
  mode: PackageStatus;
  packages: IntelligencePackage[];
  sources: SourceHealth[];
}

export type ConvergencePosture = "priority" | "watch" | "monitor";
export type ConvergenceFamily =
  | "incident"
  | "news"
  | "market"
  | "weather"
  | "thermal"
  | "movement";

export interface ConvergenceEvidence {
  id: string;
  family: ConvergenceFamily;
  title: string;
  source: string;
  observedAt: string;
  score: number;
  reason: string;
  url: string;
}

export interface ConvergenceAlert {
  id: string;
  title: string;
  summary: string;
  score: number;
  posture: ConvergencePosture;
  windowHours: number;
  families: ConvergenceFamily[];
  evidence: ConvergenceEvidence[];
  dataGaps: string[];
  updatedAt: string;
}

export interface ConvergenceCorridor {
  id: string;
  label: string;
  center: Coordinates;
  radiusKm: number;
  aliases: string[];
}

export interface ConvergenceSourceCoverage {
  live: number;
  stale: number;
  offline: number;
  total: number;
  labels: string[];
}

export interface CorridorConvergenceResponse {
  generatedAt: string;
  corridor: ConvergenceCorridor;
  posture: ConvergencePosture;
  score: number;
  summary: string;
  alerts: ConvergenceAlert[];
  sourceCoverage: ConvergenceSourceCoverage;
  dataGaps: string[];
}

export type MapOverlayKind = "raster" | "vector";
export type MapOverlayFamily =
  | "imagery"
  | "vegetation"
  | "terrain"
  | "weather"
  | "air"
  | "lights"
  | "thermal"
  | "operational";
export type MapOverlayRole = "base-option" | "analytic" | "operational";

export interface MapOverlay {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  source: string;
  kind: MapOverlayKind;
  family: MapOverlayFamily;
  role: MapOverlayRole;
  defaultOpacity: number;
  updatedAt: string;
  enabledByDefault: boolean;
  maxZoom?: number;
  tileTemplate?: string;
  timeMode?: "dated" | "default";
}

export interface MapOverlayCatalogResponse {
  updatedAt: string;
  defaultBasemap: "detailed-streets";
  defaultImageryOverlayId: string;
  overlays: MapOverlay[];
}

export type ExecutiveStatus = "intervene" | "watch" | "stable";
export type GovernorScenarioId =
  | "red-monsoon-day"
  | "tourism-surge-weekend"
  | "stable-recovery-day"
  | "live";

export interface GovernorPosture {
  level: ExecutiveStatus;
  label: string;
  summary: string;
  updatedAt: string;
  freshness?: DataFreshness;
}

export interface GovernorConcern {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  whyNow: string;
  metricLabel: string;
  metricValue: string;
  action: string;
  sources: string[];
  freshness?: DataFreshness;
  evidence?: MetricEvidence[];
}

export interface GovernorCorridorPriority {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  whyNow: string;
  action: string;
  reasonTags: string[];
  focusAreas: string[];
  freshness?: DataFreshness;
  evidence?: MetricEvidence[];
}

export interface GovernorBrief {
  generatedAt: string;
  scenario: GovernorScenarioId;
  posture: GovernorPosture;
  topConcerns: GovernorConcern[];
  corridorPriorities: GovernorCorridorPriority[];
  nextActions: string[];
  sources: string[];
  freshness: DataFreshness;
}

export interface MarineCorridorStatus {
  id: string;
  label: string;
  locationLabel: string;
  focusArea: string;
  center: Coordinates;
  status: ExecutiveStatus;
  summary: string;
  alertPosture: string;
  waveHeightMeters: number | null;
  swellHeightMeters: number | null;
  windSpeedKph: number | null;
  gustSpeedKph: number | null;
  rainfallMm: number | null;
  alerts: string[];
  recommendedAction: string;
  sources: string[];
  updatedAt: string;
  formula?: string;
  evidence?: MetricEvidence[];
  freshness?: DataFreshness;
}

export interface MarineStatusResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  corridors: MarineCorridorStatus[];
  sources: string[];
  upgrades: string[];
  freshness: DataFreshness;
}

export interface CityVibeCard {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  whyNow: string;
  pulseIndex?: number | null;
  pulseFormula?: string | null;
  cameraCoveragePct: number | null;
  narrativeSignals24h: number;
  mobilityLoad: string;
  weatherExposure: string;
  incidentCount24h: number;
  recommendedAction: string;
  sources: string[];
  updatedAt: string;
  components: MetricEvidence[];
  freshness: DataFreshness;
}

export interface CityVibesResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  zones: CityVibeCard[];
  sources: string[];
  freshness: DataFreshness;
}

export interface NarrativeSignal {
  id: string;
  kind: "talk" | "share" | "broadcast";
  title: string;
  zone: string;
  status: ExecutiveStatus;
  summary: string;
  volumeLabel: string;
  source: string;
  observedAt: string;
  url?: string;
  freshness?: DataFreshness;
}

export interface MediaWatchResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  postureSummary: string;
  peopleTalkAbout: NarrativeSignal[];
  peopleShare: NarrativeSignal[];
  broadcastWatch: NarrativeSignal[];
  sources: string[];
  providerHealth?: {
    googleTrends: DataFreshness;
    gdelt: DataFreshness;
    tvWall: DataFreshness;
  };
  freshness: DataFreshness;
}

export interface PhuketVisitorOrigin {
  rank: number;
  countryCode: string;
  country: string;
  logo: string;
  gdpPerCapitaUsd: number | null;
  year: number | null;
  source: string;
  freshness?: DataFreshness;
}

export interface PhuketVisitorOriginsResponse {
  generatedAt: string;
  origins: PhuketVisitorOrigin[];
  sources: string[];
  freshness: DataFreshness;
}

export interface GovernorNarrativeArticle {
  title: string;
  url: string;
  source: string;
  tone: "positive" | "neutral" | "negative";
  date: string;
}

export interface GovernorNarrativeResponse {
  generatedAt: string;
  mentionCount: number;
  avgTone: number | null;
  positivePct: number | null;
  neutralPct: number | null;
  negativePct: number | null;
  trendDelta30d: number | null;
  trend: "rising" | "stable" | "declining";
  period: string;
  articles: GovernorNarrativeArticle[];
  sources: string[];
  freshness: DataFreshness;
}

export interface DisasterAlert {
  id: string;
  title: string;
  severity: ExecutiveStatus;
  area: string;
  summary: string;
  lat: number;
  lng: number;
  issuedAt: string;
  source: string;
  url?: string;
  freshness?: DataFreshness;
}

export interface DisasterLayerDescriptor {
  id: string;
  label: string;
  kind: "api" | "wmts" | "stac" | "cap";
  source: string;
  url: string;
  configured: boolean;
}

export interface DisasterFeedResponse {
  generatedAt: string;
  posture: ExecutiveStatus;
  summary: string;
  alerts: DisasterAlert[];
  layers: DisasterLayerDescriptor[];
  rainfallNodes: number | null;
  sources: string[];
  providerHealth?: {
    gistda: PackageStatus;
    nsdc: PackageStatus;
    tmd: PackageStatus;
  };
  freshness: DataFreshness;
}

export interface MaritimeVessel {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  speedKnots: number;
  heading: number | null;
  lastSeen: string;
  flag: string | null;
  destination: string | null;
  status: ExecutiveStatus;
  source: string;
  strategicNote: string;
  freshness?: DataFreshness;
}

export interface MaritimeSecurityResponse {
  generatedAt: string;
  posture: ExecutiveStatus;
  summary: string;
  provider: string;
  vessels: MaritimeVessel[];
  chokepoints: string[];
  sources: string[];
  mode: FeedMode;
  sourceSummary: SourceSummary;
  providerHealth?: PackageStatus;
  freshness: DataFreshness;
}

export interface TourismHotspot {
  id: string;
  label: string;
  kind: "beach" | "pier" | "old-town" | "attraction" | "event";
  lat: number;
  lng: number;
  area: string;
  summary: string;
  status: ExecutiveStatus;
  source: string;
  url?: string;
  strategicNote: string;
  coordinateAccuracy?: "verified" | "estimated";
  freshness?: DataFreshness;
}

export interface TourismHotspotsResponse {
  generatedAt: string;
  summary: string;
  provider: string;
  hotspots: TourismHotspot[];
  sources: string[];
  providerHealth?: PackageStatus;
  freshness: DataFreshness;
}

export interface ShowcaseMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface ShowcaseLensState {
  id: "operations" | "safety" | "weather" | "tourism";
  label: string;
  summary: string;
}

export interface ShowcaseMapPosition {
  x: number;
  y: number;
}

export interface ShowcaseCorridorStory {
  id: string;
  label: string;
  focusAreas: string[];
  lensId: ShowcaseLensState["id"];
  status: ExecutiveStatus;
  summary: string;
  action: string;
  signalLabel: string;
  signalValue: string;
  mapPosition: ShowcaseMapPosition;
}

export interface ShowcaseScenarioCard {
  scenario: Exclude<GovernorScenarioId, "live">;
  label: string;
  kicker: string;
  posture: ExecutiveStatus;
  summary: string;
  highlights: string[];
  href: string;
}

export interface ShowcaseProofPoint {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface ShowcaseReliabilityItem {
  id: string;
  label: string;
  mode: FeedMode | "degraded";
  freshnessLabel: string;
  detail: string;
}

export interface ShowcasePayload {
  generatedAt: string;
  hero: {
    eyebrow: string;
    title: string;
    summary: string;
    metrics: ShowcaseMetric[];
  };
  signature: {
    title: string;
    summary: string;
    corridors: ShowcaseCorridorStory[];
    lenses: ShowcaseLensState[];
  };
  scenarios: ShowcaseScenarioCard[];
  proof: {
    title: string;
    summary: string;
    points: ShowcaseProofPoint[];
  };
  reliability: {
    title: string;
    summary: string;
    items: ShowcaseReliabilityItem[];
  };
  routes: {
    warRoom: string;
    scenarioLinks: Array<{
      scenario: Exclude<GovernorScenarioId, "live">;
      href: string;
    }>;
  };
}

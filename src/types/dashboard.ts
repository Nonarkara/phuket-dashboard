import type {
  Feature,
  FeatureCollection,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";

export type Coordinates = [number, number];

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
}

export interface ApiSourceResponse {
  generatedAt: string;
  sources: ApiSourceEntry[];
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
}

export interface GovernorBrief {
  generatedAt: string;
  scenario: GovernorScenarioId;
  posture: GovernorPosture;
  topConcerns: GovernorConcern[];
  corridorPriorities: GovernorCorridorPriority[];
  nextActions: string[];
  sources: string[];
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
}

export interface MarineStatusResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  corridors: MarineCorridorStatus[];
  sources: string[];
  upgrades: string[];
}

export interface CityVibeCard {
  id: string;
  label: string;
  status: ExecutiveStatus;
  summary: string;
  whyNow: string;
  score: number;
  cameraFreshness: string;
  trendTraffic: string;
  tvCoverage: string;
  mobilityPressure: string;
  recommendedAction: string;
  sources: string[];
  updatedAt: string;
}

export interface CityVibesResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  zones: CityVibeCard[];
  sources: string[];
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
}

export interface MediaWatchResponse {
  generatedAt: string;
  scenario: GovernorScenarioId;
  postureSummary: string;
  peopleTalkAbout: NarrativeSignal[];
  peopleShare: NarrativeSignal[];
  broadcastWatch: NarrativeSignal[];
  sources: string[];
}

export interface PhuketVisitorOrigin {
  rank: number;
  countryCode: string;
  country: string;
  logo: string;
  gdpPerCapitaUsd: number | null;
  year: number | null;
  source: string;
}

export interface PhuketVisitorOriginsResponse {
  generatedAt: string;
  origins: PhuketVisitorOrigin[];
  sources: string[];
}

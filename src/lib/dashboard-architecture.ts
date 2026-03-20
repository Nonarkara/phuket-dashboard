export type ArchitectureSectionId =
  | "overview"
  | "flow"
  | "internal-apis"
  | "external-providers"
  | "runtime";

export type ArchitectureLayerTone =
  | "client"
  | "api"
  | "fusion"
  | "storage"
  | "external";

export type InternalApiCategory =
  | "System"
  | "Mapping"
  | "Environment"
  | "Operations"
  | "Analytics"
  | "Intelligence";

export type ExternalProviderCategory =
  | "News"
  | "Environmental"
  | "Mobility"
  | "Markets"
  | "Tourism & Civic"
  | "Mapping & Media"
  | "Optional";

export interface ArchitectureSection {
  id: ArchitectureSectionId;
  label: string;
  description: string;
}

export interface DashboardSurface {
  id: string;
  title: string;
  summary: string;
}

export interface ArchitectureLayer {
  id: string;
  title: string;
  tone: ArchitectureLayerTone;
  summary: string;
  bullets: string[];
}

export interface ArchitectureFlowStep {
  id: string;
  title: string;
  summary: string;
  outputs: string[];
}

export interface InternalApiDescriptor {
  path: string;
  category: InternalApiCategory;
  purpose: string;
  consumers: string[];
  upstreams: string[];
  fallback: string;
}

export interface ExternalProviderDescriptor {
  id: string;
  label: string;
  category: ExternalProviderCategory;
  description: string;
  surfaces: string[];
  endpoints: string[];
  optional?: boolean;
}

export const architectureSections: ArchitectureSection[] = [
  {
    id: "overview",
    label: "Overview",
    description: "UI surfaces, core layers, and the dashboard boundary.",
  },
  {
    id: "flow",
    label: "Data Flow",
    description: "How signals move from providers into curated operator views.",
  },
  {
    id: "internal-apis",
    label: "Internal APIs",
    description: "Every Next.js route exposed by this dashboard.",
  },
  {
    id: "external-providers",
    label: "External APIs",
    description: "All upstream services, feeds, tile servers, and optional enrichers.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Live service posture, storage, cache, and failover behavior.",
  },
];

export const dashboardSurfaces: DashboardSurface[] = [
  {
    id: "top-bar",
    title: "Top Bar",
    summary:
      "Governor posture, executive concern tiles, visitor origins, and entry points for the manual, architecture view, and database explorer.",
  },
  {
    id: "sidebar",
    title: "Sidebar",
    summary:
      "Governor concerns, intervention queue, and island command context.",
  },
  {
    id: "map",
    title: "Island Command Map",
    summary:
      "DeckGL and raster overlays for Phuket corridors, disaster alerts, AIS traffic, tourism hotspots, satellite imagery, flights, rainfall, AQI, and PM2.5.",
  },
  {
    id: "bottom-strip",
    title: "Bottom Analytics Strip",
    summary:
      "Markets, local trends, trending keywords, and source health for rapid cross-checking.",
  },
  {
    id: "intel-rail",
    title: "Intelligence Rail",
    summary:
      "Briefing packages, live regional TV embeds, and curated news extracted from the intelligence fusion layer.",
  },
  {
    id: "modal-layer",
    title: "Operator Overlays",
    summary:
      "Manual, architecture, and database-explorer modals that explain the system and expose stored data.",
  },
];

export const architectureLayers: ArchitectureLayer[] = [
  {
    id: "client",
    title: "Client Surfaces",
    tone: "client",
    summary:
      "React client components render the map, sidebars, charts, ticker, and modal overlays.",
    bullets: [
      "TopBar, map surface, Sidebar, BriefingPanel, NewsDesk, EconomicMonitor, ConflictTrends, TrendingKeywords, SignalTicker.",
      "The browser only talks to internal `/api/*` routes and local static assets.",
      "Modal documentation lives in the same app shell so operators do not leave the dashboard.",
    ],
  },
  {
    id: "api",
    title: "Internal API Layer",
    tone: "api",
    summary:
      "Next.js route handlers normalize all browser requests behind one controlled surface.",
    bullets: [
      "Routes cover environment, incidents, markets, intelligence, overlays, convergence, and health.",
      "Components fetch curated internal payloads instead of calling external providers directly.",
      "Fallback payloads keep panels rendering when upstreams or storage are unavailable.",
    ],
  },
  {
    id: "fusion",
    title: "Fusion and Scoring Layer",
    tone: "fusion",
    summary:
      "Library modules join siloed sources into news, tickers, package briefs, overlays, and area convergence.",
    bullets: [
      "`src/lib/intelligence.ts` deduplicates feeds, scores severity and freshness, and emits briefing/news/ticker/source views.",
      "`src/lib/convergence.ts` fuses incidents, news, markets, rainfall, thermal, and movement into area posture.",
      "`src/lib/map-overlays.ts` and `src/services/map-engine.ts` define overlay catalogs and render layers.",
    ],
  },
  {
    id: "storage",
    title: "Storage and Cache Layer",
    tone: "storage",
    summary:
      "The app uses Postgres when available and falls back to in-memory or curated static data when it is not.",
    bullets: [
      "Operational tables include `events`, `fire_events`, `rainfall_data`, `population_movements` as a legacy movement cache, `market_data`, `air_quality_snapshots`, and `macro_country_snapshots`.",
      "Intelligence and convergence use memory or hybrid cache paths to avoid hard failures during upstream outages.",
      "Static assets include regional GeoJSON, manual screenshots, and deterministic overlay catalogs.",
    ],
  },
  {
    id: "external",
    title: "External Provider Layer",
    tone: "external",
    summary:
      "Weather, air quality, mobility, finance, RSS, imagery, and optional AI/media services feed the app.",
    bullets: [
      "External providers are never called directly from the map or charts; the server mediates them first.",
      "Raster tile services such as NASA GIBS, ESRI, OSM, and optional Mapbox feed the map base and analytic layers.",
      "Optional services such as OpenAI and Mapbox enrich the system without being required for baseline operation.",
    ],
  },
];

export const architectureFlowSteps: ArchitectureFlowStep[] = [
  {
    id: "operator-action",
    title: "Operator interaction",
    summary:
      "A panel loads or refreshes after the operator opens the dashboard, changes overlays, or requests a detail view.",
    outputs: ["UI event", "local state update", "internal fetch request"],
  },
  {
    id: "route-entry",
    title: "Internal route entry",
    summary:
      "The browser calls a local `/api/*` endpoint instead of reaching out to third-party providers directly.",
    outputs: ["route handler", "request timeout guards", "typed JSON response contract"],
  },
  {
    id: "loaders",
    title: "Loader fan-out",
    summary:
      "Route handlers call loaders in `lib/` or `services/` that pull from Postgres, cached payloads, or remote APIs.",
    outputs: ["database reads", "external fetches", "fallback selection"],
  },
  {
    id: "normalization",
    title: "Normalization and fusion",
    summary:
      "The app deduplicates, scores, tags, and reshapes raw inputs into route-specific payloads.",
    outputs: ["curated news", "ticker items", "overlay catalog", "convergence alerts"],
  },
  {
    id: "resilience",
    title: "Resilience pass",
    summary:
      "If live data is missing or stale, the route substitutes cache-backed or curated fallback payloads.",
    outputs: ["stale-safe payload", "no blank panels", "graceful degradation"],
  },
  {
    id: "render",
    title: "Render and inspect",
    summary:
      "Client components render the curated payloads into charts, cards, map layers, and operator documentation.",
    outputs: ["visual insight", "tooltips", "selected-place popup", "operator-facing explanation"],
  },
];

export const resiliencePatterns = [
  "Every external fetch path is wrapped with a timeout and a fallback branch.",
  "Mapbox is optional. The map can still run with NASA GIBS, ESRI, OSM, and gradient fallback backgrounds.",
  "Intelligence and convergence can serve cached or synthesized payloads when feeds fail.",
  "Database-backed routes degrade to mock snapshots instead of returning empty screens.",
  "Overlay metadata is generated locally, so control surfaces stay usable even when imagery providers are slow.",
];

export const storageNotes = [
  "Primary operational storage: Postgres via `query()` in `src/lib/db.ts`.",
  "Primary operational tables: `events`, `fire_events`, `rainfall_data`, `population_movements` as a legacy movement cache, `market_data`, `air_quality_snapshots`, and `macro_country_snapshots`.",
  "Hybrid caches: intelligence cache and area convergence snapshots.",
  "Static assets: `public/data/*.geojson`, `public/manual/*`, and generated overlay catalog metadata.",
  "Runtime feature gates: `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `OPENAI_API_KEY`, `FIRMS_KEY`.",
];

export const internalApiCategoryOrder: InternalApiCategory[] = [
  "System",
  "Mapping",
  "Environment",
  "Operations",
  "Analytics",
  "Intelligence",
];

export const internalApiCatalog: InternalApiDescriptor[] = [
  {
    path: "/api/status",
    category: "System",
    purpose:
      "Reports runtime posture for database, basemap, satellite toolkit, cache mode, and AI summary configuration.",
    consumers: ["Architecture modal", "ops diagnostics", "external health checks"],
    upstreams: ["Environment configuration", "Mapbox token guard"],
    fallback: "Returns service states such as `fallback` or `missing` instead of failing.",
  },
  {
    path: "/api/sources",
    category: "System",
    purpose:
      "Builds the source-health view for upstream feeds and satellite toolkit providers.",
    consumers: ["SourceStack"],
    upstreams: ["`buildEnhancedSourceCatalog()`", "satellite toolkit registry", "intelligence feed health checks"],
    fallback: "Returns `fallbackSources` if source inspection fails.",
  },
  {
    path: "/api/data/catalog",
    category: "System",
    purpose:
      "Returns the curated list of database tables exposed for in-app preview and export.",
    consumers: ["DatabaseExplorerModal"],
    upstreams: ["Postgres table summaries"],
    fallback:
      "Returns an empty catalog with `databaseConfigured: false` when the database is not available.",
  },
  {
    path: "/api/data/table",
    category: "System",
    purpose:
      "Returns a limited preview of an allowlisted database table for in-app inspection.",
    consumers: ["DatabaseExplorerModal"],
    upstreams: ["Postgres table preview queries"],
    fallback:
      "Returns an empty preview when the database is not configured and rejects unknown table ids.",
  },
  {
    path: "/api/data/export",
    category: "System",
    purpose:
      "Exports an allowlisted database table as CSV or JSON using the same curated columns shown in the explorer.",
    consumers: ["DatabaseExplorerModal", "operators exporting snapshots"],
    upstreams: ["Postgres export queries"],
    fallback:
      "Returns `503` when the database is not configured and rejects unknown table ids or formats.",
  },
  {
    path: "/api/map/overlays",
    category: "Mapping",
    purpose:
      "Exposes the overlay catalog, default basemap choice, and overlay metadata used by operator controls.",
    consumers: ["SourceStack", "API clients"],
    upstreams: ["`buildMapOverlayCatalog()`"],
    fallback: "Deterministic local generation, no remote dependency required.",
  },
  {
    path: "/api/copernicus/preview",
    category: "Mapping",
    purpose:
      "Summarizes base imagery options and focus date for imagery preview clients.",
    consumers: ["API clients", "imagery diagnostics"],
    upstreams: ["Overlay catalog"],
    fallback: "Returns `fallbackCopernicusPreview` when catalog generation fails.",
  },
  {
    path: "/api/governor/brief",
    category: "Intelligence",
    purpose:
      "Builds the governor-facing island posture, top concerns, corridor priorities, and next-action list.",
    consumers: ["TopBar", "Sidebar", "BriefingPanel", "SignalTicker"],
    upstreams: [
      "Marine status",
      "Disaster brief",
      "Maritime security",
      "Tourism hotspots",
      "Media watch",
      "City vibes",
      "OpenSky posture",
      "Local incidents",
    ],
    fallback:
      "Scenario-safe and curated fallback logic keeps the executive briefing populated when live feeds degrade.",
  },
  {
    path: "/api/environment",
    category: "Environment",
    purpose:
      "Provides top-bar capital-city temperature and AQI snapshots across Southeast Asia.",
    consumers: ["TopBar"],
    upstreams: ["Open-Meteo weather", "Open-Meteo air quality"],
    fallback: "Merges in curated capital-city fallback values when live calls return null.",
  },
  {
    path: "/api/air-quality",
    category: "Environment",
    purpose:
      "Provides AQI and PM2.5 station data for air-quality heatmaps and map tooltips.",
    consumers: ["Map surface"],
    upstreams: ["Open-Meteo air quality", "Postgres `air_quality_snapshots`"],
    fallback:
      "Returns the latest stored station snapshots when live calls fail, then curated southern Thailand station values as a final fallback.",
  },
  {
    path: "/api/rainfall",
    category: "Environment",
    purpose:
      "Returns rainfall anomaly points mapped onto Phuket- and Andaman-relevant locations.",
    consumers: ["Map surface", "convergence scoring"],
    upstreams: ["Postgres `rainfall_data`"],
    fallback: "Returns `fallbackRainfall` when the database is empty or unavailable.",
  },
  {
    path: "/api/disaster/brief",
    category: "Environment",
    purpose:
      "Builds the Phuket disaster posture from TMD / NDWC warnings, GISTDA configuration, and rainfall-aware fallback logic.",
    consumers: ["Governor briefing", "Map surface", "corridor dossier"],
    upstreams: ["TMD warning feed", "optional GISTDA disaster API", "configured GISTDA layer catalog"],
    fallback:
      "Returns governor-readable fallback alerts and configured layer descriptors when live warning payloads are missing.",
  },
  {
    path: "/api/incidents",
    category: "Operations",
    purpose:
      "Delivers geocoded incident features for the map, sidebar, and incident-driven intelligence.",
    consumers: ["Map surface", "Sidebar", "convergence scoring"],
    upstreams: ["Postgres `events` via `loadThailandIncidents()`"],
    fallback: "Returns `fallbackIncidents` when the event store is unavailable.",
  },
  {
    path: "/api/fires",
    category: "Operations",
    purpose:
      "Returns thermal hotspot events for fire layers and local thermal evidence.",
    consumers: ["Map surface", "convergence scoring"],
    upstreams: ["Postgres `fire_events`"],
    fallback: "Returns `fallbackFires` on query failure or empty result.",
  },
  {
    path: "/api/movements",
    category: "Operations",
    purpose:
      "Provides curated visitor-flow traces for airport, town, beach, and pier movement overlays.",
    consumers: ["Map surface", "convergence scoring"],
    upstreams: ["Curated fallback movement traces", "legacy `population_movements` cache"],
    fallback: "Returns `fallbackRefugees` as a local visitor-flow stand-in when no live mobility feed is configured.",
  },
  {
    path: "/api/transit/pksb",
    category: "Operations",
    purpose:
      "Returns Phuket Smart Bus route geometry and stop locations for the PKSB transit overlay.",
    consumers: ["Map surface"],
    upstreams: [
      "smartbus.phuket.cloud route GeoJSON",
      "smartbus.phuket.cloud stop GeoJSON",
    ],
    fallback: "Uses checked-in PKSB GeoJSON snapshots when the public tracker is unavailable.",
  },
  {
    path: "/api/public-cameras",
    category: "Operations",
    purpose:
      "Returns curated Phuket public camera locations and source links for beach, bay, and traffic monitoring.",
    consumers: ["Map surface"],
    upstreams: ["Curated public camera source list"],
    fallback: "Returns the bundled camera catalog.",
  },
  {
    path: "/api/marine",
    category: "Operations",
    purpose:
      "Builds Phuket-focused marine corridor weather posture using Open-Meteo Marine, forecast data, and TMD warning overlays.",
    consumers: ["Governor briefing", "corridor dossier", "SignalTicker"],
    upstreams: ["Open-Meteo Marine", "Open-Meteo forecast", "TMD warning feed"],
    fallback: "Returns scenario-safe or curated marine corridors when live marine weather fails.",
  },
  {
    path: "/api/maritime/security",
    category: "Operations",
    purpose:
      "Builds the Phuket-Andaman AIS picture for ferry lanes, anchorage pressure, and suspicious or slow vessel watch.",
    consumers: ["Map surface", "corridor dossier", "source health"],
    upstreams: ["MarineTraffic or AISHub when configured", "curated fallback vessel patterns"],
    fallback:
      "Returns fallback vessel contacts and chokepoints when no AIS provider is configured or the provider is unavailable.",
  },
  {
    path: "/api/flights",
    category: "Operations",
    purpose:
      "Provides live or fallback regional flight tracks for air-traffic context.",
    consumers: ["Map surface"],
    upstreams: ["OpenSky states API"],
    fallback: "Returns curated fallback flights when OpenSky is unavailable.",
  },
  {
    path: "/api/conflict-trends",
    category: "Analytics",
    purpose:
      "Builds the by-area and fatality trend panels from recent event history.",
    consumers: ["ConflictTrends"],
    upstreams: ["Postgres `events`"],
    fallback: "Returns a packaged regional trend snapshot if queries fail.",
  },
  {
    path: "/api/trends",
    category: "Analytics",
    purpose:
      "Tracks conflict-related Google Trends signals across Thailand, Cambodia, and Myanmar.",
    consumers: ["TrendingKeywords"],
    upstreams: ["Google Trends RSS", "curated conflict terms"],
    fallback: "Returns the curated term set if RSS fetches fail.",
  },
  {
    path: "/api/city-vibes",
    category: "Analytics",
    purpose:
      "Scores Patong, Old Town, the airport corridor, ports, Ao Nang, and Khao Lak using cameras, narrative, marine, and access cues.",
    consumers: ["TrendingKeywords", "Governor briefing"],
    upstreams: ["Public cameras", "Media watch", "Marine status", "OpenSky posture", "local incidents"],
    fallback:
      "Returns blended city-vibe scoring from the governor heuristics even when one or more upstream feeds degrade.",
  },
  {
    path: "/api/markets",
    category: "Analytics",
    purpose:
      "Returns the market radar payload used by the economic monitor panel.",
    consumers: ["EconomicMonitor"],
    upstreams: [
      "Satellite toolkit registry",
      "ER API FX rates",
      "Binance BTC ticker",
      "World Bank GDP and GDP per capita",
      "Postgres `market_data` and `macro_country_snapshots`",
    ],
    fallback:
      "Returns the latest stored market and macro snapshots when live feeds fail, then falls back to packaged market and ASEAN GDP values.",
  },
  {
    path: "/api/economics",
    category: "Analytics",
    purpose:
      "Exposes an alternate market/economic endpoint that prefers direct source feeds and then local DB history.",
    consumers: ["API clients", "future analytics views"],
    upstreams: ["Direct market loaders", "Postgres `market_data`"],
    fallback: "Returns `fallbackEconomicIndicators` if both live and DB-backed loaders fail.",
  },
  {
    path: "/api/tourism/hotspots",
    category: "Analytics",
    purpose:
      "Builds the governor's tourism hotspot list for Patong, Old Town, the airport corridor, ports, Ao Nang, and Khao Lak.",
    consumers: ["Map surface", "corridor dossier", "Governor briefing"],
    upstreams: ["TAT Data API when configured", "curated tourism hotspot fallback"],
    fallback:
      "Returns a curated hotspot slate when TAT is unavailable or not yet configured.",
  },
  {
    path: "/api/visitor-origins",
    category: "Analytics",
    purpose:
      "Returns Phuket's top feeder countries and GDP per capita for the executive top bar.",
    consumers: ["TopBar"],
    upstreams: ["World Bank WDI", "curated Phuket origin ranking"],
    fallback:
      "Returns a Phuket-specific fallback feeder-country list when live macro data fails.",
  },
  {
    path: "/api/intelligence/packages",
    category: "Intelligence",
    purpose:
      "Builds the package-level intelligence view that powers briefing panels and downstream derived products.",
    consumers: ["BriefingPanel", "convergence scoring", "API clients"],
    upstreams: ["RSS and JSON feeds", "direct market feeds", "Postgres incidents/weather/movement/fire", "intelligence cache"],
    fallback: "Serves cache-backed or synthesized stale payloads rather than dropping the briefing surface.",
  },
  {
    path: "/api/news",
    category: "Intelligence",
    purpose:
      "Builds the curated important-news stream derived from scored intelligence packages.",
    consumers: ["NewsDesk"],
    upstreams: ["Intelligence packages"],
    fallback: "Returns `fallbackNews` if curation fails.",
  },
  {
    path: "/api/ticker",
    category: "Intelligence",
    purpose:
      "Builds the bottom ticker with cross-domain alert snippets and market deltas.",
    consumers: ["SignalTicker"],
    upstreams: ["Intelligence packages"],
    fallback: "Returns `fallbackTicker` if ticker synthesis fails.",
  },
  {
    path: "/api/media-watch",
    category: "Intelligence",
    purpose:
      "Fuses Google Trends, GDELT, and the TV wall into public-talk, public-share, and broadcast-watch signals.",
    consumers: ["NewsDesk", "TrendingKeywords", "Governor briefing"],
    upstreams: ["Google Trends RSS TH", "GDELT DOC 2", "live TV channel roster"],
    fallback:
      "Returns scenario-safe or curated talk/share/broadcast signals if live narrative sources fail.",
  },
  {
    path: "/api/briefings/latest",
    category: "Intelligence",
    purpose:
      "Returns the highest-priority briefing card for external clients or future pinned views.",
    consumers: ["API clients", "future pinned briefing views"],
    upstreams: ["Intelligence packages"],
    fallback: "Returns `fallbackBriefing` if briefing synthesis fails.",
  },
  {
    path: "/api/intelligence/convergence",
    category: "Intelligence",
    purpose:
      "Scores area-level convergence and returns posture, alerts, evidence, and data gaps.",
    consumers: ["ConvergenceAlerts", "API clients"],
    upstreams: ["Incidents", "intelligence packages", "markets", "rainfall", "fires", "movements", "convergence cache"],
    fallback: "Serves cached or monitor-state snapshots when fresh corroboration is weak or delayed.",
  },
];

export const externalProviderCategoryOrder: ExternalProviderCategory[] = [
  "News",
  "Environmental",
  "Mobility",
  "Markets",
  "Tourism & Civic",
  "Mapping & Media",
  "Optional",
];

export const externalProviderCatalog: ExternalProviderDescriptor[] = [
  {
    id: "bangkok-post-rss",
    label: "Bangkok Post RSS",
    category: "News",
    description: "Thailand-focused reporting feed used in intelligence package scoring.",
    surfaces: ["Briefing packages", "important news", "source health"],
    endpoints: ["https://www.bangkokpost.com/rss/data/news.xml"],
  },
  {
    id: "channel-newsasia-rss",
    label: "Channel NewsAsia RSS",
    category: "News",
    description: "Regional Asia reporting feed used in intelligence package scoring.",
    surfaces: ["Briefing packages", "important news", "source health"],
    endpoints: ["https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml"],
  },
  {
    id: "nikkei-asia-rss",
    label: "Nikkei Asia RSS",
    category: "News",
    description: "Asia business and policy feed used in market/logistics intelligence packages.",
    surfaces: ["Briefing packages", "source health"],
    endpoints: ["https://info.asia.nikkei.com/rss"],
  },
  {
    id: "bbc-world-rss",
    label: "BBC World RSS",
    category: "News",
    description: "Global reporting feed used as a high-trust external corroboration source.",
    surfaces: ["Briefing packages", "important news", "source health"],
    endpoints: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
  },
  {
    id: "guardian-world-rss",
    label: "Guardian World RSS",
    category: "News",
    description: "World news feed used to broaden package coverage and corroboration.",
    surfaces: ["Briefing packages", "important news", "source health"],
    endpoints: ["https://www.theguardian.com/world/rss"],
  },
  {
    id: "city-reporter-bot",
    label: "City Reporter Bot",
    category: "News",
    description: "JSON news endpoint used as an internal-style live reference feed.",
    surfaces: ["Briefing packages", "important news", "source health"],
    endpoints: ["https://city-reporter-bot.onrender.com/api/news"],
  },
  {
    id: "google-news-rss",
    label: "Google News RSS Search",
    category: "News",
    description: "Query-based RSS searches used to widen intelligence coverage around local operating terms.",
    surfaces: ["Briefing packages"],
    endpoints: ["https://news.google.com/rss/search?q=..."],
  },
  {
    id: "rss2json",
    label: "RSS2JSON Fallback",
    category: "News",
    description: "Feed parsing fallback for RSS sources that need JSON conversion.",
    surfaces: ["Intelligence parser fallback"],
    endpoints: ["https://api.rss2json.com/v1/api.json?rss_url=..."],
  },
  {
    id: "open-meteo-weather",
    label: "Open-Meteo Forecast",
    category: "Environmental",
    description: "Current weather feed used for top-bar regional temperature snapshots.",
    surfaces: ["TopBar"],
    endpoints: ["https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current_weather=true"],
  },
  {
    id: "open-meteo-air-quality",
    label: "Open-Meteo Air Quality",
    category: "Environmental",
    description: "AQI and PM2.5 provider for the top bar and the new air-quality heatmaps.",
    surfaces: ["TopBar", "AQI heatmap", "PM2.5 heatmap"],
    endpoints: ["https://air-quality-api.open-meteo.com/v1/air-quality?latitude=...&longitude=...&current=us_aqi,pm2_5"],
  },
  {
    id: "gistda-disaster",
    label: "GISTDA Disaster Platform",
    category: "Environmental",
    description:
      "Thai disaster and satellite platform used for flood/fire overlays, disaster posture, and NSDC-linked imagery upgrades.",
    surfaces: ["Disaster brief", "source health", "future GISTDA overlays"],
    endpoints: [
      "https://disaster.gistda.or.th/services/open-api",
      "https://nsdc.gistda.or.th",
    ],
  },
  {
    id: "tmd-ndwc",
    label: "TMD / NDWC Alerts",
    category: "Environmental",
    description:
      "Thai warning feeds used for rough-sea, heavy-rain, and tsunami-linked alert posture.",
    surfaces: ["Disaster brief", "marine corridor posture", "source health"],
    endpoints: [
      "https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=api&ukey=api12345",
    ],
  },
  {
    id: "opensky",
    label: "OpenSky Network",
    category: "Mobility",
    description: "Regional state vector feed for live aircraft tracks.",
    surfaces: ["Flight paths overlay"],
    endpoints: ["https://opensky-network.org/api/states/all?lamin=...&lomin=...&lamax=...&lomax=..."],
  },
  {
    id: "marinetraffic",
    label: "MarineTraffic / AISHub",
    category: "Mobility",
    description:
      "AIS vessel providers used for ferry-lane density, anchorage pressure, and suspicious-contact watch around Phuket and the Andaman ring.",
    surfaces: ["AIS vessel overlay", "marine security dossier", "source health"],
    endpoints: [
      "https://servicedocs.marinetraffic.com",
      "https://www.aishub.net/api",
    ],
    optional: true,
  },
  {
    id: "satellite-toolkit",
    label: "DrNon Global Satellite Toolkit",
    category: "Mapping & Media",
    description:
      "Comprehensive geospatial toolkit with 12 satellite overlays (VIIRS, MODIS, Sentinel-2, fire detection), 80+ space agency registry, multi-backend basemap fallback, distance grids, and NASA FIRMS thermal hotspot ingestion.",
    surfaces: ["Satellite imagery", "fire detection", "basemap fallback", "overlay catalog"],
    endpoints: [
      "https://github.com/Nonarkara/DrNon-Global-Satellite-Toolkit",
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/",
      "https://firms.modaps.eosdis.nasa.gov/api/",
    ],
  },
  {
    id: "er-api",
    label: "ER-API FX Rates",
    category: "Markets",
    description: "Foreign-exchange rates used for USD, THB, MMK, and EUR calculations.",
    surfaces: ["Economic monitor", "intelligence market signals"],
    endpoints: ["https://open.er-api.com/v6/latest/USD"],
  },
  {
    id: "binance",
    label: "Binance Ticker",
    category: "Markets",
    description: "BTC ticker used as a fast-moving risk and volatility reference.",
    surfaces: ["Economic monitor", "intelligence market signals"],
    endpoints: ["https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"],
  },
  {
    id: "world-bank-wdi",
    label: "World Bank WDI",
    category: "Markets",
    description:
      "Latest official annual GDP and GDP-per-capita series for ASEAN comparison in the market radar.",
    surfaces: ["Economic monitor"],
    endpoints: [
      "https://api.worldbank.org/v2/country/BRN;KHM;IDN;LAO;MYS;MMR;PHL;SGP;THA;VNM/indicator/NY.GDP.MKTP.CD?source=2&mrnev=1&format=json",
      "https://api.worldbank.org/v2/country/BRN;KHM;IDN;LAO;MYS;MMR;PHL;SGP;THA;VNM/indicator/NY.GDP.PCAP.CD?source=2&mrnev=1&format=json",
    ],
  },
  {
    id: "google-trends",
    label: "Google Trends RSS",
    category: "Markets",
    description: "Trending search RSS feeds used to detect local narrative momentum.",
    surfaces: ["Trending keywords"],
    endpoints: [
      "https://trends.google.com/trending/rss?geo=TH",
      "https://trends.google.com/trending/rss?geo=KH",
      "https://trends.google.com/trending/rss?geo=MM",
    ],
  },
  {
    id: "gdelt-doc-2",
    label: "GDELT DOC 2",
    category: "News",
    description:
      "Global news metadata API used for Phuket- and Andaman-linked shared coverage and narrative-watch signals.",
    surfaces: ["Media watch", "narrative watch", "corridor dossier"],
    endpoints: ["https://api.gdeltproject.org/api/v2/doc/doc?..."],
  },
  {
    id: "tat-data-api",
    label: "TAT Data API",
    category: "Tourism & Civic",
    description:
      "Tourism Authority of Thailand dataset used for Phuket attractions, events, and hotspot upgrades.",
    surfaces: ["Tourism hotspots", "governor briefing", "future tourism overlays"],
    endpoints: ["https://tatdataapi.io"],
    optional: true,
  },
  {
    id: "data-go-th",
    label: "data.go.th CKAN",
    category: "Tourism & Civic",
    description:
      "Thailand open-data portal used for Phuket civic, tourism, and infrastructure context layers.",
    surfaces: ["Source health", "foundation layers", "future static operational layers"],
    endpoints: ["https://data.go.th/api/3/action/package_search?q=phuket"],
  },
  {
    id: "nasa-gibs",
    label: "NASA GIBS WMTS",
    category: "Mapping & Media",
    description: "Imagery, rainfall, lights, vegetation, and aerosol raster layers for the map.",
    surfaces: ["Base imagery", "rainfall", "night lights", "vegetation", "aerosol optical depth"],
    endpoints: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/..."],
  },
  {
    id: "esri-world-imagery",
    label: "ESRI World Imagery",
    category: "Mapping & Media",
    description: "Token-free aerial imagery fallback for the map base layer.",
    surfaces: ["Aerial basemap"],
    endpoints: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  },
  {
    id: "openstreetmap",
    label: "OpenStreetMap Tiles",
    category: "Mapping & Media",
    description: "Token-free road and street tiles for infrastructure context.",
    surfaces: ["Street basemap"],
    endpoints: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  },
  {
    id: "youtube",
    label: "YouTube Embed",
    category: "Mapping & Media",
    description: "Regional live TV embeds used in the intelligence rail.",
    surfaces: ["Live TV panel"],
    endpoints: ["https://www.youtube.com/embed/..."],
  },
  {
    id: "mapbox",
    label: "Mapbox Styles API",
    category: "Optional",
    description: "Optional styled basemap service used only when a valid token is configured.",
    surfaces: ["Detailed or dark Mapbox basemap"],
    endpoints: ["https://api.mapbox.com/styles/v1/mapbox/..."],
    optional: true,
  },
  {
    id: "openai-responses",
    label: "OpenAI Responses API",
    category: "Optional",
    description: "Optional AI summarization and enrichment path for intelligence packages.",
    surfaces: ["AI summary enrichment"],
    endpoints: ["https://api.openai.com/v1/responses"],
    optional: true,
  },
];

export const architectureSummary = {
  internalApiCount: internalApiCatalog.length,
  externalProviderCount: externalProviderCatalog.length,
  uiSurfaceCount: dashboardSurfaces.length,
  architectureLayerCount: architectureLayers.length,
  optionalProviderCount: externalProviderCatalog.filter((provider) => provider.optional)
    .length,
};

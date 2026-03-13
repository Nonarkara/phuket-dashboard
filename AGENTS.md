# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Build and Run Commands

```bash
npm install          # Install frontend dependencies
npm run dev          # Start dev server on localhost:3000 (uses --webpack flag)
npm run build        # Production build (uses --webpack flag)
npm run start        # Start production server
npm run lint         # ESLint (eslint-config-next with core-web-vitals + typescript)
```

Database setup (requires psql + PostGIS):
```bash
./scripts/setup-db.sh                # Creates DB and applies db/schema.sql
./scripts/setup-db.sh my_db_name     # Custom DB name (default: geopolitics_db)
```

Python ingestion (optional, for populating Postgres):
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r ingestion/requirements.txt
python ingestion/firms_ingest.py     # NASA FIRMS fire data
python ingestion/acled_ingest.py     # ACLED conflict/incident data
python ingestion/hdx_ingest.py       # HDX humanitarian data
python ingestion/rainfall_ingest.py  # Rainfall observations
```

There are no test scripts configured; quality checks are `npm run lint` and `npm run build`.

## Architecture

### Frontend (Next.js 16 App Router, single-page client app)

The entire UI is a single client-rendered page (`src/app/page.tsx`, `"use client"`). The layout is a three-column grid: left sidebar (briefing, feeds), center map (deck.gl + Mapbox), right sidebar (news analysis), plus a bottom analytics strip and a signal ticker footer.

Key component groups:
- **`components/Map/BorderMap.tsx`** — The central deck.gl/Mapbox map. Fetches all data layers client-side from API routes. Manages raster overlay toggles, satellite imagery, and vector layers. Uses `next/dynamic` for SSR-disabled imports of `@deck.gl/react` and `react-map-gl/mapbox`.
- **`components/Intelligence/`** — TopBar, SignalTicker, NewsDesk, BriefingPanel, SourceStack, LiveTVPanel, and modal dialogs (architecture viewer, manual, database explorer).
- **`components/Analytics/`** — EconomicMonitor, ConflictTrends, TrendingKeywords, ProvinceDashboard (modal overlay for province deep-dive).
- **`components/Sidebar/`** — Sidebar nav, AseanEconomicsPanel, ConvergenceAlerts.

### Map Layers (`services/map-engine.ts`)

All deck.gl layer factories live here. Creates ScatterplotLayer (incidents, fires, flights, AQI stations), HeatmapLayer (incidents, rainfall, AQI), ArcLayer (visitor movements), GeoJsonLayer (borders, conflict zones), TileLayer (NASA GIBS raster imagery), TextLayer (province labels, flight callsigns, AQI values).

### API Routes (`src/app/api/`)

All routes are Next.js App Router route handlers (`export async function GET()`). Every route follows a three-tier data resolution pattern:
1. Try live external data (RSS feeds, Open-Meteo, ExchangeRate API, Binance, World Bank, NASA FIRMS, ACLED, reference dashboard).
2. Fall back to Postgres (`src/lib/db.ts` pool) if live fetch fails and `DATABASE_URL` is configured.
3. Fall back to static mock data (`src/lib/mock-data.ts`) if both are unavailable.

This means the app boots and renders with zero external dependencies configured.

Key routes:
- `/api/intelligence/packages` — Core intelligence pipeline. Fetches RSS from 7 Thai/Asian news sources + Google News search queries, scores items with keyword/freshness heuristics, groups into 4 thematic packages (marine-weather, tourism-demand, road-safety, cost-logistics), optionally summarizes with OpenAI Responses API.
- `/api/intelligence/convergence` — Cross-correlates incidents, news, markets, weather, thermal, and movement signals within a geographic corridor (Phuket/Andaman, 180km radius) using haversine distance and text alias matching.
- `/api/markets` — Live FX rates (USD/THB, SGD/THB, MYR/THB) + BTC/USD from reference dashboard discovery, plus ASEAN GDP from World Bank WDI. Persists snapshots to Postgres.
- `/api/air-quality` — Per-station AQI/PM2.5 from Open-Meteo for 12 locations (Phuket stations through Singapore). Persists snapshots.
- `/api/fires`, `/api/rainfall`, `/api/incidents` — DB-first with mock fallback.
- `/api/status` — Health check (used by Render).

### Intelligence System (`src/lib/intelligence.ts`)

This is the largest and most complex module. It orchestrates the full intelligence pipeline:
- Fetches and parses RSS/Atom feeds (custom XML parser, no external RSS library) and JSON feeds with a rss2json.com fallback.
- Scores items using keyword groups (tourism, weather, traffic, economy, mobility, marine, air) with tag-based weighting.
- Classifies severity (alert/watch/stable) by composite score thresholds.
- Builds 4 `IntelligencePackage` objects, each with ranked/deduped items, heuristic or AI-generated headlines, and stats.
- Uses a two-layer cache: in-memory snapshot + Postgres tables (`intelligence_package_snapshots`, `intelligence_items_cache`, `intelligence_source_health`). Cache TTL is 5 minutes.

### Convergence Engine (`src/lib/convergence.ts`)

Cross-family signal correlation for the Phuket/Andaman corridor. Builds evidence items from 6 families (incident, news, market, weather, thermal, movement), applies geographic filtering (haversine + text alias matching), scores with freshness decay, and adds convergence bonuses when multiple families reinforce. Produces a posture classification (priority/watch/monitor) and structured alerts.

### Data Persistence (`src/lib/history-store.ts`, `src/lib/intelligence-cache.ts`)

Optional Postgres persistence is used for:
- Intelligence package snapshots and source health
- Market indicators and ASEAN GDP snapshots
- Air quality station observations

All persistence is wrapped in try/catch — the app degrades gracefully to in-memory or mock data.

### Reference Data (`src/lib/reference-data.ts`)

Discovers external API endpoints via a reference dashboard at `REFERENCE_DASHBOARD_URL`. This dashboard provides FX rates, Binance ticker URLs, and API catalog information. Falls back to hardcoded default URLs.

### Database Schema (`db/schema.sql`)

PostGIS-enabled. Core tables: `events` (with geometry), `market_data`, `fire_events`, `rainfall_data`, `population_movements`, `air_quality_snapshots`, `macro_country_snapshots`, `country_economic_indicators`, plus intelligence cache tables.

### Styling

Light-mode-only design using Tailwind CSS v4 with CSS custom properties defined in `globals.css`. The design enforces zero border-radius and zero box-shadow globally via `data-surface="phuket-dashboard"` overrides. Key CSS classes: `.dashboard-panel`, `.eyebrow`, `.live-badge`, `.stale-badge`.

### Types

All shared types are in `src/types/dashboard.ts`. This is the single source of truth for data shapes across API routes, lib modules, and components.

## Key Patterns

- **Path alias**: `@/*` maps to `./src/*` (configured in both tsconfig.json and webpack).
- **deck.gl v9**: Requires explicit `luma.registerAdapters([webgl2Adapter])` and `transpilePackages` in `next.config.mjs`. DeckGL is dynamically imported with `{ ssr: false }`.
- **Graceful degradation**: Every data-fetching function has a try/catch chain: live → DB → mock. Never throw unhandled from API routes.
- **OpenAI integration**: Uses the Responses API (`/v1/responses`), not Chat Completions. Model defaults to `gpt-4.1-mini`. Used only for optional intelligence package headline/summary synthesis.
- **NASA GIBS imagery**: Hardcoded safe date (`2024-03-01`) for satellite tile requests because the simulated environment date may be ahead of actual GIBS availability.

## Environment Variables

Required for full functionality:
- `DATABASE_URL` — PostgreSQL connection string (PostGIS-enabled)
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — Mapbox basemap token

Optional:
- `FIRMS_KEY` — NASA FIRMS API key for fire ingestion
- `ACLED_KEY` / `ACLED_EMAIL` — ACLED conflict data API
- `REFERENCE_DASHBOARD_URL` — External reference feed (defaults to a public Render instance)
- `OPENAI_API_KEY` / `OPENAI_MODEL` — AI summary synthesis
- `REDIS_URL` — Redis cache layer (infrastructure exists but not heavily used)

The app runs without any env vars configured — all API routes serve fallback data.

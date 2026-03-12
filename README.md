# Phuket Dashboard

Map-first monitoring dashboard for Phuket and nearby provinces, focused on tourism demand, road safety, rainfall, monsoon pressure, air quality, mobility, and local economy. The frontend is a Next.js app; the data layer is PostgreSQL/PostGIS plus Python ingestion scripts. This repo was cloned from the Geopolitics Dashboard system and retargeted as a Phuket-focused starter.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Deck.gl + react-map-gl
- PostgreSQL + PostGIS
- Python ingestion for market, fire, rainfall, mobility, and reference datasets

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL with PostGIS installed
- Python 3.9+ if you want to run ingestion

## Environment

Create a local env file:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: public Mapbox token for basemaps
- `FIRMS_KEY`: NASA FIRMS key for live fire ingestion
- `REFERENCE_DASHBOARD_URL`: optional external reference feed for incidents, market cards, and trend adapters
- `OPENAI_API_KEY`: optional AI summary key for package headline/priority synthesis
- `OPENAI_MODEL`: optional Responses API model override for intelligence summaries

## Setup

Install frontend dependencies:

```bash
npm install
```

Initialize the database schema:

```bash
./scripts/setup-db.sh
```

If `psql` is not installed locally, run `db/schema.sql` in your managed PostgreSQL/PostGIS console instead.

Install ingestion dependencies if needed:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r ingestion/requirements.txt
```

## Run

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The UI can still render with fallback data if the database is not populated yet, and it can also pull incidents, package sources, and market cards from the external reference dashboard.

## Ingestion

Run whichever scripts you need:

```bash
python ingestion/acled_ingest.py
python ingestion/hdx_ingest.py
python ingestion/firms_ingest.py
python ingestion/rainfall_ingest.py
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Render Deployment

This repo now includes a root `render.yaml` for a single Render web service.

- Required for a real basemap: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- Optional for live backend data: `DATABASE_URL`
- If `DATABASE_URL` is omitted, the app still boots and the API routes serve fallback sample data

To deploy with the Blueprint flow, push the repo to GitHub, GitLab, or Bitbucket, then create the Render Blueprint from that repo.

## Data Flow

1. Python scripts fetch external data and write normalized rows to Postgres.
2. Next.js API routes combine Postgres data, RSS/search feeds, and reference APIs into cached intelligence packages.
3. React components fetch those routes and render map overlays, charts, package panels, and live signal cards.

## Database Notes

- Core longitudinal tables: `events`, `market_data`, `fire_events`, `rainfall_data`, `population_movements` as a legacy movement cache
- Live snapshot tables: `air_quality_snapshots`, `macro_country_snapshots`
- `/api/markets` now persists live FX/BTC reference indicators plus ASEAN GDP snapshots when `DATABASE_URL` is configured
- `/api/air-quality` now persists live AQI/PM2.5 station observations and falls back to the latest stored snapshots before using static defaults

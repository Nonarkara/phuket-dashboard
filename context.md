# Phuket Dashboard — Governor's War Room

## Live URL
https://phuket.nonarkara.org (GitHub Pages — static export)
Repo: https://github.com/Nonarkara/phuket-dashboard

## Stack
Next.js 16.1.6 + React 19.2.3 + TypeScript
Deck.gl 9.2.11 + Mapbox GL JS 3.19.1 + react-map-gl 8.1.0
PostgreSQL + PostGIS + Python ingestion
Tailwind CSS v4
**Node.js 20.x required** (`engines.node: "20.x"`)

## Dev
```bash
npm run dev          # localhost:3000, webpack mode, WATCHPACK_POLLING=true
npm run dev:3001     # Same on port 3001
npm run build        # Production build (webpack)
```

## Deploy — GitHub Pages (primary, automated)
CI runs `npm run build:static` → uploads `./out/` to GitHub Pages on push to main.
```bash
# Manual trigger:
gh workflow run "Deploy to GitHub Pages" -R Nonarkara/phuket-dashboard

# Or build locally:
npm run build:static   # → out/  (base path: /phuket-dashboard)
```

## Deploy — Cloudflare Workers (alternative)
```bash
npm run build:cf     # @opennextjs/cloudflare build → .open-next/
npm run deploy:cf    # build + wrangler pages deploy
# CF Workers API base: https://phuket-dashboard.drnon.workers.dev
```

## Env Vars
File: `shared/.secrets-backup/dashboards_phuket-dashboard_.env`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — Mapbox basemap
- `DATABASE_URL` — PostgreSQL+PostGIS connection string
- `REDIS_URL` — caching
- `FIRMS_KEY` — NASA FIRMS fire data
- `REFERENCE_DASHBOARD_URL` — optional external data feed
- `OPENAI_API_KEY` + `OPENAI_MODEL` — AI headline summaries (optional)

## Database
```bash
./scripts/setup-db.sh   # Init schema
# Or: run db/schema.sql directly in your PostgreSQL console
```

## Key Source Paths
- `src/app/` — App Router, WarRoomApp entry component
- `src/components/` — 12 subdirectories
- `src/lib/` — 44 files (AI narrative, dashboard architecture)
- `src/modules/` — 10 feature modules
- `ingestion/` — Python scripts (market, fire, rainfall, mobility)

## Notes
- Cloned from dashboards/geopolitics — shares architecture and component patterns.
- Static export uses NO basePath. `phuket.nonarkara.org` is a custom-domain Pages site served at root; `NEXT_PUBLIC_BASE_PATH=""`. (basePath `/phuket-dashboard` was WRONG and caused a CSS-404 outage — fixed 2026-05-28.)
- `scripts/static-export.mjs` runs a preflight: fails the build if any non-route file imports from `src/app/api/*/route`. Shared types go in `src/types/`.
- WATCHPACK_POLLING=true is required in dev for file system watch.
- next.config.mjs: Deck.gl/luma.gl all explicitly transpiled.

## 3D map + ML capacities (added 2026-05-28)
- **3D terrain** (`BorderMap.tsx` `applyBuilding3DLayer`): AWS Terrarium DEM + MapLibre `setTerrain` (exaggeration 1.4) + hillshade + sky/fog/light + OpenFreeMap building extrusion. All gated on the 2D/3D `View` toggle. deck.gl layers do NOT drape on MapLibre terrain — terrain-coupled features (hillshade, blackspots) are MapLibre layers.
- **Accident blackspots** (`src/data/phuket-blackspots.ts`): curated THAIRSC-corridor points (Patong Hill / Route 4029 "death descent", etc.), drawn as MapLibre circles so they sit on the slope. Click → governor info panel.
- **AlphaEarth urban fabric** (overlay "Urban fabric"): precompute offline →
  `uv run --python 3.11 ... ` not needed — runs on system py3.9 GEE:
  `python3 scripts/alphaearth-urban-fabric.py` → `public/data/phuket-urban-fabric.geojson` (812 polygons, 2025 embedding). GEE already authenticated. Refresh annually for new embedding year. Attribution: Google / Google DeepMind (CC-BY 4.0).
- **TimesFM crash-risk forecast** (panel in Governor's Daily Brief): precompute on M5 (needs Python 3.10+):
  `uv run --python 3.11 --with "timesfm[torch]" --with requests --with numpy python scripts/timesfm-forecast.py`
  → `public/data/phuket-accident-forecast.json` (48h). Model: TimesFM 2.0 500m. Source = THAIRSC time-of-day rhythm × Open-Meteo rain. Re-run on a schedule (cron) to refresh; Open-Meteo forecast API rate-limits (429) — script falls back to archive ERA5 + climatology. Live BigQuery `AI.FORECAST` is the documented future upgrade path.

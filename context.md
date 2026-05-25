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
- Static export uses basePath `/phuket-dashboard` (GitHub Pages requirement).
- WATCHPACK_POLLING=true is required in dev for file system watch.
- next.config.mjs: Deck.gl/luma.gl all explicitly transpiled.

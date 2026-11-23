# Phuket Dashboard

<p align="center">
  <img src="docs/hero-banner.png" alt="Civic-studio hero: a reader studies a glass tablet above Phuket’s bay. The tablet HUD is illustration only, not the shipped interface." width="100%" />
</p>

<p align="center"><em>Hero illustration for this civic studio. The glowing tablet HUD is artwork, not a screenshot of the product.</em></p>

A map-first civic operations instrument for Phuket. It holds tourism demand, marine weather, corridor friction, transit, and public-safety signals in one readable wall — then tells the truth about whether those signals are live, cached, modeled, or missing.

This is an independent **civic studio** product by [Dr Non Arkaraprasertkul](https://github.com/Nonarkara). It is a demonstration and research surface, not an official government system.

Public surfaces that already exist in this repo:

| Surface | Route | Role |
|---------|-------|------|
| **War Room** | `/` | Live operational instrument. Dark by default. |
| **Showcase** | `/showcase` | Narrative landing, design philosophy, evaluation path. |
| **Scenarios** | `?scenario=tourism-surge-weekend` · `red-monsoon-day` · `stable-recovery-day` | Deterministic demo states on either surface. `/war-room` permanently redirects to `/`. |

Live deployments documented in this repository: [phuket.nonarkara.org](https://phuket.nonarkara.org) (GitHub Pages static export) and [phuket-dashboard.drnon.workers.dev](https://phuket-dashboard.drnon.workers.dev) (Cloudflare Workers).

---

## What this is

Phuket is a coastal operating system: airport banks, hill roads, west-coast beaches, east-coast ports, and monsoon weather that can rewrite the day before noon. This dashboard is built so a governor-facing reader can glance once and know the posture — intervene, watch, or stable — then drill into a corridor without changing screens.

It is designed as a **72-inch 4K war-room wall** (3840×2160) first, a phone (375px) second. Desktop is the middle ground, not the origin.

What you get in the box:

- A map that *is* the page, not a widget inside a card grid.
- Corridor logic (Airport→Patong, Old Town, Chalong/Rassada, east-coast ports, west beaches) rather than a pile of disconnected layers.
- **The Slope Story** — click a documented accident blackspot and the argument appears as one chain: slope (SRTM) → toll (THAIRSC) → tonight (TimesFM) → why → act. Design record: [`docs/SLOPE-STORY.md`](docs/SLOPE-STORY.md).
- A scenario engine so a demo does not depend on whether the real world cooperates that morning.
- Graceful fallbacks. The app boots with no database, no Mapbox token, and no paid keys.

It is **not** a command-and-control system, a legal record, or a substitute for official briefings.

---

## Philosophy

**Policy without product is theater.** A slide deck about “smart Phuket” is not an instrument. This repo exists to make the operating picture *usable*.

The house rules, also stated on `/showcase`:

- **Clarity is the feature.** Size, weight, spacing, and opacity create reading order. If everything is the same size, it is unfinished.
- **Zero decoration.** No gradients, no drop shadows, no border-radius. Hairline borders. Every pixel should carry signal.
- **Operational language, not dashboard chrome.** Red means intervene. Amber means watch. Teal means stable. Same vocabulary on the map, the brief, and the ticker.
- **Honesty about knowledge.** Live, hybrid, modeled, degraded. Invisible tech is pleasant. Honest tech is the product.
- **The map stays whole.** Overlays sit inside the map, translucent, pinned to corners. Nothing cuts the island in half with a full-width bar.

The manga hero at the top of this README is the civic-studio frame: a person reading a place, not a vendor screenshot. The HUD drawn on that tablet is **illustration only**. The shipped UI is the war room and the showcase — tactical, flat, and labeled.

---

## Ethical use

This repository is **not** an official product of PAT, Phuket Provincial Administration, the Phuket Governor’s Office, the Tourism Authority of Thailand, or any other Thai public body — unless a later, written statement in this repo documents such a relationship. None is documented today.

Use it as a civic studio, a teaching instrument, a design reference, or a forkable starter. Do not use it to impersonate an official Phuket or PAT system.

Hard limits:

- **No implied mandate.** Shipping this code, or pointing at a public URL, does not confer operational authority.
- **No invented official data.** Numbers in scenario mode are modeled. Numbers from live feeds are only as good as those feeds. Treat both as *inputs to judgment*, not as orders.
- **Do not hide the source.** If you fork this for a public wall, keep this ethical-use notice, keep freshness/mode labels visible, and do not rebrand the product as an official PAT or provincial system unless you have documented authority.
- **Do not invent secrets.** Keys, tokens, and connection strings belong in local environment variables or your own secret store. This README lists *names* of optional variables only. It does not contain credentials.
- **The hero HUD is not the product.** Do not present the manga tablet as the live interface.

If you are an official and you want this on a real wall, treat it as a prototype that still needs your data-sharing agreements, your legal review, and your operators in the loop.

---

## How it works

```
feeds / APIs / RSS
        ↓
Next.js App Router  (`src/app/api/*`)
        ↓
resolution ladder:  live → database → cache → scenario → reference → unavailable
        ↓
War Room (`/`)  ·  Showcase (`/showcase`)
        ↓
deck.gl + Mapbox/MapLibre map  +  panels that never lie about freshness
```

**Frontend.** Next.js 16 App Router, React 19, TypeScript. The war room is a client instrument around `BorderMap` (deck.gl + Mapbox/MapLibre). Webpack is required — Turbopack does not transpile deck.gl the way this repo needs.

**Data.** Optional PostgreSQL/PostGIS (`db/schema.sql`) and Python ingestion under `ingestion/`. When `DATABASE_URL` is unset, routes fall through to in-memory cache, scenario payloads, reference feeds, or static fallbacks. That is intentional.

**Scenario engine.** `src/lib/scenario.ts` can freeze the wall into one of three modeled days so a demo is repeatable.

**Modules.** `src/modules/` holds optional integrations (earth observation, air/orbital traffic, environmental, Thai transit and traffic). Each module is expected to degrade; a missing key should not blank the wall.

**Signature analysis.** Terrain (SRTM), corridor blackspots (`src/data/phuket-blackspots.ts`), and the TimesFM night-risk card meet in The Slope Story. Those slope degrees are measured, not invented. Re-derive with `scripts/blackspot-slopes.mjs` if you change the points.

---

## How to run / fork

### Prerequisites

- Node.js 20.x
- npm
- PostgreSQL + PostGIS only if you want the optional database
- Python 3.9+ only if you want ingestion scripts

### Install and run

```bash
git clone https://github.com/Nonarkara/phuket-dashboard.git
cd phuket-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The war room should render on fallback/scenario data with no environment file.

Optional database:

```bash
./scripts/setup-db.sh
# or apply db/schema.sql in your own PostGIS console
```

Optional ingestion (after `python3 -m venv venv && source venv/bin/activate && pip install -r ingestion/requirements.txt`):

```bash
python ingestion/firms_ingest.py
python ingestion/rainfall_ingest.py
python ingestion/acled_ingest.py
python ingestion/hdx_ingest.py
```

### Optional environment names

Create a local `.env` if you have credentials. **Do not commit it.** `.env*` is gitignored. This repo does not ship example secret values.

| Name | Role |
|------|------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Public Mapbox basemap token. Falls back to OSM/ESRI-style tiles when unset. |
| `DATABASE_URL` | PostgreSQL connection string. Optional. |
| `FIRMS_KEY` | NASA FIRMS live fire ingest. Optional. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional headline synthesis for intelligence packages. |
| `REFERENCE_DASHBOARD_URL` | Optional external reference feed. |
| `REDIS_URL` | Optional cache. |

The app is built to boot when these are absent. Do not paste tokens into issues, pull requests, or this file.

### Quality and deploy scripts

```bash
npm run lint
npm run build          # next build --webpack
npm run build:static   # GitHub Pages export → ./out
npm run build:cf       # Cloudflare (@opennextjs/cloudflare)
```

`render.yaml` describes a single Render web service. Mapbox and database remain optional there too.

### Forking

1. Fork [Nonarkara/phuket-dashboard](https://github.com/Nonarkara/phuket-dashboard).
2. Keep the MIT copyright notice and this ethical-use section.
3. Point any public deployment at *your* keys, not this project’s.
4. If you retarget the geography, start with `src/lib/governor-config.ts` (corridors) and the map layers in `src/components/Map/BorderMap.tsx` / `src/services/map-engine.ts`.
5. Do not strip The Slope Story or replace measured SRTM slopes with invented grades. If you remove it, say so in your fork README — it is the keystone of this product.
6. Do not present a fork as an official PAT or Phuket government product unless you document that authority.

---

## License

[MIT](LICENSE). Copyright © 2026 Non Arkaraprasertkul.

You may use, fork, and ship this software under the terms in [`LICENSE`](LICENSE). The hero illustration is part of this repository’s documentation. The HUD it depicts remains illustration, not a specification of the interface.

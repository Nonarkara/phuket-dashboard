# Phuket Dashboard — Task Tracker

## Session 2026-05-29 · The Slope Story (signature analytical keystone)

**Goal:** fuse the layers built across sessions (3D terrain, hillshade, blackspots, TimesFM)
into ONE self-explaining moment. Click a blackspot → camera flies to it on the 3D slope →
one card states the chain (Four Noble Truths): the slope → the toll → tonight's rain-risk → why → action.

- [x] 1. Compute REAL slope/elevation per blackspot (offline) via opentopodata SRTM (`scripts/blackspot-slopes.mjs`).
- [x] 2. Bake `elevationM`, `slopePct`, `slopeDeg` into `src/data/phuket-blackspots.ts` (sourced; honest — Patong summit 28.9°, no faked "45°").
- [x] 3. `src/components/Map/CorridorRiskReveal.tsx` — keystone card (mono micro labels, hairline, ZERO radius, amber/red/teal, 3 sizes).
- [x] 4. Wire `BorderMap.tsx`: `selectedBlackspot` state; click → set + force 3D + flyTo(zoom 15.5, pitch 68); lazy forecast peak; render after `<MapLegend />`.
- [x] 5. Build clean (tsc -b + next build).
- [ ] 6. Live verify (deploy, clean browser, click Patong Hill, screenshot reveal).
- [x] 7. Document: `docs/SLOPE-STORY.md`, `context.md`, project `CLAUDE.md` Anti-Regression.
- [ ] 8. Commit + push + watch deploy + verify live.

---

## Session 2026-05-25 · Recovery & commit

- [x] Audit uncommitted changes from interrupted session
- [x] Verify build passes (`npm run build` — clean)
- [x] Confirm all new features are wired (GovernorDailyBrief in OperationsPanel)
- [x] Create tasks/ directory and lessons log
- [ ] Commit all uncommitted work in single clean commit
- [ ] Cloudflare deploy and live-URL verify

## What shipped in this batch (pre-commit state)

### Routing refactor
- `/` → WarRoomApp directly (was: ShowcaseScrollStory)
- `/showcase` → new dedicated showcase page  
- `/war-room` → permanent redirect to `/`

### New components
- `GovernorDailyBrief.tsx` — today's fires / wins / risk / reality-check panel, wired into OperationsPanel

### New API routes
- `/api/coral-watch` — NOAA Coral Reef Watch BAA + DHW for Andaman Sea
- `/api/marine-conditions` — Open-Meteo Marine: wave height, swell, beach flag (green/yellow/red)
- `/api/gistda/disasters` — GISTDA flood + burnt-area national layers
- `/api/gistda/tambons` — Phuket tambon admin boundaries

### New services
- `src/services/basemap-styles.ts` — 5 basemap options (street/satellite/vegetation/topography/maritime)
- `src/services/satellite-layers.ts` — GISTDA SST + Chl-a WMS overlays

### New data files
- `src/data/phuket-flood-zones.ts`
- `src/data/phuket-road-safety.ts` — THAIRSC crash data: Phuket 4.3× Bangkok per-capita death rate
- `src/data/phuket-sciti-metrics.ts`
- `src/data/phuket-sea-routes.ts`
- `src/data/phuket-waterways.ts`

### Modified
- `src/services/map-engine.ts` — basemap switching + new layer support
- `src/components/Map/BorderMap.tsx` — basemap selector, satellite overlays
- Various Intelligence components — TopBar, OpsControlStrip, OperationsPanel, NewsSidebar, SignalTicker
- `src/lib/site.ts`, `src/lib/cache.ts`, `src/types/dashboard.ts` — minor additions
- `wrangler.jsonc` — CF config updates
- `package.json` / `package-lock.json` — dependency updates

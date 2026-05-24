# Phuket Dashboard — Task Tracker

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

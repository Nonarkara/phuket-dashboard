# Phuket Dashboard — Project Instructions

> Inherits from `/Users/non/Projects/CLAUDE.md` (global manifesto). This file covers **project-specific** decisions only.

---

## What This Is

A real-time operations dashboard for Phuket province, built as a **governor demo** and submitted to the **Red Dot Design Award** (Data Visualization category). It monitors tourism demand, maritime activity, weather operations, transit, and public safety — all on one wall.

**Primary display target:** 72-inch 4K screen (3840x2160).
**Secondary:** mobile phone (375px).
Standard desktop (1440px) is the middle ground, not the design origin.

---

## Two-Tier Architecture

| Surface | Route | Purpose | Mode |
|---------|-------|---------|------|
| **Showcase** | `/` | Narrative landing, scenario cards, design philosophy, evaluation guide | Light theme, scroll-driven |
| **War Room** | `/war-room` | Live operational instrument panel | Dark theme default, real-time feeds |

Both accept `?scenario=tourism-surge-weekend|red-monsoon-day|stable-recovery-day` for deterministic demo states.

---

## Layout Rules (Hard-Learned)

### Map overlays
- Overlay panels sit **inside** the map container with `pointer-events-none` on the wrapper, `pointer-events-auto` on interactive children
- Overlays must be **translucent** (`backdrop-blur-md` + semi-transparent bg) — never opaque
- **Never create full-width bars/panels that cut across the map.** The corridor selector, lens selector, and info panel are compact, positioned at corners, not spanning `inset-x-0`
- Corridor selector = inline pill buttons inside the top-left info panel
- Lens selector = bottom-left overlay
- Map legend = bottom-left collapsible (below lens)

### War Room layout (WarRoomApp.tsx)
```
TopBar
OpsControlStrip
┌──────────┬───────────────────┬──────────────┐
│ News     │   BorderMap       │  Operations  │
│ 260px    │   (flex-1)        │  360px       │
│ xl:block │   + overlays      │  xl:block    │
└──────────┴───────────────────┴──────────────┘
SignalTicker
```
- Sidebars hidden below `xl` (1280px), expand to 520px at `min-[3000px]`
- Mobile: operations panel stacks below map at `max-h-[46dvh]`

### Large display scaling
CSS `zoom` on `<html>` — NOT JavaScript scaling:
```css
@media (min-width: 2560px) { html { zoom: 1.5; } }
@media (min-width: 3840px) { html { zoom: 2; } }
```
This keeps viewport units correct and scales all fixed-pixel UI proportionally.

---

## Design System (Project-Specific)

### Palette
- **Light (showcase):** warm beige `--bg: #efede5`, ink `#111`, cool accent `#0f6f88`
- **Dark (war room):** GitHub-dark `--bg: #0d1117`, ink `#e6edf3`, cool `#58a6ff`
- Dark mode toggled via `.dark` class on `[data-surface='phuket-dashboard']`
- `useDarkMode()` hook persists to `localStorage('phuket-dark-mode')`

### Enforced in globals.css
- `border-radius: 0 !important` on all `.rounded-*` classes inside `[data-surface]`
- `box-shadow: none !important` on all `.shadow-*` classes
- Custom scrollbar (6px, subtle gray)
- Skeleton shimmer animation (`.skeleton` class)

### Loading states
**Never use "Loading..." text.** Use `<Skeleton />` components from `src/components/Skeleton.tsx`:
- `<SkeletonOpsPanel />` for operations panel
- `<SkeletonChart />` for chart areas
- `<SkeletonStrip />` for control strips
- `<SkeletonCard />` for individual cards

---

## Data Architecture

### Scenario engine (`src/lib/scenario.ts`)
Three pre-modeled scenarios produce deterministic data for demos. When `?scenario=X` is set, API routes return modeled data instead of calling external APIs. This guarantees a consistent, impressive demo regardless of live data availability.

### Caching tiers (`src/lib/cache.ts`)
`live` → `database` → `cache` → `scenario` → `reference` → `unavailable`

In-memory LRU with TTL + promise deduplication. Every API route gracefully degrades through these tiers. **Database is optional** — when `DATABASE_URL` is unset, everything still works via scenario/mock data.

### Module system (`src/modules/`)
30+ data source integrations organized by category:
- `earth-observation/` — NASA FIRMS, Sentinel Hub, JAXA, ISRO, GK2A
- `orbital-air-traffic/` — OpenSky, Celestrak, FlightLabs
- `conflict-events/` — ACLED, GDELT, ReliefWeb, PredictHQ
- `environmental/` — Open-Meteo, OpenAQ, TMD, MeteoBLUE
- `thailand/` — PKSB Transit, Highway Cameras, Longdo Traffic

Each module exports `fetchData()`, `mockData`, `uiType`, and `pollInterval`.

### Governor config (`src/lib/governor-config.ts`)
Defines corridors (Airport->Patong, Old Town, Chalong/Rassada, etc.), marine points, and city zones. Each corridor has map view coordinates, focus areas, and default operational actions.

---

## Key File Map

| Task | Files to touch |
|------|---------------|
| Add a corridor | `src/lib/governor-config.ts` (GOVERNOR_CORRIDORS array) |
| Add a data source | `src/modules/[category]/[source].ts` + `src/modules/registry.ts` |
| Add a map layer | `src/services/map-engine.ts` (create layer fn) + `BorderMap.tsx` (wire it) |
| Change map overlays | `src/components/Map/BorderMap.tsx` (lines 1230+) |
| Modify showcase | `src/app/page.tsx` + `src/lib/showcase.ts` |
| Add API route | `src/app/api/[name]/route.ts` |
| Change design tokens | `src/app/globals.css` (CSS variables) |
| Modify war room layout | `src/components/WarRoom/WarRoomApp.tsx` |

### Hooks
- `useDarkMode()` — dark mode toggle + localStorage
- `useWarRoomScale()` — returns `true` at 3000px+ for 4K-specific layout
- `useModuleData<T>(moduleId)` — fetch + poll any module with abort handling

---

## Build & Deploy

### Commands
```bash
npm run dev              # Dev server (webpack, port 3001 via launch.json)
npm run build            # next build --webpack (NOT turbopack)
npm run build:cf         # @opennextjs/cloudflare build
npx wrangler deploy      # Deploy to Cloudflare Workers
```

**Webpack is required.** Turbopack does not support deck.gl's transpile needs. Always use `--webpack` flag or the npm scripts that include it.

### Platforms
| Platform | Status | URL |
|----------|--------|-----|
| **Cloudflare Workers** | Active (primary) | `phuket-dashboard.drnon.workers.dev` |
| **GitHub Pages** | CI via `.github/workflows/` | Static export only |
| **Vercel** | Billing-limited ($20 cap) | Disabled until payment |
| **Render** | Available via `render.yaml` | Needs dashboard setup |

### Environment variables
```
DATABASE_URL          # Optional — PostgreSQL connection string
MAPBOX_TOKEN          # Optional — Mapbox GL basemap (falls back to OSM/ESRI)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN  # Client-side Mapbox
FIRMS_MAP_KEY         # NASA FIRMS fire data
```
All optional. The dashboard runs fully on mock/scenario data without any of them.

---

## How to Work With Me

These come from real frustrations across multiple sessions. Follow them exactly.

### Execution style
- **Move fast, work in parallel.** Don't implement one small thing, explain it, ask if it's okay, then do the next. Launch multiple agents simultaneously. Create all related files in one pass. I context-switch across 25 projects — I need velocity, not narration.
- **Don't summarize what you just did.** I can read the diff. Don't end responses with "Here's what I changed: ..." recaps.
- **Don't ask permission for obvious things.** If the plan is approved, execute it. Don't ask "should I also update X?" — just update it if it's clearly related.
- **Verify your own work.** Build it, deploy it, check the live URL. Don't say "this should work" — prove it works. Use the preview server, take screenshots, check console errors. I evaluate everything on deployed URLs, never on localhost promises.
- **When something breaks, fix it — don't explain why it broke.** I don't need a paragraph about why Cloudflare returned a 1101 error. Rebuild, redeploy, confirm it's fixed.

### Design decisions — what I will reject immediately
- **Full-width UI bars crossing the map.** The map is the product. Nothing should cut it in half with an opaque panel spanning the full width. Corridor selectors, lens selectors, info panels — all must be compact overlays pinned to corners.
- **CSS zoom hacks that make text microscopic.** If you need to scale for large displays, use CSS `zoom` on `<html>` via media queries (scaling UP for big screens), not JavaScript-driven zoom that renders at 3840px and shrinks to fit 1440px. The 1440px desktop user should see normal-sized text.
- **"Loading..." text anywhere.** Use Skeleton shimmer components. Plain text loading indicators look unfinished.
- **Rounded corners, shadows, default Tailwind blue.** These are enforced in globals.css. If you add a component and it has rounded corners, it means you didn't test it.
- **Placeholder content.** Every number must be real or scenario-modeled. Every headline must link to a real source. "Lorem ipsum" or generic descriptions are unacceptable.
- **Flat UI with no visual hierarchy.** Size, weight, spacing, and opacity must create clear reading order. If everything looks the same size and weight, redesign it.

### Common technical mistakes to avoid
1. **Smart quotes kill builds.** Never use `"` `"` (Unicode curly quotes) as string delimiters. Always ASCII `"`. This has caused hundreds of TS1127 errors.
2. **Type-check with `tsc -b`**, not `tsc --noEmit`.
3. **deck.gl transpile.** `next.config.mjs` must include all deck.gl packages in `transpilePackages`. Missing one = ESM import error at build time.
4. **Turbopack doesn't work.** Always use `--webpack`. The npm scripts already include this flag.
5. **No database needed.** Every feed degrades gracefully. Don't add database-required codepaths without fallbacks.
6. **Map overlay positioning.** Overlays are `absolute` inside the map `div`, NOT flex children of the layout. `z-40` (below controls at `z-50`). The `pointer-events-none` / `pointer-events-auto` pattern prevents click-blocking the map.
7. **Corridor buttons stay compact.** Inline pills inside the top-left info panel. Never a separate full-width bar. This was explicitly broken and fixed — don't regress.
8. **4K split-view.** At `min-[3000px]`, `useWarRoomScale()` returns `true` and BorderMap renders a secondary wireframe map panel (1/3 width). The primary map gets `flex-[2]`.
9. **Skeleton, not "Loading..."** Every loading state uses the shimmer skeleton system. Search for "Loading" text — if you find any, replace it with the appropriate Skeleton component.
10. **Deploy and verify.** After any meaningful change: `npm run build` → `npx @opennextjs/cloudflare build` → `npx wrangler deploy` → `curl -sI` the URL to confirm HTTP 200. Don't leave deployment as a "next step."

---

## Anti-Regression — Do Not Touch

See `/Users/nonarkara/Projects/CLAUDE.md` §11 (The Codex Incident — Anti-Regression Laws) for the full rules. These items are the personality of the Phuket Dashboard. Do not remove, replace, or "simplify" any of them without Dr Non's explicit in-chat approval:

- **72-inch 4K war-room layout** — the split-view primary/secondary map panels at `min-[3000px]` are the Red Dot submission. Do not disable the breakpoint.
- **Map-first Next.js 16 architecture** — the map is the page, not a widget. Do not reduce it to a card.
- **Showcase route** — kept distinct from the war-room route. Do not merge.
- **Tactical palette, hairline borders, ZERO border-radius, ZERO gradients.** House style is law.
- **Skeleton shimmer system** — no `"Loading..."` text.
- **Corridor buttons as inline pills** inside the top-left info panel. Never a full-width bar.

If you are about to remove, replace, or "simplify" any item above: stop, show the diff, wait for explicit approval.

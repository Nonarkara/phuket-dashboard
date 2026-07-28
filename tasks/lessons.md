# Lessons · Phuket Dashboard (phuket.nonarkara.org)

Corrections log. Updated after every mistake. **Read at the start of every session.**
Per §13: the same mistake never happens twice.

---

## 2026-05-29 · Run static export via `npm run build:static`, not `node scripts/static-export.mjs`

- **What went wrong:** Invoking the script directly failed with `/bin/sh: next: command not found`. The script `execSync("next build")` relies on `node_modules/.bin` being on PATH, which only npm scripts add.
- **Correct behaviour:** Verify static export with `npm run build:static` (matches CI). Direct `node` invocation lacks the npm PATH and false-fails.
- **How to recognise:** Preflight passes, routes get stubbed, then `next: command not found` / exit 127.

## 2026-05-29 · TimesFM 2.0 quantile output works (no synthetic band needed)

- **Note (not a mistake):** `tfm.forecast()` returns `(point, quantiles)`; `quantiles[0]` is `[horizon, nq>=9]`. Deriving p10/p90 spread per hour works — real uncertainty bands. Keep the rain-widened synthetic envelope only as the documented fallback.

---

## 2026-05-26 · Bootstrap: §13 adopted

- **What went wrong:** n/a — first entry
- **Correct behaviour:** Log every correction here. Read before each session.
- **How to recognise:** Any time you repeat a fix you've already made.

---

## 2026-05-26 · Node.js 20.x required — build fails silently on 18.x

- **What went wrong:** n/a — reminder
- **Correct behaviour:** `engines.node: "20.x"`. Verify before running `npm run build`.
- **How to recognise:** Build exits with no useful error message on Node 18.

---

## 2026-05-26 · Static export — basePath ~~is /phuket-dashboard~~ (SUPERSEDED 2026-05-28)

- **SUPERSEDED — this advice was WRONG and caused the CSS-404 outage. See the 2026-05-28 basePath entry below.**
- **Correct behaviour (current):** NO basePath. `phuket.nonarkara.org` is a custom-domain Pages site served at root → `output: 'export'`, `NEXT_PUBLIC_BASE_PATH=""`, no `basePath`. basePath is only for `user.github.io/repo/` hosting.

---

## 2026-05-26 · NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN required at build time

- **What went wrong:** n/a — reminder
- **Correct behaviour:** Set env var before build. Without it, map tiles fail silently and the page renders with a blank map panel.
- **How to recognise:** Empty map canvas with no error in console = missing token.

---

## 2026-05-28 · GitHub Pages CSS-404 from basePath on a custom domain

- **What went wrong:** Static export set `basePath: "/phuket-dashboard"`, so the HTML referenced `/phuket-dashboard/_next/...` while files deploy at the domain root (custom-domain Pages site). Every asset 404'd; the site rendered as unstyled raw text.
- **Correct behaviour:** With a custom domain, the site IS the root — no basePath. Removed `basePath` and forced `NEXT_PUBLIC_BASE_PATH=""`.
- **How to recognise:** All text content shows but zero styling; CSS at the basePath URL → 404, at `/_next/...` → 200.

## 2026-05-28 · Type imported from an API route that gets stubbed in static export

- **What went wrong:** `GovernorDailyBrief.tsx` did `import type { CoralWatchData } from ".../api/coral-watch/route"`. `static-export.mjs` stubs every route before build; the stub exports no types → `TS2614`. GitHub Pages builds failed for days behind a green Workers deploy.
- **Correct behaviour:** Shared types live in `src/types/`, NEVER in route files. Added a preflight to `static-export.mjs` that fails fast (file+line) on any non-route → route import.
- **How to recognise:** Local `npm run build` passes but `npm run build:static` fails with a type error in a component importing from `/api/.../route`.

## 2026-05-28 · Working tree had flattened/corrupted source files

- **What went wrong:** ~207 tracked files (incl. `BorderMap.tsx`) were flattened in the working tree — each block on one physical line, so inline `//` comments killed the rest of the line. Tree wouldn't build; committed HEAD was clean (CI builds HEAD, so prod was fine).
- **Correct behaviour:** Don't edit the corrupted copy. `git restore .` to the clean HEAD first, then edit.
- **How to recognise:** `wc -l` shows few lines but the file is huge; one line is tens of KB.

## 2026-05-28 · TimesFM 2.0 (500m) checkpoint needs matching architecture

- **What went wrong:** `TimesFmHparams()` defaults to the 200m arch (20 layers); loading `google/timesfm-2.0-500m-pytorch` threw a state_dict mismatch.
- **Correct behaviour:** Pass `num_layers=50, use_positional_embedding=False`. Needs Python 3.10+ → run via `uv run --python 3.11 --with "timesfm[torch]"`.
- **How to recognise:** `Unexpected key(s) in state_dict ... layers.20..49`.

<!-- FORMAT for future entries:
## YYYY-MM-DD · [short title of the mistake]
- **What went wrong:** ...
- **Correct behaviour:** ...
- **How to recognise this pattern:** ...
-->

---

## 2026-07-26 · Google News RSS returns 503 to every Cloudflare Worker egress IP

- **What went wrong:** Built the multilingual news ingest on Google News RSS. It worked perfectly from the laptop (100 items per language) and returned 503 for all 11 feeds from the deployed Worker.
- **Correct behaviour:** Use Bing News RSS (`https://www.bing.com/news/search?q=…&format=RSS&mkt=xx-XX`) for anything fetched from Cloudflare. Verify every upstream from the *runtime that will actually call it*, not from the laptop.
- **How to recognise:** A feed that works in a local script and 503s in a Worker. Also note Bing has no `zh-CN` market (returns zero items — use `zh-HK`) and no working `kk-KZ` (narrow the `ru-RU` market with "Казахстан" instead).

## 2026-07-26 · Worker-to-Worker fetch on the same zone fails with error 1042

- **What went wrong:** The app worker's `/api/news/multilingual` fetched `https://phuket-ingest.drnon.workers.dev/news`. Cloudflare rejects same-zone Worker→Worker requests; the route silently fell through to its empty payload and the live API served `{ok:false, items:0}` while the ingest worker's own endpoint returned 111 items.
- **Correct behaviour:** Share state through a KV namespace bound to both workers, not an HTTP call between them. Bind the namespace in both `wrangler.jsonc` files.
- **How to recognise:** Error 1042, or an inter-worker fetch that times out / returns nothing while the target URL works fine from curl.

## 2026-07-26 · getCloudflareContext() must use the async form in a route handler

- **What went wrong:** `getCloudflareContext().env.PHUKET_KV` threw inside an API route, so the KV read always returned null and fell back to the (broken) URL path.
- **Correct behaviour:** `await getCloudflareContext({ async: true })`. Keep a `source` field in the response naming which path served it — the silent fallback is what made this take three deploys to spot.
- **How to recognise:** KV has the key (`wrangler kv key get` proves it) but the route behaves as if the binding is missing.

## 2026-07-26 · Duplicate local type definitions hide breaking API changes from tsc

- **What went wrong:** Changed the news feed from `{th, en, zh}` buckets to a flat `items[]`. `tsc -b` passed clean. The page then crashed at runtime with "news.th is not iterable" because `GovernorDailyBrief.tsx` declared its own private copy of `MultilingualNewsResponse` instead of importing the shared one.
- **Correct behaviour:** One type per contract, in `src/types/`. When changing a response shape, `grep` for the type *name* across the repo, not just for its import.
- **How to recognise:** A response-shape change that produces zero compiler errors. That is the warning sign, not the all-clear.

## 2026-07-26 · This dashboard needs ~60s before the browser check means anything

- **What went wrong:** Checked the live site repeatedly and read "0 articles", then went hunting for CORS, API-base and hydration bugs that did not exist. The page simply had not finished mounting — deck.gl plus ~40 polled endpoints.
- **Correct behaviour:** Before concluding a live page is broken, confirm it has finished coming up: `document.querySelectorAll('*').length` in the thousands, and fetches actually issued. Re-read before diagnosing.
- **How to recognise:** Element count in the low hundreds and zero outbound API calls means "still booting", not "broken".

## 2026-07-26 · Deploying the Pages site is only half a deploy

- **What went wrong:** Pushed, CI deployed GitHub Pages, verified the new bundle was live — but the static site calls the Cloudflare **Worker** for every `/api/*`, and that worker still ran the old code serving the old response shape.
- **Correct behaviour:** Any change touching an API route needs BOTH: `git push` (→ Pages, the shell) and `npx @opennextjs/cloudflare build && npx wrangler deploy` (→ Worker, the data plane). Neither alone is a deploy.
- **How to recognise:** The live HTML/JS is new but `curl` on the workers.dev API returns the old shape.

## 2026-07-26 · A 0x0 browser viewport looks exactly like a broken app

- **What went wrong:** The Browser pane went hidden, so `window.innerWidth/innerHeight` were 0. The page served fine (43 KB of SSR HTML, 200s in the dev log) but rendered 242 elements, an empty `innerText` and zero canvases, because every sized layout collapsed and deck.gl never initialised. Spent a long detour bisecting, stashing Phase 3, wiping `.next` and restarting the dev server — the code was never at fault.
- **Correct behaviour:** When a page looks dead, check the viewport FIRST: `window.innerWidth`, and `document.querySelector('[data-surface]').getBoundingClientRect()`. Zero width means the pane is hidden, not that the app is broken. A screenshot wakes it. Also compare `document.body.textContent.length` (large = content present) against `innerText.length` (small = nothing is being laid out) — that gap is the tell.
- **How to recognise:** `els` in the low hundreds, `canvases: 0`, `bodyLen` ~20, no client `/api/*` calls in the dev log, and no JS errors anywhere. No error + no render = environment, not code.

## 2026-07-26 · An area-weighted centroid can fall outside a concave polygon

- **What went wrong:** Used a shoelace centroid as each administrative unit's map label and fly-to target. Rawai wraps the southern cape, so its centroid landed in the sea; the map would have framed open water for that municipality.
- **Correct behaviour:** Keep the area centroid when it tests inside the polygon, otherwise fall back to a representative point (scanline the bbox, take the midpoint of the widest interior span — the PostGIS `ST_PointOnSurface` idea). `scripts/build-boundaries.mjs` does both.
- **How to recognise:** The self-check `scripts/test-boundaries.mjs` asserts every unit's centroid falls inside its own polygon. It caught this on its first run; keep that assertion.

## 2026-07-26 · GISTDA's tambon English names and LAO types are both unreliable

- **What went wrong:** GISTDA's tambon layer labels 830105 (Wichit) as "RATSADA" — the same English name it gives 830104. Its LAO layer still calls Phuket City a เทศบาลเมือง (upgraded to เทศบาลนคร in 2004) and lists Ratsada/Wichit/Chalong/Rawai as อบต. after their promotion to เทศบาลตำบล.
- **Correct behaviour:** Take *geometry* and *codes* from GISTDA, *names* from the DOPA subdistrict register, and *current unit type* from an up-to-date list. `scripts/build-boundaries.mjs` carries a `TAMBON_NAMES_EN` override table and a commented registry saying which field came from where.
- **How to recognise:** Two features sharing an English name, or a municipality type that contradicts the province's own published list.

---

## 2026-07-28 · A tile provider can lie about its zoom range — probe it, then clamp maxZoom

- **What went wrong:** RainViewer radar was declared `maxZoom: 12`. Their tiles are native to z7 only; from z8 the server returns a grey "Zoom Level Not Supported" IMAGE (HTTP 200), so deck dutifully painted error tiles across the whole map in production.
- **Correct behaviour:** Before wiring any tile source, fetch tiles at several zooms and compare bytes/hashes — the identical 1370-byte tile at every over-zoom (Phuket z8-10 AND Miami z10-12, md5 2cc6649e…) was the proof. Set the layer's maxZoom to the provider's REAL ceiling; deck then overzooms real pixels.
- **How to recognise:** Error text rendered as map tiles = the server returns 200 + an image for bad requests, and your declared maxZoom exceeds reality.

## 2026-07-28 · Worker-thread tile fetches are invisible to main-thread performance timing

- **What went wrong:** Verified the new Longdo MVT traffic layer by counting `performance.getEntriesByType("resource")` for pbf requests — always 0, looked broken. loaders.gl fetches MVT tiles inside a web worker; those requests never appear in the main thread's resource timing.
- **Correct behaviour:** Verify vector-tile layers visually (colored segments on the map) or via browser-level network capture, not via main-thread perf entries.

## 2026-07-28 · Deck.gl canvas stuck at 300x150 = the pane was hidden at init

- **What went wrong:** In the embedded Browser pane, a page booted while hidden leaves the deck canvas at the HTML default 300x150 (MapLibre's canvas resizes fine) and deck's loop dead — no tiles requested, no layers drawn. Looks exactly like broken layer code.
- **Correct behaviour:** Check `document.querySelector('#phuket-deck canvas').width` first. If 300x150, reload while keeping the pane visible (screenshot immediately after navigate, then wait/screenshot again). Sibling of the earlier 0x0-viewport lesson.

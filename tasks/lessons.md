# Lessons · Phuket Dashboard (phuket.nonarkara.org)

Corrections log. Updated after every mistake. **Read at the start of every session.**
Per §13: the same mistake never happens twice.

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

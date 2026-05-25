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

## 2026-05-26 · Static export — basePath is /phuket-dashboard

- **What went wrong:** n/a — reminder
- **Correct behaviour:** next.config.js: `basePath: '/phuket-dashboard'`, `output: 'export'`. All internal links must be relative to this basePath. GitHub Pages deploy: `npm run build && npx gh-pages -d out`.
- **How to recognise:** Links broken on live site but working locally = basePath mismatch.

---

## 2026-05-26 · NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN required at build time

- **What went wrong:** n/a — reminder
- **Correct behaviour:** Set env var before build. Without it, map tiles fail silently and the page renders with a blank map panel.
- **How to recognise:** Empty map canvas with no error in console = missing token.

---

<!-- FORMAT for future entries:
## YYYY-MM-DD · [short title of the mistake]
- **What went wrong:** ...
- **Correct behaviour:** ...
- **How to recognise this pattern:** ...
-->

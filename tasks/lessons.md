# Lessons Log — Phuket Dashboard

## 2026-05-25 · Context interruption recovery
- **What went wrong:** Previous session was interrupted mid-execution due to model billing/credit reporting bug. Work was complete but uncommitted.
- **Correct behaviour:** Always commit at natural checkpoints — after build passes and features are wired up. Don't leave large batches of work uncommitted.
- **How to recognise:** If session ends without a commit and build is green, the next session should commit before proceeding.

## Standing rules (from CLAUDE.md)
- Smart quotes (`"` `"`) kill builds — always use ASCII `"`.
- `tsc -b` not `tsc --noEmit` for type checking.
- Always `--webpack` flag; Turbopack breaks deck.gl transpile.
- Map overlays: `absolute` inside map `div`, `z-40`, `pointer-events-none` wrapper.
- No "Loading..." text — use Skeleton shimmer components.
- Deploy and verify: build → cf build → wrangler deploy → curl HTTP 200.

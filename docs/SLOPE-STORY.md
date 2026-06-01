# The Slope Story — the signature analytical moment

> *"This location where the motorcycle accidents happen is actually 45 degrees up the
> hill. And when it rains in Phuket, which is 8 months a year, you can tell why people
> had accidents."* — Dr Non, the brief that became this feature.

## What it is

Click any accident blackspot on the war-room map. The camera flies to it on the 3D
terrain, the hillshade reveals the grade, and a single card states the chain plainly:

```
CORRIDOR RISK — Patong Hill summit hairpin
Steep descent · Patong corridor
────────────────────────────────────────────
THE SLOPE   28.9° · 55% grade · 59 m elevation
THE TOLL    43 deaths · 92% motorcycle · Kathu
TONIGHT     Peak 09:00 · 0.4mm rain · risk 34/100
WHY         A 28.9° descent — among the steepest roads on the island.
            In rain, two-wheel braking distance collapses on the grade.
ACT         Wet-surface warning + speed enforcement. Patrol from 09:00.
SRTM 30 m · THAIRSC · TimesFM
```

That card is the product. Everything else on the map is evidence for it.

## Why it exists

Across several sessions we built powerful but **disconnected layers**: 3D terrain,
hillshade, accident blackspots, AlphaEarth urban fabric, and a TimesFM crash-risk
forecast. Each was a toggle. A judge clicking around saw materials, not an argument.

The Slope Story is the **synthesis** — the one move that makes the layers cohere into
the insight Dr Non articulated. It is the difference between *"policy without product
is theater"* and a product that tells you *why*.

## The Four Noble Truths as a design brief

Per the workspace design doctrine (Nonism §12.5), a brief that skips *"what is the
suffering?"* builds features nobody needs. The card is literally the Four Noble Truths:

| Truth | Card row | Source |
|---|---|---|
| The suffering (dukkha) | THE TOLL — deaths on this corridor | THAIRSC |
| Its origin (samudaya) | THE SLOPE — the grade that causes loss of control | NASA SRTM 30 m |
| Its cessation (nirodha) | implicit — the risk is not fate, it is geometry + weather | — |
| The path (magga) | ACT — the specific, today-actionable intervention | derived |

TONIGHT bridges origin and path: *steep + wet + two wheels*, with the actual hour the
TimesFM forecast says risk peaks.

## Data lineage (every number is real or honestly modeled)

- **THE SLOPE** — `scripts/blackspot-slopes.mjs` samples NASA **SRTM 30 m** elevation
  (opentopodata.org) on a ~122 m N/S/E/W cross at each blackspot and takes the steepest
  arm. Baked into `src/data/phuket-blackspots.ts` as `slopeDeg / slopePct / elevationM`.
  SRTM smooths terrain, so the grade is a **conservative floor** — stated as such. The
  numbers vindicate the brief: **Patong Hill summit 28.9° (55%)**, west descent 17.2°,
  versus flat Old Town junctions ~2°. The danger genuinely *is* the slope.
- **THE TOLL** — `PHUKET_DISTRICTS` in `phuket-road-safety.ts` (THAIRSC, 2022–2026
  cumulative): Old Town 106 deaths, Airport-north 47, Patong 43; 92% motorcycle. Joined
  to each blackspot by corridor.
- **TONIGHT** — `public/data/phuket-accident-forecast.json`, produced by **TimesFM 2.0
  (500m)** in `scripts/timesfm-forecast.py`: the THAIRSC time-of-day rhythm projected
  forward and modulated by Open-Meteo rain. The card reads its `peakWindow`.
- **The slope you see** — AWS Terrarium DEM + MapLibre `setTerrain` + hillshade
  (`BorderMap.tsx`). The blackspots render as MapLibre circles so they drape on the
  terrain and sit *on* the grade.

> **Honesty note (reflexivity, §12.5).** Dr Non's "45°" was rhetorical; the real
> steepest sampled grade is ~29°. We show the true number — it is dramatic enough, and
> a fabricated 45° would fail the Skeptic's seat at the design review.

## How it is wired

| Piece | File |
|---|---|
| Slope precompute (offline) | `scripts/blackspot-slopes.mjs` |
| Blackspot data + baked slopes | `src/data/phuket-blackspots.ts` |
| The card | `src/components/Map/CorridorRiskReveal.tsx` |
| Selection state, fly-to, forecast peak, mount | `src/components/Map/BorderMap.tsx` |
| Toll join | `src/data/phuket-road-safety.ts` (`PHUKET_DISTRICTS`, `PHUKET_BY_VEHICLE`) |
| Tonight's peak | `public/data/phuket-accident-forecast.json` (TimesFM) |

Click handler: find the `Blackspot` by feature id → `setSelectedBlackspot` → force 3D →
`setViewState` cinematic fly (zoom 15.5, pitch 68, 1.2 s). The card mounts inside the
primary map container (corner overlay, `pointer-events-auto`, translucent, hairline,
ZERO radius — house style). Close (✕) clears the selection.

## Reproduce / refresh

```bash
# Re-derive slopes (writes paste-ready values; bake into phuket-blackspots.ts)
node scripts/blackspot-slopes.mjs

# Refresh tonight's forecast (needs Python 3.10+)
uv run --python 3.11 --with "timesfm[torch]" --with requests --with numpy \
    python scripts/timesfm-forecast.py
```

## The collaboration arc (for the record)

This feature is the keystone of a multi-session build:

1. **Fixed the outage** — a stubbed-route type import broke every GitHub Pages build for
   days, and a `basePath` meant for subpath hosting 404'd every asset on the custom
   domain. Added a static-export preflight so it can't recur.
2. **Completed the 3D** — hillshade + curated blackspots draped on the terrain;
   exaggeration tuned for relief over spectacle.
3. **Brought in the models** — AlphaEarth (satellite-embedding urban fabric) and TimesFM
   (crash-risk forecast), both precomputed offline on the workstation and shipped static.
4. **Connected it all** — *this* card, which turns five separate layers into one sentence
   a governor can act on tonight.

If this project is ever told as a history, the through-line is simple: we kept asking
*why* until the map answered.

---

## Upgrade (2026-05-29) — the models go deeper

The two Google models were being used shallowly; this upgrade brings their real superpowers
into the keystone.

**TimesFM → per-corridor probabilistic forecast.** The forecast is no longer one island curve.
`scripts/timesfm-forecast.py` now emits a `corridors` map ("Patong" / "Old Town" / "Airport north")
where each corridor's rain sensitivity `k = 0.18·(meanSlopeDeg/8)` is scaled by its REAL mean SRTM
slope — so the steep Patong descent amplifies rain far more than the flat Old Town junctions. The
SRTM slope now flows *into* the forecast. It also captures TimesFM 2.0's **quantile spread** for
honest uncertainty bands (`riskLow`/`riskHigh`; falls back to a rain-widened modeled envelope).
On a wet night the contrast is stark and true: 22:00 peak risk **Patong 100 · Old Town 68.6 ·
Airport north 50.7**. The Slope Story TONIGHT row now shows the *corridor's* peak + range; the
Governor's brief sparkline gained a faint p10–p90 band (Stoic "show the worst case", §12.5).

**AlphaEarth → "Risk Twins" (embedding similarity).** AlphaEarth's 64-d embedding is L2-normalized,
so a dot product *is* cosine similarity. `scripts/alphaearth-risk-twins.py` samples each high-severity
blackspot's signature and finds every place on Phuket whose fabric matches (≥0.85), excluding the
source's own neighborhood → `public/data/phuket-risk-twins.geojson` (890 zones). The story:
*"where else looks like a known death-corridor — find it before it becomes one."* Surfaced as a
"Risk twins" map overlay (opacity = similarity) and a count in the Slope Story card. The death-hill
fabric is widespread (Patong-summit: 305 zones); Samkong's is rare (18) — the spread is itself signal.

Both stay precomputed-offline → static, free, no live cloud. Schema is backward-compatible (island
top-level unchanged; new fields optional). Live BigQuery `AI.FORECAST` + on-the-fly GEE similarity
remain the documented future upgrade path.

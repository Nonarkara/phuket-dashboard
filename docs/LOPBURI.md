# Lopburi Dashboard

A second province war room built on the Phuket dashboard format, targeting
**lopburi.nonarkara.org**. Lives at the `/lopburi` route so the Phuket
surfaces remain untouched.

## Format parity with Phuket

```
LopburiTopBar          (identity · posture chips · clock · dark toggle)
CctvStrip              (camera slot wiring row — like OpsControlStrip)
┌──────────┬───────────────────┬──────────────┐
│ Social   │   LopburiMap      │  FloodDash   │
│ 260px    │   (flex-1)        │  360px       │
│ xl:block │   + overlays      │  xl:block    │
└──────────┴───────────────────┴──────────────┘
LopburiTicker          (marquee of flood + social + cctv signals)
```

Same rules as Phuket: dark-mode war room, zero border-radius / shadows,
skeleton shimmer loading, compact corner map overlays with the
`pointer-events-none` wrapper pattern, corridor buttons as inline pills
in the top-left info panel, CSS `zoom` scaling at 2560/3840px.

## The four features

| Feature | Where | Data |
|---------|-------|------|
| **Social listening** | Left bar (`SocialSidebar`) | Google News RSS (`ลพบุรี` + `Lopburi`) + GDELT DOC 2.0, keyword-lexicon sentiment, trending topics, channel filters |
| **FloodDash (real-time)** | Right bar (`FloodOpsPanel`) + map layer | ThaiWater / HII API v3 `province_code=16` water levels + 24h rain, Pa Sak Jolasid dam storage from `dam_daily`, 60s poll |
| **CCTV slots** | Strip under top bar (`CctvStrip`) + map markers | `src/data/lopburi-cctv.ts` — 12 wiring-ready slots; DOH ITS cameras in-province auto-wire matching slots at runtime |
| **Satellite layers** | Map bottom-left lens selector | NASA GIBS (VIIRS true color daily, MODIS 7-2-1 flood contrast, IMERG rain, night lights) + Esri hi-res, via deck.gl TileLayer |
| **3D city (every building)** | Map, `3D` toggle in the lens panel (default on) | Arnis-style pipeline (arnismc.com): OSM building footprints + heights via OpenFreeMap planet vector tiles, fill-extrusion on AWS Terrarium DEM terrain with hillshade, fog, sky, warm directional light — `src/lib/lopburi/buildings3d.ts` |

## Key files

| Task | File |
|------|------|
| Province meta / corridors / satellite catalog | `src/lib/lopburi/config.ts` |
| FloodDash loader (ThaiWater 16 + dam + scenarios) | `src/lib/lopburi/flood.ts` |
| Social listening loader | `src/lib/lopburi/social.ts` |
| CCTV slot registry (wire a camera here) | `src/data/lopburi-cctv.ts` |
| CCTV auto-wiring (DOH ITS) | `src/lib/lopburi/cctv.ts` |
| Shell layout | `src/components/Lopburi/LopburiApp.tsx` |
| API routes | `src/app/api/lopburi/{flood,social,cctv}/route.ts` |

## Wiring a CCTV camera

Fill in `snapshotUrl` (and optionally `streamUrl`) on the slot in
`src/data/lopburi-cctv.ts` and set `status: "live"`. The strip card, map
marker, and detail panel all light up with no other change. DOH ITS
highway slots wire themselves whenever `its.doh.go.th` is reachable.

## Scenarios

Same ids as Phuket, remodeled for an inland flood basin:
`/lopburi?scenario=red-monsoon-day` (basin severe, elevated dam release),
`stable-recovery-day` (dry, storage banking), `tourism-surge-weekend`
(sunflower-season crowds, basin quiet). Live feeds degrade to a clearly
flagged reference model when unreachable.

## Deploying lopburi.nonarkara.org

A dedicated worker config ships in `wrangler.lopburi.jsonc`
(name `lopburi-dashboard`, custom domain `lopburi.nonarkara.org`,
`NEXT_PUBLIC_PROVINCE=lopburi` baked in so `/` redirects to `/lopburi`).

One command on any machine with Cloudflare access (wrangler login or
`CLOUDFLARE_API_TOKEN`):

```bash
npm run deploy:lopburi
```

That builds the OpenNext worker bundle and deploys it. The
`custom_domain: true` route auto-creates the `lopburi.nonarkara.org`
DNS record because `nonarkara.org` is already a zone in the account.
No other env vars are required; all feeds are free/no-token and degrade
gracefully.

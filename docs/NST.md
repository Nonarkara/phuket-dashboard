# NST Water Dashboard — Nakhon Si Thammarat

A water-first war room for Nakhon Si Thammarat city at `/nst`, targeting
**nst.nonarkara.org**. Where Phuket is corridor-first and Lopburi is
basin-first, NST is *route*-first: it connects the entire system that
delivers water to the city and answers, in order, how much is coming,
when it arrives, where it splits, which parts of the city pond, and
whether the tidal outlets can pass it.

## The system it models

```
Khao Luang (1,835 m)  ──►  Khlong Tha Di @ Khiriwong  ──►  Ban Tha Di weir
                                                                  │
                                                          Tha Ngiu split
                                  ┌───────────────────────────────┼──────────────────────────┐
                        North: Khlong Tha Sak            City: Khlong Tha Di /       South: RID diversion canal
                        (+ Phrom Khiri tributary)        Khlong Pak Nakhon            (18.6 km, 750 m3/s design)
                                  │                      (~268 m3/s capacity)                  │
                            Pak Phun outlet          Kamphaeng Sao ► Tha Wang ►        Diversion outfall
                                                       Pak Nakhon mouth (tidal)
```

Traced network: `src/data/nst-waterways.ts` (nodes + reaches, design
capacities from the RID city flood-mitigation brief). City fill zones:
`src/data/nst-flood-zones.ts` (fill order from the 2017/2020/2024
inundation pattern). Replace `path`/`polygon` arrays with RID/OSM
GeoJSON when shapefiles are in hand — ids and routing logic are stable.

## Layout (same grammar as Phuket / Lopburi)

```
NstTopBar        posture · catchment mm · Tha Di m3/s · city ETA · outlet tide · CCTV
CctvStrip        12 camera slots at water control points (shared component)
┌────────────────┬──────────────────────────┬────────────────────────┐
│ Water system   │  Water system map        │  Where the water goes  │
│ (schematic:    │  reaches width = m3/s    │  6-stage routing chain │
│  main stem +   │  color = status          │  Tha Ngiu split bar    │
│  3 branches,   │  animated pulses = dir.  │  city fill order + ETA │
│  live readings)│  sensors · zones · CCTV  │  outlets + tide        │
│                │  satellite · terrain/3D  │  what-if water plane   │
└────────────────┴──────────────────────────┴────────────────────────┘
NstTicker        posture · active stages · warnings · held outlets
```

## Data

| Layer | Source | Notes |
|-------|--------|-------|
| Sensors | ThaiWater / HII v3 `province_code=80` water level, discharge, 24h rain | Live stations are matched onto the nearest traced node (<5 km); unmatched ones appear under "Other telemetry" |
| Tide | Open-Meteo Marine `sea_level_height_msl` at Pak Nakhon | Drives outlet constraint (held vs draining) |
| Routing | `src/lib/nst/hydrology.ts` | Split shares, reach discharge/velocity/travel time, city ETA, zone fill status, six stages |
| Terrain / 3D | AWS Terrarium DEM + OpenFreeMap OSM buildings (shared `lib/geo/city3d.ts`) | Exaggeration 1.8 so the Khao Luang wall reads |
| Satellite | NASA GIBS + Esri (shared `lib/geo/satellite-layers.ts`) | MODIS 7-2-1 is the flood lens |
| CCTV | `src/data/nst-cctv.ts` + shared DOH ITS auto-wire | Same slot wiring pattern as Lopburi |

Every live feed degrades to a clearly flagged reference model; gaps in
live telemetry are filled from the model and the attribution says so.

## Scenarios

`/nst?scenario=red-monsoon-day` — 2017-class event: 262 mm on the range,
Tha Di 820 m3/s over bank, city channel exceeded with the diversion
open, high tide holding all three outlets. `stable-recovery-day` — dry,
draining. `tourism-surge-weekend` — quiet system.

## Shared modules (streamlined from Lopburi)

`src/types/cctv.ts`, `src/lib/cctv/loader.ts`, `src/lib/geo/satellite-layers.ts`,
`src/lib/geo/city3d.ts`, `src/components/Province/CctvStrip.tsx` — one
implementation, two province bindings.

## Deploy

```bash
npm run deploy:nst      # builds with NEXT_PUBLIC_PROVINCE=nst, deploys wrangler.nst.jsonc
```
`custom_domain: true` on `nst.nonarkara.org` creates the DNS record in the
existing zone. `/` redirects to `/nst` on that worker.


---

## GISTDA API Integration (added 2026-05-20)

API key stored as Cloudflare Worker secret `GISTDA_API_KEY` and in `.env.local`.

### Catalog

| Source | Endpoint | Auth | Coverage | Update | Status |
|---|---|---|---|---|---|
| **PM2.5 location** | `pm25.gistda.or.th/rest/getPm25byLocation` | None | Phuket 3 districts (Mueang/Krathu/Tha Lang) | Hourly | ✅ Wired in `/api/air-quality` |
| **PM2.5 province** | `pm25.gistda.or.th/rest/getPm25byProvince` | None | All 77 provinces | Hourly | ✅ Available |
| **SST Andaman** | `ocean.gistda.or.th/geoserver/openwq/wms` `layers=lastest_sst` | None | Andaman Sea | Daily VIIRS | ✅ Wired as WMS overlay "Sea Temp" |
| **Chl-a Andaman** | Same WMS `layers=lastest_chl` | None | Andaman Sea | Daily VIIRS | ✅ Wired as WMS overlay "Chl-a" |
| **Admin polygons** | `gistdaportal.gistda.or.th/arcgis/.../MapServer/4/query` | None | 17 tambons in Phuket | Static | Available — not wired |
| **Flood extent 1-day** | `api-gateway.gistda.or.th/...flood-extent-1day` | `api_key` query param | National | Near-real-time | Key format needs verification |
| **Burnt area** | `api-gateway.gistda.or.th/...burnt-area-latest` | `api_key` | National | Near-real-time | Key format needs verification |
| **THEOS-2 imagery** | `api-gateway.gistda.or.th/.../tiles/{id}/{z}/{x}/{y}.png` | `api_key` | Thailand | On-demand | Key format needs verification |

### Key behavior notes
- `pm25.gistda.or.th` is completely open (no auth).
- The API key doesn't currently work on `api-gateway.gistda.or.th` — returns 404. May require a different endpoint path or account activation. Contact GISTDA support at https://api-gateway.gistda.or.th.
- The ArcGIS FeatureServer admin boundaries require no auth but use ArcGIS native token format for editing.

### PM2.5 → AQI conversion implemented
Standard EPA breakpoints in `/api/air-quality/route.ts`. Hourly GISTDA data replaces Open-Meteo for Phuket's 3 districts. Regional stations (Bangkok, etc.) still use Open-Meteo.

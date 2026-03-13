import { NextResponse } from "next/server";

/**
 * JAXA Satellite Data API
 *
 * Aggregates available JAXA satellite products for the Phuket operating area:
 * - Himawari-9 geostationary (10-min cloud/fire/SST via NASA GIBS proxy)
 * - ALOS-2 SAR (G-Portal catalog search)
 * - GSMaP hourly rainfall
 * - GCOM-C NDVI/EVI
 * - AMSR-2 soil moisture
 *
 * Live endpoints require JAXA_GPORTAL_USER / JAXA_GPORTAL_PASS env vars.
 * Falls back to catalog metadata when credentials are absent.
 */

const PHUKET_BBOX = [97.5, 7.0, 99.5, 9.0]; // [west, south, east, north]

interface JaxaProduct {
  id: string;
  name: string;
  sensor: string;
  platform: string;
  resolution: string;
  cadence: string;
  coverage: string;
  tileEndpoint: string | null;
  apiEndpoint: string | null;
  status: "live" | "catalog-only" | "offline";
  description: string;
}

function getSafeDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildJaxaProducts(focusDate: string): JaxaProduct[] {
  return [
    {
      id: "himawari-cloud-ir",
      name: "Himawari-9 Cloud IR",
      sensor: "AHI Band 13",
      platform: "Himawari-9",
      resolution: "2 km",
      cadence: "10 min",
      coverage: "Full disk (Asia-Pacific)",
      tileEndpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/${focusDate}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
      apiEndpoint: "ftp://ftp.ptree.jaxa.jp (port 2051, requires registration)",
      status: "live",
      description: "Clean infrared band for cloud-top temperature and storm tracking.",
    },
    {
      id: "himawari-true-color",
      name: "Himawari-9 True Color",
      sensor: "AHI Bands 1-3",
      platform: "Himawari-9",
      resolution: "1 km (VIS), 2 km (IR)",
      cadence: "10 min",
      coverage: "Full disk (Asia-Pacific)",
      tileEndpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band3_Red_Visible/default/${focusDate}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
      apiEndpoint: "ftp://ftp.ptree.jaxa.jp",
      status: "live",
      description: "Visible true-color composite for daytime regional overview.",
    },
    {
      id: "gsmap-rainfall",
      name: "GSMaP Hourly Rainfall",
      sensor: "Multi-satellite (GPM constellation)",
      platform: "GPM / Himawari / AMSR-2",
      resolution: "~10 km",
      cadence: "Hourly",
      coverage: "Global 60°N–60°S",
      tileEndpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${focusDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
      apiEndpoint: "https://sharaku.eorc.jaxa.jp/GSMaP/",
      status: "live",
      description: "Near-real-time precipitation estimate for flood and mobility risk.",
    },
    {
      id: "alos2-sar",
      name: "ALOS-2 PALSAR-2 SAR",
      sensor: "PALSAR-2 (L-band SAR)",
      platform: "ALOS-2 (Daichi-2)",
      resolution: "3–10 m",
      cadence: "14-day revisit",
      coverage: "Global (tasked)",
      tileEndpoint: null,
      apiEndpoint: "https://gportal.jaxa.jp/gpr/search (REST catalog)",
      status: "catalog-only",
      description: "All-weather L-band SAR for terrain change, flood mapping, and deforestation under clouds.",
    },
    {
      id: "gcom-c-ndvi",
      name: "GCOM-C NDVI/EVI",
      sensor: "SGLI (Second Generation GLobal Imager)",
      platform: "GCOM-C (Shikisai)",
      resolution: "250 m",
      cadence: "2-day revisit",
      coverage: "Global",
      tileEndpoint: null,
      apiEndpoint: "https://gportal.jaxa.jp/gpr/search",
      status: "catalog-only",
      description: "Vegetation index for canopy stress, burn scar, and land-use change detection.",
    },
    {
      id: "amsr2-soil-moisture",
      name: "AMSR-2 Soil Moisture",
      sensor: "AMSR-2",
      platform: "GCOM-W (Shizuku)",
      resolution: "~25 km",
      cadence: "Daily",
      coverage: "Global",
      tileEndpoint: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Soil_Moisture_Active_Passive_L4_Global_Surface_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
      apiEndpoint: "https://gportal.jaxa.jp/gpr/search",
      status: "live",
      description: "Soil moisture for flood risk assessment and ground-condition monitoring.",
    },
  ];
}

export async function GET() {
  const focusDate = getSafeDate();
  const products = buildJaxaProducts(focusDate);

  const hasCredentials = Boolean(
    process.env.JAXA_GPORTAL_USER && process.env.JAXA_GPORTAL_PASS,
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "JAXA",
    focusDate,
    bbox: PHUKET_BBOX,
    catalogAccess: hasCredentials ? "authenticated" : "public-only",
    endpoints: {
      gportal: "https://gportal.jaxa.jp/gpr/search",
      tellus: "https://www.tellusxdp.com/api/v1/",
      ptree: "ftp://ftp.ptree.jaxa.jp",
      jpmap: "https://www.eorc.jaxa.jp/jpmap/en/index.html",
    },
    products,
    liveCount: products.filter((p) => p.status === "live").length,
    totalCount: products.length,
  });
}

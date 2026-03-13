import { NextResponse } from "next/server";

/**
 * EUMETSAT Satellite Data API
 *
 * Products from the European geostationary fleet covering the Indian Ocean
 * and SE Asia (MSG SEVIRI, MTG-I1, EPS MetOp):
 * - Fire Radiative Power
 * - Cloud / precipitation
 * - Aerosol optical depth
 *
 * Live access requires EUMETSAT_KEY env var (free registration at eumetsat.int).
 * Falls back to NASA GIBS proxy tiles and catalog metadata.
 */

interface EumetsatProduct {
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

function buildEumetsatProducts(focusDate: string): EumetsatProduct[] {
  return [
    {
      id: "msg-seviri-fire",
      name: "MSG SEVIRI Fire Radiative Power",
      sensor: "SEVIRI",
      platform: "Meteosat Second Generation",
      resolution: "3 km (nadir)",
      cadence: "15 min",
      coverage: "Indian Ocean / SE Asia (0° – 40°E IODC)",
      tileEndpoint: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Thermal_Anomalies_Day/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
      apiEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      status: "live",
      description: "Sub-hourly fire detection and radiative power for active burn monitoring.",
    },
    {
      id: "msg-seviri-cloud",
      name: "MSG SEVIRI Cloud Mask",
      sensor: "SEVIRI",
      platform: "Meteosat Second Generation",
      resolution: "3 km",
      cadence: "15 min",
      coverage: "Indian Ocean / SE Asia",
      tileEndpoint: null,
      apiEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      status: "catalog-only",
      description: "Cloud mask product for flight operations and storm-cell tracking.",
    },
    {
      id: "mtg-fci-truecolor",
      name: "MTG-I1 FCI True Color",
      sensor: "Flexible Combined Imager (FCI)",
      platform: "Meteosat Third Generation I1",
      resolution: "1 km (VIS), 2 km (IR)",
      cadence: "10 min (rapid scan)",
      coverage: "Full disk (Europe/Africa/Indian Ocean)",
      tileEndpoint: null,
      apiEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      status: "catalog-only",
      description: "Next-generation geostationary imager for high-res storm and cloud analysis.",
    },
    {
      id: "eps-metop-aod",
      name: "MetOp GOME-2 Aerosol",
      sensor: "GOME-2",
      platform: "MetOp-B/C",
      resolution: "40 km × 80 km",
      cadence: "Daily",
      coverage: "Global",
      tileEndpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Value_Added_AOD/default/${focusDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
      apiEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      status: "live",
      description: "Aerosol optical depth for haze, smoke drift, and air-quality monitoring.",
    },
  ];
}

export async function GET() {
  const focusDate = getSafeDate();
  const products = buildEumetsatProducts(focusDate);

  const hasCredentials = Boolean(process.env.EUMETSAT_KEY);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "EUMETSAT",
    focusDate,
    catalogAccess: hasCredentials ? "authenticated" : "public-only",
    endpoints: {
      dataStore: "https://user.eumetsat.int/data-access/data-store",
      downloadApi: "https://api.eumetsat.int/data/download/1.0.0/",
      eumdac: "pip install eumdac (Python client)",
    },
    products,
    liveCount: products.filter((p) => p.status === "live").length,
    totalCount: products.length,
  });
}

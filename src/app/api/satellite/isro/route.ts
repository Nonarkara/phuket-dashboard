import { NextResponse } from "next/server";

/**
 * ISRO Bhuvan Satellite Data API
 *
 * Products from Indian Space Research Organisation's Bhuvan geo-platform:
 * - Resourcesat AWiFS/LISS (ortho imagery)
 * - Cartosat DEM
 * - Land-use / land-cover baselines
 *
 * Public WMS endpoints require no authentication.
 */

interface IsroProduct {
  id: string;
  name: string;
  sensor: string;
  platform: string;
  resolution: string;
  cadence: string;
  coverage: string;
  wmsEndpoint: string | null;
  tileEndpoint: string | null;
  status: "live" | "catalog-only" | "offline";
  description: string;
}

function buildIsroProducts(): IsroProduct[] {
  return [
    {
      id: "resourcesat-awifs",
      name: "Resourcesat AWiFS",
      sensor: "AWiFS (Advanced Wide Field Sensor)",
      platform: "Resourcesat-2/2A",
      resolution: "56 m",
      cadence: "5-day revisit",
      coverage: "Global",
      wmsEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      tileEndpoint: null,
      status: "live",
      description: "Wide-field multispectral imagery for land-use baselines near borders.",
    },
    {
      id: "cartosat-dem",
      name: "Cartosat DEM",
      sensor: "PAN (stereo)",
      platform: "Cartosat-1/2",
      resolution: "30 m DEM",
      cadence: "Archive",
      coverage: "India + neighbors",
      wmsEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      tileEndpoint: null,
      status: "live",
      description: "Digital elevation model for terrain analysis and flood-plain mapping.",
    },
    {
      id: "liss-lulc",
      name: "LISS Land Use / Land Cover",
      sensor: "LISS-III/IV",
      platform: "Resourcesat-2",
      resolution: "24 m (LISS-III), 5.8 m (LISS-IV)",
      cadence: "Annual baseline",
      coverage: "India + SE Asia border zones",
      wmsEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      tileEndpoint: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
      status: "live",
      description: "Land-use classification for border terrain change detection.",
    },
    {
      id: "oceansat-chlorophyll",
      name: "Oceansat Chlorophyll",
      sensor: "OCM-3",
      platform: "Oceansat-3",
      resolution: "360 m",
      cadence: "2-day revisit",
      coverage: "Global ocean",
      wmsEndpoint: null,
      tileEndpoint: null,
      status: "catalog-only",
      description: "Ocean color for coastal water quality and Andaman Sea monitoring.",
    },
  ];
}

export async function GET() {
  const products = buildIsroProducts();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "ISRO",
    catalogAccess: "public-wms",
    endpoints: {
      bhuvanPortal: "https://bhuvan-app3.nrsc.gov.in/data/",
      wms: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      ogcServices: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/",
    },
    products,
    liveCount: products.filter((p) => p.status === "live").length,
    totalCount: products.length,
  });
}

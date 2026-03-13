import { NextResponse } from "next/server";

/**
 * Roscosmos ERS Satellite Data API
 *
 * Open-data STAC catalog from Russia's Earth Remote Sensing system:
 * - Meteor-M optical
 * - Elektro-L geostationary
 * - Arktika-M high-latitude
 *
 * Public STAC access, no authentication required.
 * Coverage of SE Asia is partial (primarily weather/geostationary).
 */

interface RoscosmosProduct {
  id: string;
  name: string;
  sensor: string;
  platform: string;
  resolution: string;
  cadence: string;
  coverage: string;
  stacEndpoint: string | null;
  status: "live" | "catalog-only" | "offline";
  description: string;
}

function buildRoscosmosProducts(): RoscosmosProduct[] {
  return [
    {
      id: "meteor-m-optical",
      name: "Meteor-M Optical",
      sensor: "MSU-MR (multispectral)",
      platform: "Meteor-M No.2 series",
      resolution: "1 km (VIS/IR)",
      cadence: "Daily (polar orbit)",
      coverage: "Global",
      stacEndpoint: "https://stacindex.org/catalogs/ers-open-data",
      status: "live",
      description: "Multispectral imagery for weather and land-surface analysis.",
    },
    {
      id: "elektro-l-geostationary",
      name: "Elektro-L Geostationary",
      sensor: "MSU-GS",
      platform: "Elektro-L No.3/4",
      resolution: "1 km (VIS), 4 km (IR)",
      cadence: "30 min",
      coverage: "Indian Ocean (76°E sub-point)",
      stacEndpoint: "https://stacindex.org/catalogs/ers-open-data",
      status: "live",
      description: "Geostationary coverage of Indian Ocean basin — useful for Andaman Sea weather.",
    },
    {
      id: "arktika-m-highres",
      name: "Arktika-M HEO",
      sensor: "MSU-GSM (multispectral)",
      platform: "Arktika-M No.1/2",
      resolution: "1 km",
      cadence: "15 min (apogee imaging)",
      coverage: "High-latitude (Arctic focus)",
      stacEndpoint: "https://stacindex.org/catalogs/ers-open-data",
      status: "catalog-only",
      description: "High-elliptical orbit — limited SE Asia utility but available in STAC catalog.",
    },
    {
      id: "kanopus-v-optical",
      name: "Kanopus-V Optical",
      sensor: "PSS (panchromatic + multispectral)",
      platform: "Kanopus-V",
      resolution: "2.1 m (PAN), 10.5 m (MS)",
      cadence: "3-day revisit",
      coverage: "Global (tasked)",
      stacEndpoint: null,
      status: "catalog-only",
      description: "High-resolution optical for detailed terrain and infrastructure mapping.",
    },
  ];
}

export async function GET() {
  const products = buildRoscosmosProducts();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "Roscosmos / ERS",
    catalogAccess: "public-stac",
    endpoints: {
      stacCatalog: "https://stacindex.org/catalogs/ers-open-data",
      pythonExample: "from pystac_client import Client; Client.open('...')",
    },
    products,
    liveCount: products.filter((p) => p.status === "live").length,
    totalCount: products.length,
    notes: "SE Asia coverage is best from Elektro-L geostationary and Meteor-M polar orbits.",
  });
}

import { NextResponse } from "next/server";

/**
 * Unified Satellite Catalog API
 *
 * Builds the catalog directly (no self-fetch) so it works on
 * Render free tier where loopback requests can time out.
 */

interface ProviderSummary {
  id: string;
  name: string;
  country: string;
  liveProducts: number;
  totalProducts: number;
  primaryEndpoint: string;
  accessLevel: string;
  notes: string;
}

export async function GET() {
  const providers: ProviderSummary[] = [
    {
      id: "jaxa",
      name: "JAXA",
      country: "Japan",
      liveProducts: 4,
      totalProducts: 6,
      primaryEndpoint: "https://gportal.jaxa.jp/gpr/search",
      accessLevel: process.env.JAXA_GPORTAL_USER ? "authenticated" : "public-only",
      notes: "Himawari-9 geostationary + ALOS-2 SAR + GSMaP rainfall + AMSR-2 soil moisture",
    },
    {
      id: "eumetsat",
      name: "EUMETSAT",
      country: "Europe",
      liveProducts: 2,
      totalProducts: 4,
      primaryEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      accessLevel: process.env.EUMETSAT_KEY ? "authenticated" : "public-only",
      notes: "MSG SEVIRI fire/cloud for Indian Ocean + MetOp aerosol",
    },
    {
      id: "isro",
      name: "ISRO",
      country: "India",
      liveProducts: 3,
      totalProducts: 4,
      primaryEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      accessLevel: "public-wms",
      notes: "Resourcesat AWiFS, Cartosat DEM, LISS land-use baselines",
    },
    {
      id: "roscosmos",
      name: "Roscosmos",
      country: "Russia",
      liveProducts: 2,
      totalProducts: 4,
      primaryEndpoint: "https://stacindex.org/catalogs/ers-open-data",
      accessLevel: "public-stac",
      notes: "Elektro-L geostationary + Meteor-M polar for Indian Ocean weather",
    },
  ];

  const totalLive = providers.reduce((s, p) => s + p.liveProducts, 0);
  const totalAll = providers.reduce((s, p) => s + p.totalProducts, 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      totalProviders: providers.length,
      totalLiveProducts: totalLive,
      totalProducts: totalAll,
    },
    providers,
  });
}

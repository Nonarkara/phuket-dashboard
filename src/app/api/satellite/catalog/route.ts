import { NextResponse } from "next/server";

/**
 * Unified Satellite Catalog API
 *
 * Aggregates all satellite providers into a single catalog response
 * for the dashboard to display provider status and product counts.
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

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;

  // Fetch all satellite providers in parallel
  const [jaxa, eumetsat, isro, roscosmos] = await Promise.all([
    fetch(`${baseUrl}/api/satellite/jaxa`).then((r) => r.json()).catch(() => null),
    fetch(`${baseUrl}/api/satellite/eumetsat`).then((r) => r.json()).catch(() => null),
    fetch(`${baseUrl}/api/satellite/isro`).then((r) => r.json()).catch(() => null),
    fetch(`${baseUrl}/api/satellite/roscosmos`).then((r) => r.json()).catch(() => null),
  ]);

  const providers: ProviderSummary[] = [
    {
      id: "jaxa",
      name: "JAXA",
      country: "Japan",
      liveProducts: jaxa?.liveCount ?? 0,
      totalProducts: jaxa?.totalCount ?? 0,
      primaryEndpoint: "https://gportal.jaxa.jp/gpr/search",
      accessLevel: jaxa?.catalogAccess ?? "unknown",
      notes: "Best SE Asia coverage: Himawari geostationary + ALOS-2 SAR + GSMaP rainfall",
    },
    {
      id: "eumetsat",
      name: "EUMETSAT",
      country: "Europe",
      liveProducts: eumetsat?.liveCount ?? 0,
      totalProducts: eumetsat?.totalCount ?? 0,
      primaryEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
      accessLevel: eumetsat?.catalogAccess ?? "unknown",
      notes: "MSG SEVIRI covers Indian Ocean for hourly storms/haze/fire products",
    },
    {
      id: "isro",
      name: "ISRO",
      country: "India",
      liveProducts: isro?.liveCount ?? 0,
      totalProducts: isro?.totalCount ?? 0,
      primaryEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
      accessLevel: isro?.catalogAccess ?? "unknown",
      notes: "Public WMS — land-use baselines and Cartosat DEM for border analysis",
    },
    {
      id: "roscosmos",
      name: "Roscosmos / ERS",
      country: "Russia",
      liveProducts: roscosmos?.liveCount ?? 0,
      totalProducts: roscosmos?.totalCount ?? 0,
      primaryEndpoint: "https://stacindex.org/catalogs/ers-open-data",
      accessLevel: roscosmos?.catalogAccess ?? "unknown",
      notes: "STAC catalog — Elektro-L geostationary for Indian Ocean weather",
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

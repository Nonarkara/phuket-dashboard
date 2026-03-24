import { NextResponse } from "next/server";

interface ProviderSummary {
  id: string;
  name: string;
  country: string;
  capabilityCount: number;
  primaryEndpoint: string;
  accessLevel: string;
  notes: string;
  health: "live" | "stale" | "offline";
  checkedAt: string;
}

interface ProviderDefinition {
  id: string;
  name: string;
  country: string;
  capabilityCount: number;
  primaryEndpoint: string;
  accessLevel: string;
  notes: string;
}

const PROVIDERS: ProviderDefinition[] = [
  {
    id: "jaxa",
    name: "JAXA",
    country: "Japan",
    capabilityCount: 6,
    primaryEndpoint: "https://gportal.jaxa.jp/gpr/search",
    accessLevel: process.env.JAXA_GPORTAL_USER ? "authenticated" : "public-only",
    notes: "Himawari-9 geostationary, ALOS-2 SAR, GSMaP rainfall, and AMSR-2 support.",
  },
  {
    id: "eumetsat",
    name: "EUMETSAT",
    country: "Europe",
    capabilityCount: 4,
    primaryEndpoint: "https://api.eumetsat.int/data/download/1.0.0/",
    accessLevel: process.env.EUMETSAT_KEY ? "authenticated" : "public-only",
    notes: "MSG SEVIRI fire and cloud products plus MetOp aerosol coverage.",
  },
  {
    id: "isro",
    name: "ISRO",
    country: "India",
    capabilityCount: 4,
    primaryEndpoint: "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
    accessLevel: "public-wms",
    notes: "Resourcesat AWiFS, Cartosat DEM, and LISS land-use baselines.",
  },
  {
    id: "roscosmos",
    name: "Roscosmos",
    country: "Russia",
    capabilityCount: 4,
    primaryEndpoint: "https://stacindex.org/catalogs/ers-open-data",
    accessLevel: "public-stac",
    notes: "Elektro-L and Meteor-M references for Indian Ocean weather context.",
  },
];

async function probeEndpoint(url: string) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
      headers: {
        Accept: "*/*",
        "User-Agent": "PhuketGovernorWarRoom/1.0",
      },
    });

    return {
      checkedAt,
      health: response.ok ? ("live" as const) : ("offline" as const),
    };
  } catch {
    return {
      checkedAt,
      health: "offline" as const,
    };
  }
}

export async function GET() {
  const providers: ProviderSummary[] = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const probe = await probeEndpoint(provider.primaryEndpoint);
      return {
        ...provider,
        health: probe.health,
        checkedAt: probe.checkedAt,
      };
    }),
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      totalProviders: providers.length,
      liveProviders: providers.filter((provider) => provider.health === "live").length,
      offlineProviders: providers.filter((provider) => provider.health === "offline").length,
      totalCapabilities: providers.reduce(
        (sum, provider) => sum + provider.capabilityCount,
        0,
      ),
    },
    providers,
  });
}

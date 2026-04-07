import { NextRequest, NextResponse } from "next/server";
import { loadCityVibes, resolveScenario } from "../../../lib/governor";
import { cached } from "../../../lib/cache";

export async function GET(request: NextRequest) {
  const scenario = resolveScenario(request.nextUrl.searchParams.get("scenario"));
  const payload = await cached(
    `city-vibes:${scenario}`,
    180,
    () => loadCityVibes({ scenario }),
  );
  return NextResponse.json(payload);
}

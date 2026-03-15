import { NextRequest, NextResponse } from "next/server";
import { resolveScenario } from "../../../../lib/governor";
import { loadTourismHotspots } from "../../../../lib/war-room-integrations";

export async function GET(request: NextRequest) {
  const scenario = resolveScenario(request.nextUrl.searchParams.get("scenario"));
  return NextResponse.json(await loadTourismHotspots({ scenario }));
}

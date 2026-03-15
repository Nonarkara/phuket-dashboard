import { NextRequest, NextResponse } from "next/server";
import { loadCityVibes, resolveScenario } from "../../../lib/governor";

export async function GET(request: NextRequest) {
  const scenario = resolveScenario(request.nextUrl.searchParams.get("scenario"));
  return NextResponse.json(await loadCityVibes({ scenario }));
}

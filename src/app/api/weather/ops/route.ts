import { NextResponse } from "next/server";
import { loadOperationalWeather } from "../../../../lib/weather-ops";
import { resolveScenario } from "../../../../lib/scenario";

export async function GET(request: Request) {
  const scenario = resolveScenario(new URL(request.url).searchParams.get("scenario"));
  return NextResponse.json(await loadOperationalWeather({ scenario }));
}

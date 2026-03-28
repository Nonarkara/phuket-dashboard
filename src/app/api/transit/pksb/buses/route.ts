import { NextResponse } from "next/server";
import { loadPksbBusPositions } from "../../../../../lib/pksb-live";
import { resolveScenario } from "../../../../../lib/scenario";

export const revalidate = 0;

export async function GET(request: Request) {
  const scenario = resolveScenario(new URL(request.url).searchParams.get("scenario"));
  return NextResponse.json(await loadPksbBusPositions({ scenario }));
}

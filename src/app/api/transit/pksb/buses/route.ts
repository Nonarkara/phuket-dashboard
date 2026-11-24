import { NextResponse } from "next/server";
import {
  buildUnavailablePksbBusResponse,
  loadPksbBusPositions,
} from "../../../../../lib/pksb-live";
import { recordSourceHealth } from "../../../../../lib/source-health";
import { resolveScenario } from "../../../../../lib/scenario";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const scenario = resolveScenario(
      new URL(request.url).searchParams.get("scenario"),
    );
    const payload = await loadPksbBusPositions({ scenario });
    return NextResponse.json(payload, { status: 200 });
  } catch {
    recordSourceHealth("pksb-buses", "unavailable");
    return NextResponse.json(buildUnavailablePksbBusResponse("upstream_unavailable"), {
      status: 200,
    });
  }
}

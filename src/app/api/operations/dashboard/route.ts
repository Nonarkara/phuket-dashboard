import { NextResponse } from "next/server";
import { cached } from "../../../../lib/cache";
import {
  buildUnavailableOperationsResponse,
  loadOperationsDashboard,
} from "../../../../lib/operations-dashboard";
import { recordSourceHealth } from "../../../../lib/source-health";
import { resolveScenario } from "../../../../lib/scenario";

export async function GET(request: Request) {
  try {
    const scenario = resolveScenario(
      new URL(request.url).searchParams.get("scenario"),
    );
    const payload = await cached(
      `operations-dashboard:${scenario}`,
      30,
      () => loadOperationsDashboard({ scenario }),
    );
    return NextResponse.json(payload, { status: 200 });
  } catch {
    recordSourceHealth("operations", "unavailable");
    return NextResponse.json(
      buildUnavailableOperationsResponse("upstream_unavailable"),
      { status: 200 },
    );
  }
}

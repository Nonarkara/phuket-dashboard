import { NextResponse } from "next/server";
import { cached } from "../../../../lib/cache";
import { loadOperationsDashboard } from "../../../../lib/operations-dashboard";
import { resolveScenario } from "../../../../lib/scenario";

export async function GET(request: Request) {
  const scenario = resolveScenario(new URL(request.url).searchParams.get("scenario"));
  const payload = await cached(
    `operations-dashboard:${scenario}`,
    30,
    () => loadOperationsDashboard({ scenario }),
  );
  return NextResponse.json(payload);
}

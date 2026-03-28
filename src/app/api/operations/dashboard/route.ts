import { NextResponse } from "next/server";
import { loadOperationsDashboard } from "../../../../lib/operations-dashboard";
import { resolveScenario } from "../../../../lib/scenario";

export async function GET(request: Request) {
  const scenario = resolveScenario(new URL(request.url).searchParams.get("scenario"));
  return NextResponse.json(await loadOperationsDashboard({ scenario }));
}

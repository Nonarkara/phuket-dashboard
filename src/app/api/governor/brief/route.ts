import { NextRequest, NextResponse } from "next/server";
import { buildGovernorBrief, resolveScenario } from "../../../../lib/governor";
import { cached } from "../../../../lib/cache";

export async function GET(request: NextRequest) {
  const scenario = resolveScenario(request.nextUrl.searchParams.get("scenario"));
  const brief = await cached(`governor-brief-${scenario}`, 180, () => buildGovernorBrief({ scenario }));
  return NextResponse.json(brief);
}

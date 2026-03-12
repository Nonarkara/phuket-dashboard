import { NextRequest, NextResponse } from "next/server";
import {
  getConvergenceCorridor,
  loadCorridorConvergence,
} from "../../../../lib/convergence";

export async function GET(request: NextRequest) {
  const corridorId =
    request.nextUrl.searchParams.get("corridor") ?? "phuket-andaman";

  if (!getConvergenceCorridor(corridorId)) {
    return NextResponse.json(
      {
        error: "Unsupported corridor",
        supportedCorridors: ["phuket-andaman"],
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await loadCorridorConvergence(corridorId));
}

import { NextResponse } from "next/server";
import { loadNstWatershed } from "../../../../lib/nst/hydrology";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(await loadNstWatershed(searchParams.get("scenario")));
}

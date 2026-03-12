import { NextResponse } from "next/server";
import { buildMapOverlayCatalog } from "../../../../lib/map-overlays";

export async function GET() {
  return NextResponse.json(buildMapOverlayCatalog());
}

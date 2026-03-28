import { NextResponse } from "next/server";
import { loadRainfallPoints } from "../../../lib/rainfall";

export async function GET() {
  return NextResponse.json(await loadRainfallPoints());
}

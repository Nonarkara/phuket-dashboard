import { NextResponse } from "next/server";
import { loadThailandIncidents } from "../../../lib/thailand-monitor";

export async function GET() {
  return NextResponse.json(await loadThailandIncidents());
}

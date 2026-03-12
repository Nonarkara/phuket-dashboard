import { NextResponse } from "next/server";
import { loadIntelligencePackages } from "../../../../lib/intelligence";

export async function GET() {
  return NextResponse.json(await loadIntelligencePackages());
}

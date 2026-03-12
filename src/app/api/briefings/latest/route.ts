import { NextResponse } from "next/server";
import { fallbackBriefing } from "../../../../lib/mock-data";
import { buildLatestBriefing } from "../../../../lib/intelligence";

export async function GET() {
  try {
    return NextResponse.json(await buildLatestBriefing());
  } catch {
    return NextResponse.json(fallbackBriefing, { status: 200 });
  }
}

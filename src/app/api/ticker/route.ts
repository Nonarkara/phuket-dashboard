import { NextResponse } from "next/server";
import { fallbackTicker } from "../../../lib/mock-data";
import { buildTickerFromPackages } from "../../../lib/intelligence";

export async function GET() {
  try {
    return NextResponse.json(await buildTickerFromPackages());
  } catch {
    return NextResponse.json(fallbackTicker, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { fallbackTicker } from "../../../lib/mock-data";
import { buildTickerFromPackages } from "../../../lib/intelligence";
import { cached } from "../../../lib/cache";

export async function GET() {
  try {
    const data = await cached("ticker", 120, () => buildTickerFromPackages());
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(fallbackTicker, { status: 200 });
  }
}

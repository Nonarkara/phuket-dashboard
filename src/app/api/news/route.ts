import { NextResponse } from "next/server";
import { fallbackNews } from "../../../lib/mock-data";
import { buildNewsFromPackages } from "../../../lib/intelligence";

export async function GET() {
  try {
    return NextResponse.json(await buildNewsFromPackages());
  } catch {
    return NextResponse.json(fallbackNews, { status: 200 });
  }
}

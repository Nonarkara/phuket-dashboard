import { NextResponse } from "next/server";
import { loadTrafficFeed } from "../../../lib/traffic";

export async function GET() {
  return NextResponse.json(await loadTrafficFeed());
}

import { NextResponse } from "next/server";
import { loadPublicCameraFeed } from "../../../lib/public-cameras";

export async function GET() {
  return NextResponse.json(await loadPublicCameraFeed());
}

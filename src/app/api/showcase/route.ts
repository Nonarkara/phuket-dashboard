import { NextResponse } from "next/server";
import { loadShowcasePayload } from "../../../lib/showcase";

export async function GET() {
  return NextResponse.json(await loadShowcasePayload());
}

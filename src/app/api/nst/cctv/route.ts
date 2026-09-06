import { NextResponse } from "next/server";
import { loadNstCctv } from "../../../../lib/nst/cctv";

export async function GET() {
  return NextResponse.json(await loadNstCctv());
}

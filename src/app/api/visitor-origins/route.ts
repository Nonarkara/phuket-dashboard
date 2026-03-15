import { NextResponse } from "next/server";
import { loadPhuketVisitorOrigins } from "../../../lib/phuket-visitor-origins";

export async function GET() {
  return NextResponse.json(await loadPhuketVisitorOrigins());
}

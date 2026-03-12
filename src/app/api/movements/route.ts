import { NextResponse } from "next/server";
import { fallbackRefugees } from "../../../lib/mock-data";

export async function GET() {
  return NextResponse.json(fallbackRefugees, { status: 200 });
}

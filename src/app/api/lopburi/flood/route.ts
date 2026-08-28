import { NextResponse } from "next/server";
import { loadLopburiFlood } from "../../../../lib/lopburi/flood";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await loadLopburiFlood(searchParams.get("scenario"));
  return NextResponse.json(data);
}

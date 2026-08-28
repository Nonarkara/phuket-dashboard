import { NextResponse } from "next/server";
import { loadLopburiSocial } from "../../../../lib/lopburi/social";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await loadLopburiSocial(searchParams.get("scenario"));
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { loadLopburiCctv } from "../../../../lib/lopburi/cctv";

export async function GET() {
  return NextResponse.json(await loadLopburiCctv());
}

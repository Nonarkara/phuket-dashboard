import { NextResponse } from "next/server";
import { getSourceHealthSnapshot } from "../../../lib/source-health";

export const revalidate = 30;

export async function GET() {
  const checkedAt = new Date().toISOString();
  const sources = getSourceHealthSnapshot();
  const build =
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.GITHUB_SHA?.slice(0, 7) ??
    "local";

  const payload = {
    ok: true,
    service: "phuket-dashboard",
    version: "7.0.0",
    build,
    checked_at: checkedAt,
    sources,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}

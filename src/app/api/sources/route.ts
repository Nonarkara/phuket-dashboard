import { NextResponse } from "next/server";
import { getErrorMessage } from "../../../lib/errors";
import { buildFreshness } from "../../../lib/freshness";
import { buildEnhancedSourceCatalog } from "../../../lib/intelligence";

export async function GET() {
  try {
    return NextResponse.json(await buildEnhancedSourceCatalog());
  } catch (error: unknown) {
    console.error("Reference sources error:", getErrorMessage(error));
    const checkedAt = new Date().toISOString();

    return NextResponse.json(
      {
        generatedAt: checkedAt,
        sources: [],
        freshness: buildFreshness({
          checkedAt,
          observedAt: null,
          fallbackTier: "unavailable",
          sourceIds: ["Governor source health snapshot"],
        }),
      },
      { status: 200 },
    );
  }
}

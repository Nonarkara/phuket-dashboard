import { NextResponse } from "next/server";
import { getErrorMessage } from "../../../lib/errors";
import { fallbackSources } from "../../../lib/mock-data";
import { buildEnhancedSourceCatalog } from "../../../lib/intelligence";

export async function GET() {
  try {
    return NextResponse.json(await buildEnhancedSourceCatalog());
  } catch (error: unknown) {
    console.error("Reference sources error:", getErrorMessage(error));
    return NextResponse.json(fallbackSources, { status: 200 });
  }
}

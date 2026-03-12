import { NextRequest, NextResponse } from "next/server";
import { isAseanCountryCode } from "../../../../lib/asean-country-registry";
import { loadAseanCountryProfile } from "../../../../lib/asean-economics";
import { getErrorMessage } from "../../../../lib/errors";

export async function GET(request: NextRequest) {
  const countryParam =
    request.nextUrl.searchParams.get("country")?.trim().toUpperCase() ?? "THA";

  if (!isAseanCountryCode(countryParam)) {
    return NextResponse.json(
      { error: `Unsupported country code: ${countryParam}` },
      { status: 400 },
    );
  }

  try {
    const payload = await loadAseanCountryProfile(countryParam);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error("ASEAN profile route error:", getErrorMessage(error));
    return NextResponse.json(
      { error: "Unable to load ASEAN country profile" },
      { status: 500 },
    );
  }
}

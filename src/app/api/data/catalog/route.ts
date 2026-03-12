import { NextResponse } from "next/server";
import { buildDatabaseCatalog } from "../../../../lib/database-browser";
import { getErrorMessage } from "../../../../lib/errors";

export async function GET() {
  try {
    return NextResponse.json(await buildDatabaseCatalog());
  } catch (error: unknown) {
    console.error("Database catalog error:", getErrorMessage(error));
    return NextResponse.json(
      {
        databaseConfigured: false,
        generatedAt: new Date().toISOString(),
        totalRows: 0,
        tables: [],
      },
      { status: 200 },
    );
  }
}

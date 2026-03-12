import { NextRequest, NextResponse } from "next/server";
import {
  exportDatabaseTableRows,
  getDatabaseTableDescriptor,
} from "../../../../lib/database-browser";
import { getErrorMessage } from "../../../../lib/errors";

function serializeCsvValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function toCsv(columns: string[], rows: Array<Record<string, unknown>>) {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((column) => serializeCsvValue(row[column])).join(","),
  );

  return [header, ...body].join("\n");
}

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  if (!table) {
    return NextResponse.json(
      { error: "A table query parameter is required." },
      { status: 400 },
    );
  }

  const descriptor = getDatabaseTableDescriptor(table);
  if (!descriptor) {
    return NextResponse.json(
      { error: `Unknown table: ${table}` },
      { status: 400 },
    );
  }

  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: "format must be csv or json." },
      { status: 400 },
    );
  }

  try {
    const exported = await exportDatabaseTableRows(table);

    if (!exported) {
      return NextResponse.json(
        { error: "Database is not configured or export data is unavailable." },
        { status: 503 },
      );
    }

    const fileStem = `${descriptor.id}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      return new NextResponse(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            table: descriptor.id,
            label: descriptor.label,
            rows: exported.rows,
          },
          null,
          2,
        ),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="${fileStem}.json"`,
          },
        },
      );
    }

    const csv = toCsv(descriptor.columns, exported.rows);

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${fileStem}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error("Database export error:", getErrorMessage(error));
    return NextResponse.json(
      { error: "Unable to export database data." },
      { status: 500 },
    );
  }
}

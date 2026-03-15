import { NextResponse } from "next/server";

/**
 * ReliefWeb Humanitarian Reports Proxy
 *
 * Fetches recent humanitarian reports relevant to Thailand and SE Asia.
 * No API key required (appname parameter used for identification).
 */

export async function GET() {
  try {
    const params = new URLSearchParams({
      appname: "phuket-dashboard",
      "filter[field]": "country.name",
      "filter[value]": "Thailand",
      limit: "20",
      sort: "date:desc",
    });

    const res = await fetch(
      `https://api.reliefweb.int/v1/reports?${params}`,
      { next: { revalidate: 1800 } },
    );

    if (!res.ok) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        provider: "ReliefWeb (UN OCHA)",
        status: "upstream_error",
        reports: [],
        sources: ["https://api.reliefweb.int/v1/"],
      });
    }

    const data = await res.json();
    const items = data?.data ?? [];

    const reports = items.map((item: {
      id: number;
      fields: {
        title: string;
        date: { original: string };
        source: Array<{ name: string }>;
        country: Array<{ name: string }>;
        url: string;
        theme: Array<{ name: string }>;
      };
    }) => ({
      id: String(item.id),
      title: item.fields?.title ?? "Untitled",
      date: item.fields?.date?.original ?? null,
      source: item.fields?.source?.[0]?.name ?? "Unknown",
      country: item.fields?.country?.[0]?.name ?? "Unknown",
      url: item.fields?.url ?? null,
      themes: (item.fields?.theme ?? []).map((t: { name: string }) => t.name),
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "ReliefWeb (UN OCHA)",
      status: "ok",
      totalReports: reports.length,
      reports,
      sources: ["https://api.reliefweb.int/v1/reports"],
    });
  } catch (err) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "ReliefWeb (UN OCHA)",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      reports: [],
      sources: ["https://api.reliefweb.int/v1/"],
    });
  }
}

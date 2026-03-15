import { NextResponse } from "next/server";

/**
 * NABC Agricultural Data Proxy
 *
 * Fetches daily commodity prices from the National Agricultural Big Data Center.
 * No API key required.
 */

const PRODUCTS = ["rice", "rubber", "palm oil", "shrimp", "pineapple"];

interface PriceEntry {
  product: string;
  price: number | null;
  unit: string | null;
  date: string | null;
}

export async function GET() {
  const results: PriceEntry[] = [];

  for (const product of PRODUCTS) {
    try {
      const res = await fetch(
        `https://agriapi.nabc.go.th/api/daily-prices/product?product_name=${encodeURIComponent(product)}`,
        { next: { revalidate: 3600 } },
      );

      if (res.ok) {
        const data = await res.json();
        const latest = Array.isArray(data) ? data[0] : data;
        results.push({
          product,
          price: latest?.price ?? null,
          unit: latest?.unit ?? "THB/kg",
          date: latest?.date ?? null,
        });
      } else {
        results.push({ product, price: null, unit: null, date: null });
      }
    } catch {
      results.push({ product, price: null, unit: null, date: null });
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: "NABC (National Agricultural Big Data Center)",
    products: results,
    sources: [
      "https://agriapi.nabc.go.th/api/daily-prices/product",
      "https://agriapi.nabc.go.th/api/production-index-month/sector",
    ],
  });
}

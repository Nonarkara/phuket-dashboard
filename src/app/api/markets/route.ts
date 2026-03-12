import { NextResponse } from "next/server";
import { getErrorMessage } from "../../../lib/errors";
import {
  fallbackAseanGdp,
  fallbackEconomicIndicators,
} from "../../../lib/mock-data";
import {
  loadLatestStoredAseanGdpSnapshot,
  loadStoredMarketIndicators,
  persistAseanGdpSnapshot,
  persistMarketIndicators,
} from "../../../lib/history-store";
import {
  fetchAseanGdpSnapshot,
  fetchReferenceEconomicIndicators,
} from "../../../lib/reference-data";
import type { MarketRadarResponse } from "../../../types/dashboard";

export async function GET() {
  const capturedAt = new Date();
  let signals = fallbackEconomicIndicators;
  let aseanGdp = fallbackAseanGdp;
  const sources = new Set<string>();
  let liveSignalsLoaded = false;
  let liveMacroLoaded = false;

  try {
    const indicators = await fetchReferenceEconomicIndicators();
    if (indicators.length > 0) {
      signals = indicators;
      sources.add("ExchangeRate API");
      sources.add("Binance Ticker");
      liveSignalsLoaded = true;

      try {
        await persistMarketIndicators(indicators, capturedAt);
      } catch (error: unknown) {
        console.error("Market persistence error:", getErrorMessage(error));
      }
    }
  } catch (error: unknown) {
    console.error("Reference markets error:", getErrorMessage(error));
  }

  if (!liveSignalsLoaded) {
    const storedSignals = await loadStoredMarketIndicators();
    if (storedSignals && storedSignals.length > 0) {
      signals = storedSignals;
      sources.add("Postgres market history");
    }
  }

  try {
    const gdpSnapshot = await fetchAseanGdpSnapshot();
    if (gdpSnapshot.length > 0) {
      aseanGdp = gdpSnapshot;
      sources.add("World Bank WDI");
      liveMacroLoaded = true;

      try {
        await persistAseanGdpSnapshot(gdpSnapshot, capturedAt);
      } catch (error: unknown) {
        console.error("ASEAN GDP persistence error:", getErrorMessage(error));
      }
    }
  } catch (error: unknown) {
    console.error("ASEAN GDP snapshot error:", getErrorMessage(error));
  }

  if (!liveMacroLoaded) {
    const storedMacro = await loadLatestStoredAseanGdpSnapshot();
    if (storedMacro && storedMacro.length > 0) {
      aseanGdp = storedMacro;
      sources.add("Postgres macro history");
    }
  }

  const payload: MarketRadarResponse = {
    generatedAt: capturedAt.toISOString(),
    data: signals,
    signals,
    aseanGdp,
    sources:
      sources.size > 0
        ? Array.from(sources)
        : ["Fallback markets", "Fallback macro snapshot"],
  };

  return NextResponse.json(payload);
}

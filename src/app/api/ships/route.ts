import { NextResponse } from "next/server";
import { cached } from "../../../lib/cache";
import type { AisShip } from "../../../types/dashboard";

const AIS_KEY = process.env.AISSTREAM_API_KEY ?? "";

// Wide SE Asia bbox — Gulf of Thailand has much better AIS coverage than Andaman
// ponytail: aisstream.io is crowd-sourced terrestrial AIS — Andaman Sea has sparse receivers;
//           Gulf of Thailand and Malacca Strait receivers are denser. Ships appear when in range.
const BBOX: [[number, number], [number, number]] = [[1.0, 92.0], [21.5, 108.0]];

// Collect for 5s, cache 30s — keeps WS connections reasonable
const COLLECT_MS = 5000;
const CACHE_TTL = 30;

async function loadAisShips(): Promise<AisShip[]> {
  if (!AIS_KEY) return [];

  return new Promise<AisShip[]>((resolve) => {
    const vessels = new Map<number, AisShip>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve([...vessels.values()]);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    } catch {
      return resolve([]);
    }

    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      finish();
    }, COLLECT_MS);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        APIKey: AIS_KEY,
        BoundingBoxes: [BBOX],
        FilterMessageTypes: ["PositionReport"],
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.MessageType !== "PositionReport") return;
        const md: Record<string, unknown> = msg.MetaData ?? msg.Metadata ?? {};
        const pr: Record<string, unknown> = msg.Message?.PositionReport ?? {};
        const mmsi = Number(md.MMSI);
        if (!mmsi) return;
        const rawHeading = Number(pr.TrueHeading);
        vessels.set(mmsi, {
          mmsi,
          name: String(md.ShipName ?? "").trim() || `MMSI ${mmsi}`,
          lat: Number(md.latitude),
          lng: Number(md.longitude),
          sog: Number(pr.Sog ?? 0),
          cog: Number(pr.Cog ?? 0),
          heading: rawHeading !== 511 ? rawHeading : Number(pr.Cog ?? 0),
          navStatus: Number(pr.NavigationalStatus ?? 15),
          lastSeen: String(md.time_utc ?? new Date().toISOString()),
        });
      } catch { /* malformed message — skip */ }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      finish();
    };

    ws.onclose = () => {
      clearTimeout(timer);
      finish();
    };
  });
}

export async function GET() {
  const ships = await cached("ais-ships:seasia", CACHE_TTL, loadAisShips);
  return NextResponse.json(ships);
}

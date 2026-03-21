import { NextResponse } from "next/server";
import type {
  PksbBusPosition,
  PksbBusPositionResponse,
} from "../../../../../types/dashboard";
import { simulateBusPositions } from "../../../../../lib/pksb-simulation";

export const revalidate = 0;

const PKSB_API = process.env.PKSB_API_URL ?? "http://localhost:3099";

interface SmartBusVehicle {
  id: string;
  routeId: string;
  licensePlate: string;
  vehicleId: string;
  coordinates: [number, number];
  heading: number;
  speedKph: number;
  status: "moving" | "dwelling" | "unknown";
  updatedAt: string;
}

interface SmartBusAllResponse {
  vehicles: SmartBusVehicle[];
  updatedAt: string;
}

export async function GET() {
  try {
    const res = await fetch(`${PKSB_API}/api/vehicles/all`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) {
      const simulated = simulateBusPositions();
      return NextResponse.json<PksbBusPositionResponse>({
        generatedAt: new Date().toISOString(),
        buses: simulated,
      });
    }

    const data: SmartBusAllResponse = await res.json();

    const buses: PksbBusPosition[] = (data.vehicles ?? []).map((v) => ({
      id: v.id,
      routeId: v.routeId,
      licensePlate: v.licensePlate,
      vehicleId: v.vehicleId,
      lng: v.coordinates[1],
      lat: v.coordinates[0],
      heading: v.heading,
      speedKph: v.speedKph,
      status: v.status,
      updatedAt: v.updatedAt,
    }));

    return NextResponse.json<PksbBusPositionResponse>({
      generatedAt: new Date().toISOString(),
      buses,
    });
  } catch {
    // Fallback: simulate bus positions from timetable data
    const simulated = simulateBusPositions();
    return NextResponse.json<PksbBusPositionResponse>({
      generatedAt: new Date().toISOString(),
      buses: simulated,
    });
  }
}

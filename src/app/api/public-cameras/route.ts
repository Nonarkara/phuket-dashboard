import { NextResponse } from "next/server";
import {
  cameraScoutTargets,
  phuketPublicCameras,
} from "../../../lib/public-cameras";
import type { PublicCameraResponse } from "../../../types/dashboard";

export async function GET() {
  const payload: PublicCameraResponse = {
    generatedAt: new Date().toISOString(),
    source: [
      "SCS Phuket public webcams",
      "SSS Phuket Kata Beach live cam",
      "Governor scout targets pending validation",
    ],
    cameras: phuketPublicCameras,
    scoutTargets: cameraScoutTargets,
  };

  return NextResponse.json(payload);
}

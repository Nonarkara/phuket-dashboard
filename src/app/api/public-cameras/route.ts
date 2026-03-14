import { NextResponse } from "next/server";
import { phuketPublicCameras } from "../../../lib/public-cameras";
import type { PublicCameraResponse } from "../../../types/dashboard";

export async function GET() {
  const payload: PublicCameraResponse = {
    generatedAt: new Date().toISOString(),
    source: [
      "Phuket 101 public webcams",
      "SSS Phuket Kata Beach live cam",
      "Webcamtaxi Phuket public camera pages",
    ],
    cameras: phuketPublicCameras,
  };

  return NextResponse.json(payload);
}

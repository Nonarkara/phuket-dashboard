import { NextResponse } from "next/server";
import { thaiFloodStationsModule } from "../../../modules/thailand/thai-flood-stations";

export async function GET() {
  try {
    const stations = await thaiFloodStationsModule.fetchData();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "HII / ThaiWater API v3 (https://phuket.thaiwater.net)",
      status: "ok",
      stations,
      sources: [
        "https://phuket.thaiwater.net",
        "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=83",
        "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=83",
      ],
    });
  } catch (error) {
    console.error("Error fetching ThaiWater telemetry:", error);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      provider: "HII / ThaiWater (Fallback)",
      status: "fallback",
      stations: thaiFloodStationsModule.mockData,
      sources: ["https://phuket.thaiwater.net"],
    });
  }
}

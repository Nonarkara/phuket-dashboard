/**
 * Phuket sub-district (tambon) boundary polygons — sourced from GISTDA
 * Administrative Boundary Service (ArcGIS FeatureServer, open, no auth).
 *
 * Returns a GeoJSON FeatureCollection of the 17 Phuket island tambons
 * plus Ko Yao islands. Cached for 24h (boundaries change rarely).
 * Source: gistdaportal.gistda.or.th (DOPA / GISTDA)
 */
import { NextResponse } from "next/server";
import { cached } from "../../../../lib/cache";

const GISTDA_TAMBON_URL =
  "https://gistdaportal.gistda.or.th/arcgis/rest/services/" +
  "%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B9%80%E0%B8%82%E0%B8%95%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%81%E0%B8%84%E0%B8%A3%E0%B8%AD%E0%B8%87" +
  "/MapServer/4/query?geometry=98.25%2C7.65%2C98.55%2C8.2" +
  "&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects" +
  "&inSR=4326&outFields=T_Name_E%2CA_Name_E%2CAdmin_code%2CT_Name_T%2CA_Name_T" +
  "&f=geojson&outSR=4326";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await cached("gistda-tambons-phuket", 86400, async () => {
    const res = await fetch(GISTDA_TAMBON_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GISTDA ${res.status}`);
    return res.json();
  });
  return NextResponse.json(data);
}

// ─── Satellite layer catalog ────────────────────────────────────
// Free, no-token raster layers (NASA GIBS + Esri) rendered as a
// deck.gl TileLayer above the basemap. Dated layers use yesterday's
// scan so tiles are guaranteed to exist. Shared by every province map.

export interface SatelliteLayerDefinition {
  id: string;
  label: string;
  shortLabel: string;
  source: string;
  opacity: number;
  maxZoom: number;
  tileTemplate: string;
}

function gibsDate(daysAgo = 1): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function buildSatelliteLayerCatalog(): SatelliteLayerDefinition[] {
  const date = gibsDate(1);
  return [
    {
      id: "viirs-true-color",
      label: "VIIRS True Color (daily)",
      shortLabel: "TRUE",
      source: "NASA GIBS / VIIRS SNPP",
      opacity: 0.78,
      maxZoom: 9,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    },
    {
      id: "modis-flood-contrast",
      label: "MODIS 7-2-1 Flood Contrast",
      shortLabel: "FLOOD",
      source: "NASA GIBS / MODIS Terra",
      opacity: 0.8,
      maxZoom: 9,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    },
    {
      id: "imerg-rain",
      label: "IMERG Precipitation Rate",
      shortLabel: "RAIN",
      source: "NASA GIBS / IMERG",
      opacity: 0.6,
      maxZoom: 6,
      tileTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    },
    {
      id: "night-lights",
      label: "VIIRS Night Lights",
      shortLabel: "LIGHTS",
      source: "NASA GIBS / VIIRS DNB",
      opacity: 0.55,
      maxZoom: 8,
      tileTemplate: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_AtSensor_M15/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    },
    {
      id: "esri-imagery",
      label: "Esri World Imagery (hi-res)",
      shortLabel: "HIRES",
      source: "Esri World Imagery",
      opacity: 0.95,
      maxZoom: 19,
      tileTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    },
  ];
}

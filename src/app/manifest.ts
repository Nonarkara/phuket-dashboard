import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Phuket Dashboard",
    short_name: "Phuket Dashboard",
    description:
      "Live operations war room for Phuket — corridor, marine, weather, transit, public safety on one wall.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#0d1b2a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Phuket Dashboard",
    short_name: "Phuket Dashboard",
    description:
      "Curated showcase plus live war room for Phuket Dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f0e3",
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

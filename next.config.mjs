import path from "node:path";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        basePath: "/phuket-dashboard",
        images: { unoptimized: true },
      }
    : {}),
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/aggregation-layers",
    "@deck.gl/geo-layers",
    "@deck.gl/mapbox",
    "@deck.gl/react",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@luma.gl/webgl",
    "@luma.gl/constants",
    "@loaders.gl/core",
  ],
  turbopack: {},
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
      process.env.MAPBOX_ACCESS_TOKEN ??
      "",
    NEXT_PUBLIC_BASE_PATH: isStaticExport ? "/phuket-dashboard" : "",
    NEXT_PUBLIC_API_BASE: isStaticExport
      ? "https://phuket-dashboard.drnon.workers.dev"
      : "",
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(process.cwd(), "src"),
    };

    return config;
  },
};

export default nextConfig;

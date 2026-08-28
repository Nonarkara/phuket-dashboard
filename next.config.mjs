import path from "node:path";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
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
    NEXT_PUBLIC_BASE_PATH: "",
    NEXT_PUBLIC_API_BASE: isStaticExport
      ? "https://phuket-dashboard.drnon.workers.dev"
      : "",
  },
  // A deployment dedicated to a single province (e.g. lopburi.nonarkara.org
  // with NEXT_PUBLIC_PROVINCE=lopburi) serves that dashboard at the root.
  // Static export does not support redirects, so it is skipped there.
  ...(!isStaticExport && process.env.NEXT_PUBLIC_PROVINCE === "lopburi"
    ? {
        async redirects() {
          return [{ source: "/", destination: "/lopburi", permanent: false }];
        },
      }
    : {}),
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(process.cwd(), "src"),
    };

    return config;
  },
};

export default nextConfig;

import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "../lib/site";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Phuket Dashboard",
    template: "%s | Phuket Dashboard",
  },
  description:
    "Curated showcase plus live war room for Phuket Dashboard. Coastal corridor intelligence, modeled scenarios, maritime posture, weather operations, tourism demand, and resilient civic decision support in one product.",
  applicationName: "Phuket Dashboard",
  authors: [{ name: "Phuket Dashboard" }],
  creator: "Phuket Dashboard",
  publisher: "Phuket Dashboard",
  category: "Government",
  keywords: [
    "Phuket Dashboard",
    "civic design",
    "operations dashboard",
    "smart city",
    "tourism intelligence",
    "maritime monitoring",
    "weather operations",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Phuket Dashboard",
    description:
      "Curated showcase plus live war room for Phuket Dashboard. Coastal corridor intelligence, modeled scenarios, and resilient civic decision support in one product.",
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Phuket Dashboard",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Phuket Dashboard showcase preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phuket Dashboard",
    description:
      "Curated showcase plus live war room for Phuket Dashboard. Coastal corridor intelligence, modeled scenarios, and resilient civic decision support in one product.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d1b2a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--ink)] antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

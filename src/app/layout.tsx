import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { getSiteUrl } from "../lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Phuket Dashboard",
    template: "%s | Phuket Dashboard",
  },
  description:
    "Live operations + Governor's Daily Brief for Phuket. Today's fires, wins ready to announce, tomorrow's risk, and reality checks comparing public narrative to measured ground truth across corridors, marine, weather, and transit.",
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
    title: "Phuket Dashboard — Governor's Daily Brief",
    description:
      "Live operations + Governor's Daily Brief: today's fires, wins, risks, and a reality check comparing public narrative to ground truth.",
    type: "website",
    locale: "en_US",
    url: "/war-room",
    siteName: "Phuket Dashboard",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Phuket Dashboard — Governor's Daily Brief",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phuket Dashboard — Governor's Daily Brief",
    description:
      "Live operations + Governor's Daily Brief: today's fires, wins, risks, and a reality check comparing public narrative to ground truth.",
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
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <head>
        {/* Cloudflare Web Analytics — cookie-free, GDPR clean */}
        <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "0da324da0e204440a172088c0fafc92c"}' />
      </head>
      <body className="bg-[var(--bg)] text-[var(--ink)] antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phuket Dashboard v5.0 | Governor War Room",
  description:
    "Phuket Dashboard: standalone coastal operations war room for Phuket and nearby provinces. Real-time satellite imagery, camera pipelines, global disaster feeds, maritime AIS, tourism intelligence, and environmental monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--ink)] antialiased">
        {children}
      </body>
    </html>
  );
}

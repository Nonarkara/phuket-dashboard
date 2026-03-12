import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phuket Dashboard | Coastal Operations",
  description:
    "Phuket Dashboard: coastal operations view for Phuket and nearby provinces across tourism demand, road safety, rainfall, monsoon pressure, air quality, and local economy.",
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

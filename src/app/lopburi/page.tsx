import { Suspense } from "react";
import type { Metadata } from "next";
import LopburiApp from "../../components/Lopburi/LopburiApp";

export const metadata: Metadata = {
  title: "Lopburi Dashboard",
  description:
    "Lopburi Operations War Room — real-time FloodDash basin telemetry (ThaiWater/HII), Pa Sak Jolasid reservoir status, social listening, CCTV slot grid, and satellite layers for Lopburi province.",
  alternates: { canonical: "/lopburi" },
  openGraph: {
    title: "Lopburi Dashboard — Operations War Room",
    description:
      "Real-time flood telemetry, Pa Sak Jolasid reservoir status, social listening, CCTV slots, and satellite layers for Lopburi province.",
    url: "/lopburi",
  },
};

export default function LopburiPage() {
  return (
    <Suspense fallback={null}>
      <LopburiApp />
    </Suspense>
  );
}

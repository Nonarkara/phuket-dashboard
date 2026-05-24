import { Suspense } from "react";
import type { Metadata } from "next";
import WarRoomApp from "../components/WarRoom/WarRoomApp";

export const metadata: Metadata = {
  title: "Phuket Dashboard",
  description:
    "Governor's War Room — live corridor pressure, maritime posture, weather operations, tourism demand, daily brief, and road-safety benchmark for Phuket.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Phuket Dashboard — Governor's War Room",
    description:
      "Live operations + Governor's Daily Brief: today's fires, wins, risks, and a reality check comparing public narrative to ground truth.",
    url: "/",
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <WarRoomApp />
    </Suspense>
  );
}

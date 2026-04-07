import type { Metadata } from "next";
import WarRoomApp from "../../components/WarRoom/WarRoomApp";

export const metadata: Metadata = {
  title: "War Room",
  description:
    "Live operational wall for Phuket Dashboard. Monitor corridor pressure, modeled scenarios, maritime posture, weather, tourism lift, and resilience signals in one instrument panel.",
  alternates: {
    canonical: "/war-room",
  },
  openGraph: {
    title: "Phuket Dashboard War Room",
    description:
      "Live operational wall for Phuket Dashboard, built for corridor visibility, resilience, and scenario-driven decision making.",
    url: "/war-room",
  },
  twitter: {
    title: "Phuket Dashboard War Room",
    description:
      "Live operational wall for Phuket Dashboard, built for corridor visibility, resilience, and scenario-driven decision making.",
  },
};

export default function WarRoomPage() {
  return <WarRoomApp />;
}

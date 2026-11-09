import { Suspense } from "react";
import type { Metadata } from "next";
import WalkthroughApp from "../../components/Walkthrough/WalkthroughApp";
import type { WalkthroughNeighborhoodId } from "../../lib/phuket-walkthrough-data";

export const metadata: Metadata = {
  title: "Location Scout 3D · Phuket Walkthrough",
  description:
    "Artistic 3D manga & line-art neighborhood walkthrough of Phuket Old Town and Patong. Interactive gastronomy, heritage, and street discovery with comic perspective techniques.",
  alternates: { canonical: "/walkthrough" },
  openGraph: {
    title: "Location Scout 3D — Phuket Street Walkthrough",
    description:
      "Walk Phuket Old Town and Patong in 3D with manga screentone, line art shading, and neighborhood gastronomy discovery.",
    url: "/walkthrough",
  },
};

interface WalkthroughPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WalkthroughPage({
  searchParams,
}: WalkthroughPageProps) {
  const params = await searchParams;
  const initialPlace =
    typeof params.place === "string" &&
    (params.place === "patong" || params.place === "phuket-old-town")
      ? (params.place as WalkthroughNeighborhoodId)
      : "phuket-old-town";

  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#efede5] dark:bg-[#0d1117] animate-pulse" />}>
      <WalkthroughApp initialNeighborhood={initialPlace} />
    </Suspense>
  );
}

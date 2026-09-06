import { Suspense } from "react";
import type { Metadata } from "next";
import NstApp from "../../components/Nst/NstApp";

export const metadata: Metadata = {
  title: "NST Water Dashboard",
  description: "Nakhon Si Thammarat water war room — the whole system from Khao Luang to the Gulf: live sensors along Khlong Tha Di, flow direction and volume, the Tha Ngiu split, city fill order, tidal outlets, CCTV slots, satellite and 3D terrain.",
  alternates: { canonical: "/nst" },
  openGraph: { title: "NST Water War Room — where the water goes", description: "Live watershed routing for Nakhon Si Thammarat city: catchment rain, Tha Di discharge, city ETA, fill zones, outlet tide.", url: "/nst" },
};

export default function NstPage() {
  return <Suspense fallback={null}><NstApp /></Suspense>;
}

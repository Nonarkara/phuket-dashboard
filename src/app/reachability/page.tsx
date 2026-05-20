/**
 * /reachability — UNL Global isochrone tool.
 *
 * Governor-friendly question answered live: "What can a bus, ambulance, or
 * citizen reach in 15/30/60 minutes from this point?"
 *
 * Click anywhere on Phuket → server proxies UNL → render filled polygons.
 * Right-click → set destination, get real GrabMaps routing (turn-by-turn).
 *
 * Why this exists: UNL routes Southeast Asian roads better than HERE/TomTom
 * because GrabMaps is built on local rider GPS traces. The dashboard
 * already trusts GrabMaps for 50M+ rides per week of ground truth.
 */
"use client";

import dynamic from "next/dynamic";

const ReachabilityClient = dynamic(
  () => import("../../components/Reachability/ReachabilityClient"),
  { ssr: false },
);

export default function ReachabilityPage() {
  return (
    <main
      data-surface="phuket-dashboard"
      className="dark fixed inset-0 overflow-hidden"
      style={{
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <ReachabilityClient />
    </main>
  );
}

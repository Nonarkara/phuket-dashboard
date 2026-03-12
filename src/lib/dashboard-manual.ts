export interface ManualCallout {
  label: string;
  description: string;
}

export interface ManualPage {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  bullets: string[];
  callouts: ManualCallout[];
}

export const dashboardManualPages: ManualPage[] = [
  {
    id: "overview",
    title: "Dashboard Overview",
    subtitle:
      "Read the product as five connected zones before drilling into any one signal.",
    imageSrc: "/manual/01-overview.png",
    imageAlt:
      "Annotated full dashboard overview highlighting the sidebar, map, intelligence rail, analytics strip, and signal ticker.",
    bullets: [
      "Start with the whole-screen read so you know which panel is providing context and which panel is providing evidence.",
      "The map is the main spatial surface, while the right rail and bottom strip act as corroboration layers.",
      "Use the ticker last as a running pulse, not as the first source of truth.",
    ],
    callouts: [
      {
        label: "Sidebar",
        description:
          "Priority lists and local operating context live here. Use it to understand the standing picture before reacting to a single headline.",
      },
      {
        label: "Map",
        description:
          "The central map is where signals, coastlines, and overlays converge into a location-based read.",
      },
      {
        label: "Intelligence rail",
        description:
          "Briefings and live news provide the curated narrative layer and its current evidence.",
      },
      {
        label: "Analytics strip",
        description:
          "Economic, safety, and trend panels tell you whether the signal is isolated, trending, or structurally persistent.",
      },
      {
        label: "Signal ticker",
        description:
          "Use the ticker as a quick continuity check after you have already reviewed the main panels.",
      },
    ],
  },
  {
    id: "map-navigation",
    title: "Navigate the Map",
    subtitle:
      "Use the map as the geographic anchor: pan, zoom, click, then verify with the supporting panels.",
    imageSrc: "/manual/02-map-navigation.png",
    imageAlt:
      "Annotated map view showing the map stats card, imagery panel, working layers, and the main map inspection area.",
    bullets: [
      "Pan to establish regional context, then zoom to inspect one coast, route, or province in detail.",
      "Clicking a signal or region opens a selected-place read that summarizes immediate conditions.",
      "If the map looks visually empty, rely on the stats, controls, and right rail to confirm whether signals are active but outside the current frame.",
    ],
    callouts: [
      {
        label: "Map stats",
        description:
          "Signal, fire, and overlay counts give you a fast health check on what is currently loaded.",
      },
      {
        label: "Imagery panel",
        description:
          "This panel tells you which base imagery is active and whether the current view is satellite-led or basemap-led.",
      },
      {
        label: "Working layers",
        description:
          "Use these controls to jump to common views and selectively enable operational layers.",
      },
      {
        label: "Pan, zoom, click",
        description:
          "Treat the main canvas as the entry point for local investigation, especially after a package or headline turns up something worth checking.",
      },
    ],
  },
  {
    id: "overlays",
    title: "Use Imagery and Overlays",
    subtitle:
      "Change the visual evidence deliberately. Extra layers help only when they answer a specific question.",
    imageSrc: "/manual/03-overlay-controls.png",
    imageAlt:
      "Annotated dashboard view highlighting imagery choices, overlay toggles, opacity controls, and the analytic overlay panel.",
    bullets: [
      "Start with the detailed basemap or satellite option that best supports the question you are asking.",
      "Turn on one additional overlay at a time so you can see what changes rather than blending several signals into noise.",
      "Use rainfall, thermal, movement, and signal layers to confirm or challenge the story suggested by headlines and briefings.",
    ],
    callouts: [
      {
        label: "Imagery choices",
        description:
          "Switch between the available base imagery modes to decide whether you need clarity, texture, or a cleaner dark basemap.",
      },
      {
        label: "Opacity and toggles",
        description:
          "Opacity lets you blend imagery against the basemap. Keep it moderate when you need roads and labels to remain readable.",
      },
      {
        label: "Analytic overlays",
        description:
          "These controls enable specialized views such as thermal hotspots, movement traces, rainfall anomalies, and flights.",
      },
    ],
  },
  {
    id: "intelligence",
    title: "Read Intelligence Panels",
    subtitle:
      "Use the right rail for the curated story, then verify it against the map and bottom panels.",
    imageSrc: "/manual/04-intel-panels.png",
    imageAlt:
      "Annotated dashboard view highlighting the briefing panel, live news panel, and ticker cross-check area.",
    bullets: [
      "The briefing panel is the highest-level operator read. It should set your first hypothesis, not end the investigation.",
      "The live news panel is for evidence, recency, and source diversity. Compare its timestamps and tags before escalating.",
      "Cross-check ticker movement against the rail when a story looks surprising or operationally significant.",
    ],
    callouts: [
      {
        label: "Briefings",
        description:
          "Packages summarize the main situation, priorities, and what likely deserves analyst attention next.",
      },
      {
        label: "Live news",
        description:
          "This panel shows corroborating or competing public reporting. Check for source concentration and stale timestamps.",
      },
      {
        label: "Ticker cross-check",
        description:
          "If the ticker reinforces the same direction as the briefings, the signal is usually broader than a single article.",
      },
    ],
  },
  {
    id: "analytics",
    title: "Interpret Analytics",
    subtitle:
      "The bottom strip is where you test whether a local event is transient, recurring, or systemic.",
    imageSrc: "/manual/05-bottom-panels.png",
    imageAlt:
      "Annotated analytics strip showing the economic monitor, conflict trends, and source and overlay context panel.",
    bullets: [
      "Economic shifts can explain pressure or disruption even when incident reporting is sparse.",
      "Trend lines matter because a single event can be misleading without a baseline.",
      "Use the rightmost panel as context for where the data is coming from and what layers are currently shaping the view.",
    ],
    callouts: [
      {
        label: "Economic monitor",
        description:
          "Look here for trade, FX, and logistics stress that can foreshadow or explain operational change.",
      },
      {
        label: "Trend panel",
        description:
          "Use this panel to tell whether the area is spiking, cooling, or simply noisy in line with its usual pattern.",
      },
      {
        label: "Source and overlay context",
        description:
          "This section helps you keep track of what data families are influencing the current analytic picture.",
      },
    ],
  },
  {
    id: "location-detail",
    title: "Inspect a Place",
    subtitle:
      "A click on the map opens a place card that bridges the map, the overlays, and the corroborating panels.",
    imageSrc: "/manual/06-location-detail.png",
    imageAlt:
      "Annotated dashboard view showing a clicked map signal and the selected place popup at the lower right.",
    bullets: [
      "Click signals for local detail or click regions for a broader geographic sector read.",
      "Use the selected-place popup to understand what happened, where it sits, and how urgent the signal appears.",
      "Do not treat the popup as final judgment. It is the handoff point to overlays, trends, and the intelligence rail.",
    ],
    callouts: [
      {
        label: "Click a signal or region",
        description:
          "The fastest way to localize the dashboard is to choose the map feature that triggered your interest.",
      },
      {
        label: "Selected place popup",
        description:
          "This card summarizes immediate conditions, event timing, and what to verify next before you escalate the finding.",
      },
    ],
  },
  {
    id: "workflow",
    title: "Recommended Workflow",
    subtitle:
      "Use the same sequence every time so you do not overreact to a single siloed signal.",
    imageSrc: "/manual/07-operator-workflow.png",
    imageAlt:
      "Annotated dashboard workflow view with numbered operator steps from map orientation to ticker validation.",
    bullets: [
      "1. Orient on the map and identify the place, route, or coastline that matters.",
      "2. Review the briefing and live news rail to establish the current narrative and evidence base.",
      "3. Confirm with overlays and a clicked place card before making a judgment.",
      "4. Use the analytics strip and ticker to decide whether the signal is isolated or systemic.",
    ],
    callouts: [
      {
        label: "Orient on the map",
        description:
          "Start with location and spatial context before reading any narrative panel.",
      },
      {
        label: "Review briefings",
        description:
          "Use the right rail to see what the current package thinks is important and why.",
      },
      {
        label: "Confirm overlays",
        description:
          "Turn on only the layers that can validate or challenge your working hypothesis.",
      },
      {
        label: "Inspect selected place",
        description:
          "The place card keeps the investigation anchored to one geography while you verify the details.",
      },
      {
        label: "Use trends and ticker",
        description:
          "Finish by deciding whether the signal is local noise, a route pattern, or a broader regional shift.",
      },
    ],
  },
];

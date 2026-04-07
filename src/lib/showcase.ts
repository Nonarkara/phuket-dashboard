import { cached } from "./cache";
import { GOVERNOR_CORRIDORS } from "./governor-config";
import { loadOperationsDashboard } from "./operations-dashboard";
import type {
  DataFreshness,
  ExecutiveStatus,
  OperationsDashboardResponse,
  ShowcaseCorridorStory,
  ShowcaseLensState,
  ShowcasePayload,
} from "../types/dashboard";

const SHOWCASE_CACHE_KEY = "showcase-payload:v1";
const SHOWCASE_SCENARIOS = [
  "tourism-surge-weekend",
  "red-monsoon-day",
  "stable-recovery-day",
] as const;

const SHOWCASE_LENSES: ShowcaseLensState[] = [
  {
    id: "operations",
    label: "Operations",
    summary: "Read transfer lift first, then everything that can choke it.",
  },
  {
    id: "safety",
    label: "Safety",
    summary: "Pull attention toward the first corridor where timing failure becomes public harm.",
  },
  {
    id: "weather",
    label: "Weather",
    summary: "Treat rain, wind, and sea state as operating conditions, not background decoration.",
  },
  {
    id: "tourism",
    label: "Tourism",
    summary: "Keep the economic signal alive without losing control of friction and trust.",
  },
];

const STATUS_WEIGHT: Record<ExecutiveStatus, number> = {
  intervene: 3,
  watch: 2,
  stable: 1,
};

function deriveScenarioPosture(
  operations: OperationsDashboardResponse,
): ExecutiveStatus {
  return [
    operations.airportDemand.status,
    operations.cityTransferSupply.status,
    operations.trafficFriction.status,
    operations.weatherConstraint.status,
    operations.marineConstraint.status,
    ...operations.touchpoints.map((touchpoint) => touchpoint.status),
  ].sort((left, right) => STATUS_WEIGHT[right] - STATUS_WEIGHT[left])[0] ?? "stable";
}

function formatFreshnessLabel(freshness?: DataFreshness | null) {
  if (!freshness) {
    return "freshness pending";
  }

  if (!freshness.isFresh) {
    return freshness.ageMinutes === null ? "stale" : `${freshness.ageMinutes}m stale`;
  }

  if (freshness.ageMinutes === null) {
    return "fresh";
  }

  if (freshness.ageMinutes < 1) {
    return "fresh now";
  }

  return `${freshness.ageMinutes}m old`;
}

function buildMapPositionMap() {
  const lngValues = GOVERNOR_CORRIDORS.map((corridor) => corridor.center[0]);
  const latValues = GOVERNOR_CORRIDORS.map((corridor) => corridor.center[1]);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);

  return new Map(
    GOVERNOR_CORRIDORS.map((corridor) => {
      const x =
        14 +
        ((corridor.center[0] - minLng) / Math.max(maxLng - minLng, 0.001)) * 72;
      const y =
        84 -
        ((corridor.center[1] - minLat) / Math.max(maxLat - minLat, 0.001)) * 56;

      return [corridor.id, { x, y }];
    }),
  );
}

function formatGapValue(value: number, unit: string) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()} ${unit}`;
}

function buildCorridorStories(
  surge: OperationsDashboardResponse,
  monsoon: OperationsDashboardResponse,
  recovery: OperationsDashboardResponse,
): ShowcaseCorridorStory[] {
  const positions = buildMapPositionMap();
  const corridorIds = [
    "airport-patong",
    "east-coast-ports",
    "west-beaches",
    "ao-nang-krabi",
  ] as const;

  return corridorIds.flatMap<ShowcaseCorridorStory>((corridorId) => {
    const corridor = GOVERNOR_CORRIDORS.find((item) => item.id === corridorId);
    const mapPosition = positions.get(corridorId);

    if (!corridor || !mapPosition) {
      return [];
    }

    if (corridorId === "airport-patong") {
      return [
        {
          id: corridor.id,
          label: corridor.label,
          focusAreas: corridor.focusAreas,
          lensId: "operations",
          status: surge.cityTransferSupply.status,
          summary: surge.cityTransferSupply.summary,
          action: corridor.defaultAction,
          signalLabel: "Transfer gap",
          signalValue: formatGapValue(
            surge.cityTransferSupply.gapRate,
            surge.cityTransferSupply.unit,
          ),
          mapPosition,
        },
      ];
    }

    if (corridorId === "east-coast-ports") {
      return [
        {
          id: corridor.id,
          label: corridor.label,
          focusAreas: corridor.focusAreas,
          lensId: "safety",
          status: monsoon.marineConstraint.status,
          summary: monsoon.marineConstraint.summary,
          action: corridor.defaultAction,
          signalLabel: monsoon.marineConstraint.metrics[0]?.label ?? "Marine signal",
          signalValue: monsoon.marineConstraint.metrics[0]?.value ?? "Watch piers",
          mapPosition,
        },
      ];
    }

    if (corridorId === "west-beaches") {
      return [
        {
          id: corridor.id,
          label: corridor.label,
          focusAreas: corridor.focusAreas,
          lensId: "weather",
          status: monsoon.weatherConstraint.status,
          summary: monsoon.weatherConstraint.summary,
          action: corridor.defaultAction,
          signalLabel: "Rain / wind",
          signalValue: `${
            monsoon.weatherConstraint.rainfallMm !== null
              ? `${monsoon.weatherConstraint.rainfallMm.toFixed(0)} mm`
              : monsoon.weatherConstraint.condition
          } / ${
            monsoon.weatherConstraint.windKph !== null
              ? `${monsoon.weatherConstraint.windKph.toFixed(0)} kph`
              : monsoon.weatherConstraint.seaState
          }`,
          mapPosition,
        },
      ];
    }

    return [
      {
        id: corridor.id,
        label: corridor.label,
        focusAreas: corridor.focusAreas,
        lensId: "tourism",
        status: recovery.airportDemand.status,
        summary:
          "Tourism pressure only matters if the island can absorb it without losing legibility.",
        action: corridor.defaultAction,
        signalLabel: "Arrival pressure",
        signalValue: `${recovery.airportDemand.demandRate.toLocaleString()} pax/hour`,
        mapPosition,
      },
    ];
  });
}

function buildScenarioCards(
  surge: OperationsDashboardResponse,
  monsoon: OperationsDashboardResponse,
  recovery: OperationsDashboardResponse,
) {
  return [
    {
      scenario: "tourism-surge-weekend" as const,
      label: "Tourism surge weekend",
      kicker: "Demand stress test",
      posture: deriveScenarioPosture(surge),
      summary:
        "Arrival banks accelerate first, then road lift and boat handoff start to tighten.",
      highlights: [
        `${surge.airportDemand.demandRate.toLocaleString()} pax/hour inbound`,
        `${surge.touchpoints.length} bus-to-boat touchpoints`,
        surge.actions[0] ?? "Shape transfer messaging early",
      ],
      href: "/war-room?scenario=tourism-surge-weekend",
    },
    {
      scenario: "red-monsoon-day" as const,
      label: "Red monsoon day",
      kicker: "Weather stress test",
      posture: deriveScenarioPosture(monsoon),
      summary:
        "Rain, wind, and marine posture take control of the operating picture before demand does.",
      highlights: [
        monsoon.weatherConstraint.condition,
        monsoon.marineConstraint.metrics[0]?.value ?? "Marine constraint active",
        monsoon.actions[0] ?? "Tighten ferry and surf messaging",
      ],
      href: "/war-room?scenario=red-monsoon-day",
    },
    {
      scenario: "stable-recovery-day" as const,
      label: "Stable recovery day",
      kicker: "Confidence rebuild",
      posture: deriveScenarioPosture(recovery),
      summary:
        "The system settles into a cleaner rhythm, letting operators show resilience instead of panic.",
      highlights: [
        `${recovery.cityTransferSupply.supplyRate.toLocaleString()} pax/hour lift`,
        recovery.weatherConstraint.condition,
        recovery.actions[0] ?? "Keep the island moving without overreacting",
      ],
      href: "/war-room?scenario=stable-recovery-day",
    },
  ];
}

async function loadShowcasePayloadUncached(): Promise<ShowcasePayload> {
  const [surge, monsoon, recovery] = await Promise.all(
    SHOWCASE_SCENARIOS.map((scenario) => loadOperationsDashboard({ scenario })),
  );

  const corridors = buildCorridorStories(surge, monsoon, recovery);
  const scenarioCards = buildScenarioCards(surge, monsoon, recovery);

  return {
    generatedAt: new Date().toISOString(),
    hero: {
      eyebrow: "Policy without product is theater",
      title: "An award-facing civic product that opens with the story, then proves it with the live wall.",
      summary:
        "Phuket Dashboard turns tourism pressure, marine weather, and corridor friction into one readable operating picture. Judges get the narrative first. Operators still get the real instrument panel.",
      metrics: [
        {
          id: "corridors",
          label: "Coastal corridors",
          value: `${GOVERNOR_CORRIDORS.length}`,
          detail: "Cross-island focus areas kept in one operating frame.",
        },
        {
          id: "touchpoints",
          label: "Transfer touchpoints",
          value: `${surge.touchpoints.length}`,
          detail: "Bus-to-boat handoffs modeled as operational chokepoints, not footnotes.",
        },
        {
          id: "scenarios",
          label: "Modeled stress tests",
          value: `${SHOWCASE_SCENARIOS.length}`,
          detail: "Curated scenarios let judges see the product under pressure without betting on live data luck.",
        },
        {
          id: "lenses",
          label: "Decision lenses",
          value: `${SHOWCASE_LENSES.length}`,
          detail: "Operations, safety, weather, and tourism each reorganize what matters first.",
        },
      ],
    },
    signature: {
      title: "One island, four ways of reading risk.",
      summary:
        "The signature moment is not decorative 3D. It is map choreography: the same territory snapping into different decisions as the lens changes.",
      corridors,
      lenses: SHOWCASE_LENSES,
    },
    scenarios: scenarioCards,
    proof: {
      title: "Built for public scrutiny, not just pretty screenshots.",
      summary:
        "The showcase is curated, but the product beneath it still behaves like a live system. Scenario control, route-splitting, and graceful fallbacks keep the story crisp when live feeds go feral.",
      points: [
        {
          id: "split",
          label: "Route split",
          value: "/ + /war-room",
          detail: "The public narrative stays fast; the heavy operational wall stays isolated.",
        },
        {
          id: "fallbacks",
          label: "Resilience path",
          value: "Live -> cache -> fallback",
          detail: "The system degrades without leaving judges staring at blank panels.",
        },
        {
          id: "scenario-engine",
          label: "Scenario engine",
          value: "Deterministic",
          detail: "Modeled scenarios make the product legible on demand, not only when the real world behaves.",
        },
        {
          id: "runtime",
          label: "Default runtime",
          value: surge.mode.toUpperCase(),
          detail: "Operational surfaces expose whether they are live, hybrid, modeled, or degraded.",
        },
      ],
    },
    reliability: {
      title: "Reliability is part of the design language.",
      summary:
        "Every critical surface is expected to tell the truth about freshness, mode, and confidence. Invisible tech is nice. Honest tech scores higher.",
      items: [
        {
          id: "arrivals",
          label: "Arrival pressure",
          mode: recovery.airportDemand.sourceSummary.mode,
          freshnessLabel: formatFreshnessLabel(
            recovery.airportDemand.sourceSummary.freshness ?? recovery.freshness,
          ),
          detail: recovery.airportDemand.sourceSummary.label,
        },
        {
          id: "weather",
          label: "Weather ops",
          mode: monsoon.weatherConstraint.sourceSummary.mode,
          freshnessLabel: formatFreshnessLabel(
            monsoon.weatherConstraint.sourceSummary.freshness ?? monsoon.freshness,
          ),
          detail: monsoon.weatherConstraint.sourceSummary.label,
        },
        {
          id: "marine",
          label: "Marine posture",
          mode: monsoon.marineConstraint.sourceSummary.mode,
          freshnessLabel: formatFreshnessLabel(
            monsoon.marineConstraint.sourceSummary.freshness ?? monsoon.freshness,
          ),
          detail: monsoon.marineConstraint.sourceSummary.label,
        },
        {
          id: "scenario-runtime",
          label: "Scenario runtime",
          mode: surge.mode,
          freshnessLabel: formatFreshnessLabel(surge.freshness),
          detail: "The showcase rides deterministic scenario states before it invites judges into the live wall.",
        },
      ],
    },
    routes: {
      warRoom: "/war-room",
      scenarioLinks: SHOWCASE_SCENARIOS.map((scenario) => ({
        scenario,
        href: `/war-room?scenario=${scenario}`,
      })),
    },
  };
}

export async function loadShowcasePayload(): Promise<ShowcasePayload> {
  return cached(SHOWCASE_CACHE_KEY, 300, loadShowcasePayloadUncached);
}

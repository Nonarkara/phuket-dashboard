import { buildFreshness, summarizeFreshness } from "./freshness";
import type {
  CameraScoutItem,
  PublicCamera,
  PublicCameraResponse,
} from "../types/dashboard";

const CAMERA_TIMEOUT_MS = 8_000;

export const phuketPublicCameras: PublicCamera[] = [
  {
    id: "patong-coast-verified",
    label: "Patong Coast",
    location: "Patong coast",
    locationLabel: "Patong beachfront",
    lat: 7.8964,
    lng: 98.2961,
    provider: "SCS Webcam",
    type: "beach",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "Use this as the governor's first look for surf, beach density, and visible weather posture on the island's most watched coast.",
    notes:
      "Verified west-coast camera with direct value for surf condition, crowd temperature, and the public optics of sea safety messaging.",
    accessUrl: "https://webcam.scs.com.ua/en/asia/thailand/phuket/coast/",
    corridorIds: ["airport-patong", "west-beaches"],
    operationalState: "candidate",
    validationMethod: "HTTP page validation",
  },
  {
    id: "karon-panorama-verified",
    label: "Karon Panorama",
    location: "Karon beachfront",
    locationLabel: "Karon beachfront",
    lat: 7.8308,
    lng: 98.294,
    provider: "SCS Webcam",
    type: "beach",
    validationState: "verified",
    focusArea: "Karon beachfront",
    strategicNote:
      "Confirms west-coast sea state south of Patong and helps separate localized surf noise from broader monsoon deterioration.",
    notes:
      "Verified panorama for Karon's shoreline, surf conditions, and broad beachfront activity.",
    accessUrl: "https://webcam.scs.com.ua/en/asia/thailand/phuket/karon/",
    corridorIds: ["west-beaches"],
    operationalState: "candidate",
    validationMethod: "HTTP page validation",
  },
  {
    id: "kata-beach-verified",
    label: "Kata Beach",
    location: "Kata coast",
    locationLabel: "Kata beachfront",
    lat: 7.8198,
    lng: 98.299,
    provider: "SSS Phuket",
    type: "beach",
    validationState: "verified",
    focusArea: "Kata coast",
    strategicNote:
      "Useful for surf risk, beach occupancy, and whether west-coast conditions are worsening south of Karon.",
    notes:
      "Verified live beach camera for Kata with good visibility into waves, rain bands, and public crowding.",
    accessUrl: "https://www.sssphuket.com/kata-beach-live-cam/",
    corridorIds: ["west-beaches"],
    operationalState: "candidate",
    validationMethod: "HTTP page validation",
  },
  {
    id: "bangla-road-verified",
    label: "Bangla Road",
    location: "Patong nightlife core",
    locationLabel: "Bangla Road",
    lat: 7.8934,
    lng: 98.2985,
    provider: "SCS Webcam",
    type: "traffic",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "Shows city vibe, nightlife density, and whether public narrative about crowding or disorder is grounded in reality.",
    notes:
      "Verified street-facing camera for Patong's highest-visibility nightlife block.",
    accessUrl: "https://webcam.scs.com.ua/en/asia/thailand/phuket/banglaroud/",
    corridorIds: ["west-beaches"],
    operationalState: "candidate",
    validationMethod: "HTTP page validation",
  },
  {
    id: "old-town-verified",
    label: "Phuket Old Town",
    location: "Phuket town center",
    locationLabel: "Phuket Old Town",
    lat: 7.884,
    lng: 98.3923,
    provider: "SCS Webcam",
    type: "traffic",
    validationState: "verified",
    focusArea: "Phuket Old Town",
    strategicNote:
      "Lets the governor check downtown tempo, event spillover, and whether online claims about the city vibe match reality.",
    notes:
      "Verified old-town camera useful for civic mood, access, and downtown event posture.",
    accessUrl: "https://webcam.scs.com.ua/en/asia/thailand/phuket/oldtown/",
    corridorIds: ["old-town"],
    operationalState: "candidate",
    validationMethod: "HTTP page validation",
  },
];

export const cameraScoutTargets: CameraScoutItem[] = [
  {
    id: "airport-access-scout",
    label: "Airport Access Scout",
    location: "Airport corridor",
    locationLabel: "Phuket Airport access",
    lat: 8.1132,
    lng: 98.3169,
    provider: "Scout target",
    type: "traffic",
    validationState: "candidate",
    focusArea: "Airport corridor",
    strategicNote:
      "Highest-priority scout slot for seeing queue build-up, transfer pace, and weather-linked road disruption at the airport end.",
    notes:
      "Public webcam candidate near Phuket Airport discovered via Webcam Galore (Nai Yang / Phuket Lotus Lodge). Keep this in scout status until the angle is confirmed useful for airport-road operations.",
    accessUrl: "https://www.webcamgalore.com/webcam/Thailand/Nai-Yang-Phuket/345.html",
    corridorIds: ["airport-patong"],
    candidateSourceNote:
      "Public webcam candidate discovered near Phuket Airport; validate angle and uptime before promoting.",
    operationalState: "candidate",
    validationMethod: "Public webcam scout page validation",
  },
  {
    id: "chalong-pier-scout",
    label: "Chalong Pier Scout",
    location: "Chalong Pier",
    locationLabel: "Chalong Pier",
    lat: 7.8227,
    lng: 98.3409,
    provider: "Scout target",
    type: "bay",
    validationState: "candidate",
    focusArea: "Chalong / Rassada / Ao Po",
    strategicNote:
      "Needed to verify departure tempo, rain exposure, and queue pressure on the Chalong side.",
    notes:
      "Public webcam candidate discovered for Chalong Bay / Phuket Fish Market. Keep it in scout status until the angle proves operationally useful for pier monitoring.",
    accessUrl: "https://www.webcamgalore.com/webcam/Thailand/Chalong-Bay-Phuket/29105.html",
    corridorIds: ["east-coast-ports"],
    candidateSourceNote:
      "Public Chalong Bay webcam discovered; validate pier relevance and uptime before promoting.",
    operationalState: "candidate",
    validationMethod: "Public webcam scout page validation",
  },
  {
    id: "rassada-pier-scout",
    label: "Rassada Pier Scout",
    location: "Rassada Pier",
    locationLabel: "Rassada Pier",
    lat: 7.8799,
    lng: 98.4215,
    provider: "Scout target",
    type: "bay",
    validationState: "candidate",
    focusArea: "Chalong / Rassada / Ao Po",
    strategicNote:
      "Needed for ferry queue discipline, passenger density, and whether pier messaging is landing.",
    notes:
      "Candidate source pending validation for the main ferry gateway into island operations.",
    accessUrl: null,
    corridorIds: ["east-coast-ports"],
    candidateSourceNote: "Candidate source pending validation",
    operationalState: "candidate",
    validationMethod: "Scout slot",
  },
  {
    id: "ao-po-marina-scout",
    label: "Ao Po Marina Scout",
    location: "Ao Po Marina",
    locationLabel: "Ao Po Marina",
    lat: 8.0724,
    lng: 98.4624,
    provider: "Scout target",
    type: "bay",
    validationState: "candidate",
    focusArea: "Chalong / Rassada / Ao Po",
    strategicNote:
      "Needed to watch marina density, yacht staging, and east-coast sea access without sending a field team first.",
    notes:
      "Candidate source pending validation for the marina and bay-approach picture.",
    accessUrl: null,
    corridorIds: ["east-coast-ports"],
    candidateSourceNote: "Candidate source pending validation",
    operationalState: "candidate",
    validationMethod: "Scout slot",
  },
  {
    id: "ao-nang-scout",
    label: "Ao Nang Beachfront Scout",
    location: "Ao Nang waterfront",
    locationLabel: "Ao Nang beachfront",
    lat: 8.0323,
    lng: 98.8237,
    provider: "Scout target",
    type: "beach",
    validationState: "candidate",
    focusArea: "Ao Nang",
    strategicNote:
      "Needed to read Krabi-side visitor density, longtail queueing, and open-water conditions that directly feed Phuket ferries and tours.",
    notes:
      "Public webcam candidate discovered for Ao Nang / Poseidon Dive Center. Keep it in scout status until the current uptime and vantage are confirmed.",
    accessUrl: "https://www.webcamgalore.com/webcam/Thailand/Ao-Nang/6115.html",
    corridorIds: ["ao-nang-krabi"],
    candidateSourceNote:
      "Public Ao Nang webcam discovered; validate coastline relevance and uptime before promoting.",
    operationalState: "candidate",
    validationMethod: "Public webcam scout page validation",
  },
  {
    id: "khao-lak-scout",
    label: "Khao Lak Coast Scout",
    location: "Khao Lak coast",
    locationLabel: "Khao Lak coast",
    lat: 8.6367,
    lng: 98.2487,
    provider: "Scout target",
    type: "beach",
    validationState: "candidate",
    focusArea: "Khao Lak",
    strategicNote:
      "Needed to confirm coast conditions, beach posture, and resort-side public narrative north of Phuket.",
    notes:
      "Public webcam candidate discovered for Khao Lak via Vision Environnement. Keep it in scout status until the view and update behavior are confirmed.",
    accessUrl: "https://www.vision-environnement.com/de/livecams/webcam.php?webcam=khaolak",
    corridorIds: ["khao-lak-phang-nga"],
    candidateSourceNote:
      "Public Khao Lak webcam discovered; validate coastal usefulness and uptime before promoting.",
    operationalState: "candidate",
    validationMethod: "Public webcam scout page validation",
  },
];

function contentLooksLive(contentType: string | null, body: string) {
  if (!contentType) {
    return /webcam|live cam|livestream|stream|player|iframe|youtube|video/i.test(body);
  }

  if (/image|video|application\/vnd\.apple\.mpegurl|application\/x-mpegurl/i.test(contentType)) {
    return true;
  }

  if (/text\/html/i.test(contentType)) {
    return /webcam|live cam|livestream|stream|player|iframe|youtube|video/i.test(body);
  }

  return false;
}

async function validateCamera(camera: PublicCamera) {
  const checkedAt = new Date().toISOString();

  if (!camera.accessUrl) {
    return {
      ...camera,
      operationalState: "offline" as const,
      lastCheckedAt: checkedAt,
      lastHttpStatus: null,
      lastFrameAt: null,
      freshness: buildFreshness({
        checkedAt,
        observedAt: null,
        fallbackTier: "unavailable",
        sourceIds: [camera.provider],
      }),
    };
  }

  try {
    const response = await fetch(camera.accessUrl, {
      signal: AbortSignal.timeout(CAMERA_TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,image/*,video/*,*/*",
        "User-Agent": "PhuketGovernorWarRoom/1.0",
      },
    });

    const contentType = response.headers.get("content-type");
    const lastModified = response.headers.get("last-modified");
    const body = contentType?.includes("text/html")
      ? (await response.text()).slice(0, 10_000)
      : "";
    const operationalState = response.ok
      ? contentLooksLive(contentType, body)
        ? "live"
        : "reachable"
      : "offline";
    const observedAt = lastModified
      ? new Date(lastModified).toISOString()
      : operationalState === "offline"
        ? null
        : checkedAt;

    return {
      ...camera,
      operationalState,
      contentType,
      lastCheckedAt: checkedAt,
      lastValidatedAt: response.ok ? checkedAt : camera.lastValidatedAt,
      lastFrameAt: observedAt,
      lastHttpStatus: response.status,
      freshness: buildFreshness({
        checkedAt,
        observedAt,
        fallbackTier: response.ok ? "live" : "unavailable",
        sourceIds: [camera.provider],
      }),
    } satisfies PublicCamera;
  } catch {
    return {
      ...camera,
      operationalState: "offline" as const,
      lastCheckedAt: checkedAt,
      lastHttpStatus: null,
      lastFrameAt: null,
      freshness: buildFreshness({
        checkedAt,
        observedAt: null,
        fallbackTier: "unavailable",
        sourceIds: [camera.provider],
      }),
    } satisfies PublicCamera;
  }
}

async function hydrateScoutTarget(
  camera: CameraScoutItem,
  checkedAt: string,
): Promise<CameraScoutItem> {
  if (camera.accessUrl) {
    const validated = await validateCamera({
      ...camera,
      validationState: "candidate",
    });

    return {
      ...validated,
      validationState: "candidate" as const,
      candidateSourceNote: camera.candidateSourceNote,
    };
  }

  return {
    ...camera,
    operationalState: "candidate",
    lastCheckedAt: checkedAt,
    lastFrameAt: null,
    lastHttpStatus: null,
    freshness: buildFreshness({
      checkedAt,
      observedAt: null,
      fallbackTier: "reference",
      sourceIds: [camera.provider],
    }),
  } satisfies CameraScoutItem;
}

export async function loadPublicCameraFeed(): Promise<PublicCameraResponse> {
  const generatedAt = new Date().toISOString();
  const validatedCameras = await Promise.all(phuketPublicCameras.map(validateCamera));
  const checkedAt = new Date().toISOString();
  const hydratedScoutTargets = await Promise.all(
    cameraScoutTargets.map((camera) => hydrateScoutTarget(camera, checkedAt)),
  );
  const liveOrReachable = validatedCameras.filter(
    (camera) => camera.operationalState === "live" || camera.operationalState === "reachable",
  );

  return {
    generatedAt,
    source: [
      "SCS Phuket public webcams",
      "SSS Phuket Kata Beach live cam",
      "Governor scout targets pending validation",
    ],
    cameras: validatedCameras,
    scoutTargets: hydratedScoutTargets,
    freshness: summarizeFreshness(
      validatedCameras.map((camera) => camera.freshness),
      checkedAt,
    ),
    lastSweepAt: checkedAt,
    expectedVerifiedFeeds: phuketPublicCameras.length,
    verifiedLiveCount: liveOrReachable.length,
    reachableCount: validatedCameras.filter(
      (camera) => camera.operationalState === "reachable",
    ).length,
    scoutCount: hydratedScoutTargets.length,
  };
}

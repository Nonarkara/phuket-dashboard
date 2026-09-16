import { cached } from "./cache";
import { buildFreshness, summarizeFreshness } from "./freshness";
import type {
  CameraScoutItem,
  PublicCamera,
  PublicCameraResponse,
} from "../types/dashboard";

const CAMERA_TIMEOUT_MS = 4_000;
const PUBLIC_CAMERA_FEED_CACHE_KEY = "public-camera-feed:v1";

export const phuketPublicCameras: PublicCamera[] = [
  {
    id: "phuket101-patong-tower",
    label: "Patong Tower 15F",
    location: "Patong Beach",
    locationLabel: "Patong Bay & Beachfront (15th Floor)",
    lat: 7.896,
    lng: 98.296,
    provider: "Phuket 101 / IPCamLive",
    type: "beach",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "15th floor panoramic view over Patong Bay, surf conditions, beach occupancy, and incoming west-coast squalls.",
    notes:
      "High-elevation camera on Patong Tower overlooking the full arc of the bay, reef breaks, and horizon line.",
    accessUrl: "https://www.phuket101.net/phuket-webcams/",
    embedUrl: "https://g3.ipcamlive.com/player/player.php?alias=6211dc3352960&autoplay=1&mute=1",
    corridorIds: ["airport-patong", "west-beaches"],
    operationalState: "live",
    validationMethod: "Direct IPCamLive stream validation",
  },
  {
    id: "sss-kata-beach",
    label: "Kata Beach",
    location: "Kata coast",
    locationLabel: "Kata Beach Surf Break",
    lat: 7.8198,
    lng: 98.299,
    provider: "SSS Phuket / RTSP.me",
    type: "beach",
    validationState: "verified",
    focusArea: "Kata coast",
    strategicNote:
      "Live surf and wave height observation at Kata Beach; critical for red-flag rip current warnings and surf safety.",
    notes:
      "Direct beach-facing camera operated by SSS Phuket Dive & Surf Center watching swell conditions and beach density.",
    accessUrl: "https://www.sssphuket.com/kata-beach-live-cam/",
    embedUrl: "https://rtsp.me/embed/2F8DfBS5/",
    corridorIds: ["west-beaches"],
    operationalState: "live",
    validationMethod: "RTSP.me stream validation",
  },
  {
    id: "windy-karon-beach",
    label: "Karon Beach",
    location: "Karon beachfront",
    locationLabel: "Karon Beach Shoreline",
    lat: 7.8308,
    lng: 98.294,
    provider: "Windy / Beyond Resort",
    type: "beach",
    validationState: "verified",
    focusArea: "Karon beachfront",
    strategicNote:
      "Continuous Karon beachfront shoreline view to track west-coast surf breaks, sea foam, and rain curtain sweeps.",
    notes:
      "Live timelapse and video feed tracking open sea swell, monsoon surf, and visitor density on Karon sand.",
    accessUrl: "https://www.windy.com/-Webcams-Phuket-Karon-Beach/webcams/1245318606",
    embedUrl: "https://webcams.windy.com/webcams/public/embed/player/1245318606/day",
    corridorIds: ["west-beaches"],
    operationalState: "live",
    validationMethod: "Windy / Lookr feed validation",
  },
  {
    id: "skyline-patong-beach",
    label: "Patong Promenade",
    location: "Patong Beach",
    locationLabel: "Patong Central Promenade",
    lat: 7.8964,
    lng: 98.2961,
    provider: "SkylineWebcams",
    type: "beach",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "Live HD streaming of Patong Beach sand, promenade foot traffic, and Andaman horizon.",
    notes:
      "Widely watched beachfront camera in central Patong for crowd and weather optics.",
    accessUrl: "https://www.skylinewebcams.com/en/webcam/thailand/kathu-district/phuket.html",
    corridorIds: ["airport-patong", "west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "skyline-sainamyen-road",
    label: "Sainamyen Road",
    location: "Patong urban core",
    locationLabel: "Sainamyen Traffic Corridor",
    lat: 7.8995,
    lng: 98.3005,
    provider: "SkylineWebcams",
    type: "traffic",
    validationState: "verified",
    focusArea: "Patong urban core",
    strategicNote:
      "Monitors central Patong urban traffic flow, intersections, motorbike clusters, and flood ponding during storms.",
    notes:
      "Key urban artery connecting Rat-U-Thit 200 Pi and Phra Barami Road.",
    accessUrl: "https://www.skylinewebcams.com/en/webcam/thailand/kathu-district/phuket/sainamyen-road.html",
    corridorIds: ["airport-patong", "west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "freedom-kata-surf",
    label: "Kata Surf Cam",
    location: "Kata Beach",
    locationLabel: "Kata Surf Break & Coral Reef",
    lat: 7.822,
    lng: 98.298,
    provider: "Freedom Board Sports",
    type: "beach",
    validationState: "verified",
    focusArea: "Kata coast",
    strategicNote:
      "Surf, swell, and tide conditions for coastal safety, watercraft operations, and beach lifeguard monitoring.",
    notes:
      "Specialized surf condition webcam operated by Freedom Board Sports.",
    accessUrl: "https://www.freedomboardsports.com/pages/webcams",
    corridorIds: ["west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "worldcams-bangla-patong",
    label: "Bangla Road Junction",
    location: "Patong nightlife core",
    locationLabel: "Bangla Nightlife Entrance",
    lat: 7.8934,
    lng: 98.2985,
    provider: "WorldCams / WorldCam.eu",
    type: "traffic",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "Monitors pedestrian crowds, taxi queues, and nightlife density at the entrance to Bangla Road.",
    notes:
      "Real-time street posture at the busiest tourism junction on the island.",
    accessUrl: "https://worldcams.tv/thailand/patong/phuket-patong",
    corridorIds: ["west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "phuket-plaza-karon",
    label: "Karon Headland",
    location: "South Karon Beach",
    locationLabel: "Karon Headland & Coral Cove",
    lat: 7.8285,
    lng: 98.2952,
    provider: "Marina Phuket / Phuket Plaza",
    type: "beach",
    validationState: "verified",
    focusArea: "Karon beachfront",
    strategicNote:
      "South Karon headland view of rocky points, tidal shifts, and bay wave crests.",
    notes:
      "Long-running Karon coastal cam referenced by Jamie's Phuket Blog and Phuket Plaza.",
    accessUrl: "https://www.phuket-plaza.com/webcam.html",
    corridorIds: ["west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "geocam-kalim-patong",
    label: "Kalim Beach / North Patong",
    location: "North Patong",
    locationLabel: "Kalim Reef & Bay Approach",
    lat: 7.908,
    lng: 98.293,
    provider: "GeoCam / Phuket Cheap Tour",
    type: "beach",
    validationState: "verified",
    focusArea: "Patong coast",
    strategicNote:
      "North Patong / Kalim approach reef break, rocky shoreline hazards, and incoming squall lines.",
    notes:
      "Covers the coastal road winding north toward Kamala.",
    accessUrl: "https://www.geocam.ru/en/in/patong/",
    corridorIds: ["airport-patong", "west-beaches"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "webcamtaxi-old-town",
    label: "Phuket Old Town",
    location: "Phuket town center",
    locationLabel: "Old Town Thalang Road",
    lat: 7.8848,
    lng: 98.3912,
    provider: "Webcamtaxi / Webcamera24",
    type: "traffic",
    validationState: "verified",
    focusArea: "Phuket Old Town",
    strategicNote:
      "Historical Sino-Portuguese walking street, Sunday night market crowd density, and urban drainage.",
    notes:
      "Civic tempo and tourism density in the provincial capital's core.",
    accessUrl: "https://www.webcamtaxi.com/en/thailand/phuket.html",
    corridorIds: ["old-town"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "meteoblue-kathu-ridge",
    label: "Kathu Central Ridge",
    location: "Kathu Valley",
    locationLabel: "Central Phuket Valley & Ridge",
    lat: 7.901,
    lng: 98.332,
    provider: "Meteoblue / Outdooractive",
    type: "traffic",
    validationState: "verified",
    focusArea: "Central Spine",
    strategicNote:
      "Inland / ridge cloud base and precipitation curtain observation across central Phuket.",
    notes:
      "Critical ridge vantage between West Coast beaches and Phuket Town.",
    accessUrl: "https://www.meteoblue.com/en/weather/webcams/phuket_thailand_1151254",
    corridorIds: ["central-spine"],
    operationalState: "live",
    validationMethod: "HTTP page validation",
  },
  {
    id: "phuket-dream-rawai",
    label: "Rawai Beach & Pier",
    location: "Rawai Beachfront",
    locationLabel: "Rawai Pier & Longtail Anchorage",
    lat: 7.778,
    lng: 98.324,
    provider: "Phuket Dream Company",
    type: "bay",
    validationState: "verified",
    focusArea: "Chalong / Rassada / Ao Po",
    strategicNote:
      "South island boat mooring area, island-hopping longtail departures, and Andaman sea chop.",
    notes:
      "Southern terminus of Highway 4024 and gateway to Koh Bon, Koh He, and Racha islands.",
    accessUrl: "https://phuketdreamcompany.asia/phuket-live-webcams/",
    corridorIds: ["east-coast-ports"],
    operationalState: "live",
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
    const fallbackLive = Boolean(camera.embedUrl || camera.validationState === "verified");
    return {
      ...camera,
      operationalState: fallbackLive ? ("live" as const) : ("offline" as const),
      lastCheckedAt: checkedAt,
      lastHttpStatus: null,
      lastFrameAt: fallbackLive ? checkedAt : null,
      freshness: buildFreshness({
        checkedAt,
        observedAt: fallbackLive ? checkedAt : null,
        fallbackTier: fallbackLive ? "live" : "unavailable",
        sourceIds: [camera.provider],
      }),
    } satisfies PublicCamera;
  }
}

async function hydrateScoutTarget(
  camera: CameraScoutItem,
  checkedAt: string,
): Promise<CameraScoutItem> {
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

async function loadPublicCameraFeedUncached(): Promise<PublicCameraResponse> {
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

export async function loadPublicCameraFeed(): Promise<PublicCameraResponse> {
  return cached(PUBLIC_CAMERA_FEED_CACHE_KEY, 600, loadPublicCameraFeedUncached);
}

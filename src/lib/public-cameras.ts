import type { PublicCamera } from "../types/dashboard";

export const phuketPublicCameras: PublicCamera[] = [
  {
    id: "patong-beach-panorama",
    label: "Patong Beach Panorama",
    location: "Patong beachfront",
    lat: 7.8964,
    lng: 98.2961,
    provider: "Phuket 101",
    type: "beach",
    notes:
      "Public beach-facing webcam covering the central Patong shoreline and surf conditions.",
    accessUrl: "https://www.phuket101.net/phuket-webcams/",
  },
  {
    id: "patong-bay-cam",
    label: "Patong Bay Cam",
    location: "Patong Bay",
    lat: 7.9005,
    lng: 98.2967,
    provider: "Webcamtaxi",
    type: "bay",
    notes:
      "Public bay-facing camera useful for marine visibility, beach density, and weather checks.",
    accessUrl: "https://www.webcamtaxi.com/en/thailand/phuket/patong-bay-cam.html",
  },
  {
    id: "nanai-road-cam",
    label: "Nanai Road Cam",
    location: "Patong inland corridor",
    lat: 7.8908,
    lng: 98.3049,
    provider: "Webcamtaxi",
    type: "traffic",
    notes:
      "Public street camera covering a busy Patong interior road segment and traffic flow.",
    accessUrl: "https://www.webcamtaxi.com/en/thailand/phuket/nanai-road-cam.html",
  },
  {
    id: "sainamyen-road-cam",
    label: "Sainamyen Road Cam",
    location: "North Patong approach",
    lat: 7.8998,
    lng: 98.3042,
    provider: "Webcamtaxi",
    type: "traffic",
    notes:
      "Public road camera covering the Sainamyen approach into Patong's northern grid.",
    accessUrl: "https://www.webcamtaxi.com/en/thailand/phuket/sainamyen-road-cam.html",
  },
  {
    id: "karon-beach-cam",
    label: "Karon Beach Cam",
    location: "South Karon beach",
    lat: 7.8308,
    lng: 98.294,
    provider: "Phuket 101",
    type: "beach",
    notes:
      "Public beachfront camera near the south end of Karon Beach for sea-state and crowd monitoring.",
    accessUrl: "https://www.phuket101.net/phuket-webcams/",
  },
  {
    id: "kata-beach-live-cam",
    label: "Kata Beach Live Cam",
    location: "Kata / Kata Noi corridor",
    lat: 7.8198,
    lng: 98.299,
    provider: "SSS Phuket",
    type: "beach",
    notes:
      "Public live camera on the Kata coast with a strong view of surf, visibility, and beach activity.",
    accessUrl: "https://www.sssphuket.com/kata-beach-live-cam/",
  },
];

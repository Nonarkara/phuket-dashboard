export interface TVChannelDefinition {
  country: string;
  code: string;
  name: string;
  ytChannelId?: string;
  ytHandle?: string;
  externalUrl: string;
  color: string;
  watchFocus: string;
}

export const LIVE_TV_CHANNELS: TVChannelDefinition[] = [
  {
    country: "Thailand",
    code: "PBS",
    name: "Thai PBS News",
    ytHandle: "@ThaiPBSNews",
    externalUrl: "https://www.youtube.com/@ThaiPBSNews",
    color: "#38bdf8",
    watchFocus: "Public-service coverage and weather warnings",
  },
  {
    country: "Thailand",
    code: "NBT",
    name: "NBT Connext",
    ytHandle: "@NBTConnext",
    externalUrl: "https://www.youtube.com/@NBTConnext",
    color: "#f59e0b",
    watchFocus: "Government posture and transport messaging",
  },
  {
    country: "Thailand",
    code: "TNN",
    name: "TNN Online",
    ytHandle: "@TNNOnline",
    externalUrl: "https://www.youtube.com/@TNNOnline",
    color: "#22c55e",
    watchFocus: "National narrative and market-sensitive headlines",
  },
  {
    country: "Thailand",
    code: "PPTV",
    name: "PPTV HD 36",
    ytHandle: "@PPTVHD36",
    externalUrl: "https://www.youtube.com/@PPTVHD36",
    color: "#a855f7",
    watchFocus: "Popular-shared clips and mass audience mood",
  },
  {
    country: "Thailand",
    code: "NAT",
    name: "NationTV",
    ytHandle: "@NationTV22",
    externalUrl: "https://www.youtube.com/@NationTV22",
    color: "#ef4444",
    watchFocus: "Breaking narrative spikes and talkback framing",
  },
  {
    country: "Thailand",
    code: "AMR",
    name: "Amarin TV",
    ytHandle: "@AMARINTVHD",
    externalUrl: "https://www.youtube.com/@AMARINTVHD",
    color: "#f97316",
    watchFocus: "High-reach public attention and shareable headlines",
  },
];

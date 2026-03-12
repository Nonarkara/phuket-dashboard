"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Database, Network } from "lucide-react";

const TOP_MARKETS = [
  {
    rank: 1,
    country: "Russia",
    city: "Moscow",
    timezone: "Europe/Moscow",
    logo: "/logos/markets/ru.svg",
  },
  {
    rank: 2,
    country: "China",
    city: "Beijing",
    timezone: "Asia/Shanghai",
    logo: "/logos/markets/cn.svg",
  },
  {
    rank: 3,
    country: "India",
    city: "New Delhi",
    timezone: "Asia/Kolkata",
    logo: "/logos/markets/in.svg",
  },
  {
    rank: 4,
    country: "United Kingdom",
    city: "London",
    timezone: "Europe/London",
    logo: "/logos/markets/gb.svg",
  },
  {
    rank: 5,
    country: "Germany",
    city: "Berlin",
    timezone: "Europe/Berlin",
    logo: "/logos/markets/de.svg",
  },
  {
    rank: 6,
    country: "Kazakhstan",
    city: "Almaty",
    timezone: "Asia/Almaty",
    logo: "/logos/markets/kz.svg",
  },
  {
    rank: 7,
    country: "France",
    city: "Paris",
    timezone: "Europe/Paris",
    logo: "/logos/markets/fr.svg",
  },
  {
    rank: 8,
    country: "Australia",
    city: "Sydney",
    timezone: "Australia/Sydney",
    logo: "/logos/markets/au.svg",
  },
  {
    rank: 9,
    country: "Malaysia",
    city: "Kuala Lumpur",
    timezone: "Asia/Kuala_Lumpur",
    logo: "/logos/markets/my.svg",
  },
  {
    rank: 10,
    country: "United States",
    city: "New York",
    timezone: "America/New_York",
    logo: "/logos/markets/us.svg",
  },
] as const;

interface EnvData {
  code: string;
  temperature: number | null;
  aqi: number | null;
}

interface TopBarProps {
  onOpenManual: () => void;
  onOpenArchitecture: () => void;
  onOpenDataExplorer: () => void;
}

function formatTime(timezone: string) {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMainClock() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function aqiColor(aqi: number | null): string {
  if (aqi === null) return "text-[var(--dim)]";
  if (aqi <= 50) return "text-[#22c55e]";   // Good
  if (aqi <= 100) return "text-[#f59e0b]";  // Moderate
  if (aqi <= 150) return "text-[#f97316]";  // Unhealthy for sensitive
  if (aqi <= 200) return "text-[#ef4444]";  // Unhealthy
  return "text-[#a855f7]";                   // Very unhealthy / hazardous
}

export default function TopBar({
  onOpenManual,
  onOpenArchitecture,
  onOpenDataExplorer,
}: TopBarProps) {
  const [time, setTime] = useState("");
  const [marketTimes, setMarketTimes] = useState<string[]>([]);
  const [phuketEnv, setPhuketEnv] = useState<EnvData | null>(null);

  useEffect(() => {
    const tick = () => {
      setTime(formatMainClock());
      setMarketTimes(TOP_MARKETS.map((market) => formatTime(market.timezone)));
    };

    tick();
    const clockInterval = setInterval(tick, 1000);

    // Fetch environment data
    const fetchEnv = async () => {
      try {
        const res = await fetch("/api/environment");
        const data: EnvData[] = await res.json();
        const phuket = data.find((d) => d.code === "HKT");
        if (phuket) setPhuketEnv(phuket);
      } catch {
        /* fallback handled by API */
      }
    };

    fetchEnv();
    const envInterval = setInterval(fetchEnv, 5 * 60 * 1000); // Refresh every 5 min

    return () => {
      clearInterval(clockInterval);
      clearInterval(envInterval);
    };
  }, []);

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-raised)] px-4 py-2 backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-col hidden sm:flex">
            <div className="eyebrow leading-none">Phuket Op Center</div>
            <div className="text-[14px] font-bold tracking-tight text-[var(--ink)]">
              COASTAL COMMAND
            </div>
          </div>
          <div className="h-8 w-[1px] bg-[var(--line)] hidden sm:block" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[22px] font-bold tracking-tighter text-[var(--ink)]">
              {time || "--:--:--"}
            </span>
            <span className="text-[9px] font-mono text-[var(--dim)] uppercase tracking-wider">
              HKT / LIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-4 xl:flex">
            {TOP_MARKETS.slice(0, 5).map((market, idx) => (
              <div key={market.country} className="flex items-center gap-2 border-r border-[var(--line)] pr-4 last:border-0 last:pr-0">
                <span className="text-[8px] font-mono text-[var(--dim)]">{market.city.substring(0, 3).toUpperCase()}</span>
                <span className="text-[11px] font-mono font-semibold">{marketTimes[idx] || "--:--"}</span>
              </div>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-[var(--line)] hidden xl:block" />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenArchitecture}
              className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="APIs / Architecture"
            >
              <Network size={16} />
            </button>
            <button
              type="button"
              onClick={onOpenDataExplorer}
              className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Data / Export"
            >
              <Database size={16} />
            </button>
            <button
              type="button"
              onClick={onOpenManual}
              className="p-1.5 text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
              title="Help / Manual"
            >
              <BookOpen size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

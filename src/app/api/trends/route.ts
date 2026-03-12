import { NextResponse } from "next/server";

interface TrendItem {
  keyword: string;
  category: "tourism" | "weather" | "traffic" | "economy" | "marine";
  traffic: string;
  trendDirection: "up" | "down" | "stable";
  relatedCountries: string[];
  source: string;
}

const GOOGLE_TRENDS_RSS_TH = "https://trends.google.com/trending/rss?geo=TH";

const PHUKET_PATTERNS = [
  /phuket/i,
  /patong/i,
  /phang nga/i,
  /krabi/i,
  /khao lak/i,
  /andaman/i,
  /monsoon/i,
  /rain/i,
  /storm/i,
  /flood/i,
  /traffic/i,
  /airport/i,
  /flight/i,
  /ferry/i,
  /pier/i,
  /hotel/i,
  /tourism/i,
  /beach/i,
  /boat/i,
  /wave/i,
  /ภูเก็ต/i,
  /พังงา/i,
  /กระบี่/i,
  /ฝน/i,
  /น้ำท่วม/i,
  /จราจร/i,
  /สนามบิน/i,
  /นักท่องเที่ยว/i,
  /ทะเล/i,
  /เรือ/i,
  /คลื่น/i,
] as const;

function categorizeKeyword(kw: string): TrendItem["category"] {
  if (/weather|monsoon|rain|storm|flood|wave|ฝน|พายุ|น้ำท่วม|คลื่น/i.test(kw)) {
    return "weather";
  }

  if (/traffic|road|crash|airport|flight|bus|จราจร|ถนน|อุบัติเหตุ|สนามบิน/i.test(kw)) {
    return "traffic";
  }

  if (/hotel|occupancy|diesel|baht|economy|price|inflation|เศรษฐกิจ|ราคา/i.test(kw)) {
    return "economy";
  }

  if (/ferry|pier|beach|marine|sea|boat|diving|ทะเล|เรือ|หาด/i.test(kw)) {
    return "marine";
  }

  return "tourism";
}

function isPhuketRelated(title: string): boolean {
  return PHUKET_PATTERNS.some((pattern) => pattern.test(title));
}

async function fetchGoogleTrendsRSS(url: string): Promise<TrendItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AndamanPulse/1.0)" },
    });

    if (!res.ok) {
      return [];
    }

    const xml = await res.text();
    const items: TrendItem[] = [];
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[0];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const trafficMatch = itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);

      if (!titleMatch) {
        continue;
      }

      const title = titleMatch[1];
      if (!isPhuketRelated(title)) {
        continue;
      }

      items.push({
        keyword: title,
        category: categorizeKeyword(title),
        traffic: trafficMatch?.[1] ?? "10K+",
        trendDirection: "up",
        relatedCountries: ["Thailand"],
        source: "Google Trends",
      });
    }

    return items;
  } catch {
    return [];
  }
}

const CURATED_TOPICS: TrendItem[] = [
  {
    keyword: "Phuket weather",
    category: "weather",
    traffic: "200K+",
    trendDirection: "up",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Patong traffic",
    category: "traffic",
    traffic: "50K+",
    trendDirection: "up",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Phuket airport",
    category: "traffic",
    traffic: "100K+",
    trendDirection: "up",
    relatedCountries: ["Thailand", "Singapore"],
    source: "Google Trends",
  },
  {
    keyword: "Kata beach waves",
    category: "marine",
    traffic: "20K+",
    trendDirection: "up",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Phuket hotel occupancy",
    category: "economy",
    traffic: "10K+",
    trendDirection: "stable",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Andaman monsoon",
    category: "weather",
    traffic: "50K+",
    trendDirection: "up",
    relatedCountries: ["Thailand", "Malaysia"],
    source: "Google Trends",
  },
  {
    keyword: "Krabi ferry",
    category: "marine",
    traffic: "20K+",
    trendDirection: "stable",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Phang Nga rain",
    category: "weather",
    traffic: "10K+",
    trendDirection: "up",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Phuket old town tourism",
    category: "tourism",
    traffic: "20K+",
    trendDirection: "up",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Rawai pier boats",
    category: "marine",
    traffic: "10K+",
    trendDirection: "stable",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Southern Thailand diesel price",
    category: "economy",
    traffic: "10K+",
    trendDirection: "down",
    relatedCountries: ["Thailand"],
    source: "Google Trends",
  },
  {
    keyword: "Phuket weekend arrivals",
    category: "tourism",
    traffic: "50K+",
    trendDirection: "up",
    relatedCountries: ["Thailand", "Singapore", "Malaysia"],
    source: "Google Trends",
  },
];

export async function GET() {
  try {
    const liveTrends = await fetchGoogleTrendsRSS(GOOGLE_TRENDS_RSS_TH);
    const allTrends = [...liveTrends, ...CURATED_TOPICS];
    const seen = new Set<string>();
    const unique = allTrends.filter((item) => {
      const key = item.keyword.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const sorted = unique.sort((a, b) => {
      const trafficA = parseInt(a.traffic.replace(/[^0-9]/g, ""), 10) || 0;
      const trafficB = parseInt(b.traffic.replace(/[^0-9]/g, ""), 10) || 0;
      return trafficB - trafficA;
    });

    return NextResponse.json({
      keywords: sorted.slice(0, 12),
      lastUpdated: new Date().toISOString(),
      source: "Google Trends RSS (TH) + curated Phuket/Andaman topics",
    });
  } catch (error: unknown) {
    console.error("Trends error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      keywords: CURATED_TOPICS,
      lastUpdated: new Date().toISOString(),
      source: "Curated Phuket/Andaman topic monitoring",
    });
  }
}

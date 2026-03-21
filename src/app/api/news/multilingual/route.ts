import { NextResponse } from "next/server";

/**
 * Multilingual News Feed for Governor War Room
 *
 * Fetches REAL Phuket news from actual news outlets — not trending searches.
 * Sources: The Phuket Express, The Thaiger (Phuket), Bangkok Post (Phuket),
 * The Phuket News, and GDELT for broader international coverage.
 *
 * Every item has a clickable URL to the original source article.
 */

// ─── Real Phuket news RSS feeds ─────────────────────────────────
const PHUKET_RSS_FEEDS = [
  { id: "phuket-express", url: "https://www.thephuketnews.com/rss/news.xml", source: "The Phuket Express", trust: 14 },
  { id: "thaiger-phuket", url: "https://thethaiger.com/news/phuket/feed", source: "The Thaiger (Phuket)", trust: 13 },
  { id: "bangkok-post", url: "https://www.bangkokpost.com/rss/data/news.xml", source: "Bangkok Post", trust: 13 },
  { id: "phuket-news", url: "https://www.thephuketnews.com/rss/news.xml", source: "The Phuket News", trust: 12 },
];

// Google News search for Phuket-specific topics (backup)
const GOOGLE_NEWS_PHUKET = [
  "https://news.google.com/rss/search?q=Phuket+governor+OR+accident+OR+tourism+OR+airport+OR+safety&hl=en&gl=TH&ceid=TH:en",
  "https://news.google.com/rss/search?q=%E0%B8%A0%E0%B8%B9%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%95+%E0%B8%9C%E0%B8%B9%E0%B9%89%E0%B8%A7%E0%B9%88%E0%B8%B2+OR+%E0%B8%AD%E0%B8%B8%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B9%80%E0%B8%AB%E0%B8%95%E0%B8%B8+OR+%E0%B8%97%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A7&hl=th&gl=TH&ceid=TH:th",
];

const GDELT_QUERY =
  '("Phuket" OR "Patong" OR "Kata" OR "Karon" OR "Krabi" OR "Phang Nga" OR "Khao Lak" OR "Andaman")';
const GDELT_API_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
  GDELT_QUERY,
)}&mode=ArtList&format=json&maxrecords=15&sort=datedesc&timespan=7days`;

const TIMEOUT_MS = 10_000;
const SPORTS_FILTER = /soccer|football|premier league|world cup|fifa|champions league|basketball|nba|cricket|boxing|mma|ufc|celebrity|gossip|k-pop|esports|ฟุตบอล|ลีก|นักเตะ|กีฬา|เชลซี|ลิเวอร์พูล|แมนยู|อาร์เซนอล|บาร์เซโลนา|มิลาน|ยูเวนตุส|บาเยิร์น|everton|chelsea|liverpool|arsenal|tottenham|barcelona|juventus|bayern|milan|standings/i;

interface MultilingualNewsItem {
  id: string;
  lang: "th" | "en" | "zh";
  title: string;
  titleTh?: string;
  summary: string;
  source: string;
  zone: string;
  severity: "alert" | "watch" | "stable";
  publishedAt: string;
  url: string;
}

interface MultilingualNewsResponse {
  generatedAt: string;
  th: MultilingualNewsItem[];
  en: MultilingualNewsItem[];
  zh: MultilingualNewsItem[];
  sources: string[];
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getZone(text: string): string {
  const lower = text.toLowerCase();
  if (/patong|ป่าตอง/.test(lower)) return "Patong";
  if (/kata|กะตะ/.test(lower)) return "Kata";
  if (/karon|กะรน/.test(lower)) return "Karon";
  if (/airport|สนามบิน/.test(lower)) return "Airport";
  if (/old town|เมืองเก่า/.test(lower)) return "Old Town";
  if (/krabi|กระบี่/.test(lower)) return "Krabi";
  if (/phang.?nga|พังงา/.test(lower)) return "Phang Nga";
  if (/khao.?lak|เขาหลัก/.test(lower)) return "Khao Lak";
  if (/pier|ท่าเรือ|ferry/.test(lower)) return "Pier corridor";
  if (/phuket|ภูเก็ต/.test(lower)) return "Phuket";
  return "Andaman region";
}

function severity(text: string): "alert" | "watch" | "stable" {
  if (/warning|storm|flood|earthquake|tsunami|accident|crash|killed|dead|death|arrest|drug|fire|อันตราย|เตือน|เสียชีวิต|จับกุม/.test(text.toLowerCase()))
    return "alert";
  if (/rain|monsoon|closure|delay|rough|complaint|scam|overcrowd|ฝน|คลื่น|ร้องเรียน/.test(text.toLowerCase()))
    return "watch";
  return "stable";
}

function stripHtml(text: string) {
  return text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function isPhuketRelevant(text: string): boolean {
  return /phuket|patong|kata|karon|krabi|phang.?nga|khao.?lak|andaman|ภูเก็ต|ป่าตอง|กระบี่|พังงา|อันดามัน/i.test(text);
}

// ─── Parse RSS XML into news items ──────────────────────────────
function parseRssItems(xml: string, source: string, lang: "th" | "en", prefix: string): MultilingualNewsItem[] {
  const itemRegex = /<item>[\s\S]*?<\/item>/g;
  const items: MultilingualNewsItem[] = [];
  let match = itemRegex.exec(xml);

  while (match && items.length < 12) {
    const itemXml = match[0];
    const title =
      itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      itemXml.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
    const link =
      itemXml.match(/<link>(.*?)<\/link>/)?.[1] ??
      itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1] ?? "";
    const desc =
      itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
      itemXml.match(/<description>(.*?)<\/description>/)?.[1] ?? "";
    const pubDate =
      itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";

    if (title && link && !SPORTS_FILTER.test(title)) {
      const cleanTitle = stripHtml(title);
      const cleanDesc = stripHtml(desc).substring(0, 120);
      items.push({
        id: `${prefix}-${items.length + 1}`,
        lang,
        title: cleanTitle,
        titleTh: lang === "en" ? translateToTh(cleanTitle) : undefined,
        summary: cleanDesc || `${source}`,
        source,
        zone: getZone(cleanTitle + " " + cleanDesc),
        severity: severity(cleanTitle + " " + cleanDesc),
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        url: link,
      });
    }
    match = itemRegex.exec(xml);
  }

  return items;
}

// ─── Fetch real Phuket news from RSS outlets ────────────────────
async function fetchRealPhuketNews(): Promise<{ th: MultilingualNewsItem[]; en: MultilingualNewsItem[] }> {
  // Fetch all RSS feeds in parallel
  const feedPromises = PHUKET_RSS_FEEDS.map((feed) => fetchText(feed.url));
  const googlePromises = GOOGLE_NEWS_PHUKET.map((url) => fetchText(url));
  const gdeltPromise = fetchJson<{ articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> }>(GDELT_API_URL);

  const [feedResults, googleResults, gdeltResult] = await Promise.all([
    Promise.all(feedPromises),
    Promise.all(googlePromises),
    gdeltPromise,
  ]);

  const enItems: MultilingualNewsItem[] = [];
  const thItems: MultilingualNewsItem[] = [];

  // Parse RSS feeds (English Phuket news outlets)
  feedResults.forEach((xml, idx) => {
    if (!xml) return;
    const feed = PHUKET_RSS_FEEDS[idx];
    const parsed = parseRssItems(xml, feed.source, "en", feed.id);
    // Only keep Phuket-relevant items from general feeds
    const relevant = feed.id === "bangkok-post"
      ? parsed.filter((item) => isPhuketRelevant(item.title + " " + item.summary))
      : parsed;
    enItems.push(...relevant);
  });

  // Parse Google News Phuket search (Thai)
  if (googleResults[1]) {
    const parsed = parseRssItems(googleResults[1], "Google News ภูเก็ต", "th", "gn-th");
    thItems.push(...parsed);
  }

  // Parse Google News Phuket search (English)
  if (googleResults[0]) {
    const parsed = parseRssItems(googleResults[0], "Google News Phuket", "en", "gn-en");
    enItems.push(...parsed.filter((item) => isPhuketRelevant(item.title + " " + item.summary)));
  }

  // GDELT articles
  if (gdeltResult?.articles?.length) {
    const gdeltItems = gdeltResult.articles
      .filter((a) => a.title && a.url && !SPORTS_FILTER.test(a.title!))
      .slice(0, 8)
      .map((article, idx) => ({
        id: `gdelt-${idx + 1}`,
        lang: "en" as const,
        title: stripHtml(article.title!),
        titleTh: translateToTh(article.title!),
        summary: `via ${article.domain ?? "international media"}`,
        source: article.domain ?? "GDELT",
        zone: getZone(article.title!),
        severity: severity(article.title!),
        publishedAt: article.seendate
          ? new Date(article.seendate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString()
          : new Date().toISOString(),
        url: article.url!,
      }));
    enItems.push(...gdeltItems);
  }

  // Deduplicate by title similarity
  const seenTitles = new Set<string>();
  const dedup = (items: MultilingualNewsItem[]) =>
    items.filter((item) => {
      const key = item.title.toLowerCase().substring(0, 40);
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

  // Sort by severity (alert first) then recency
  const sortItems = (items: MultilingualNewsItem[]) =>
    items.sort((a, b) => {
      const sevOrder = { alert: 0, watch: 1, stable: 2 };
      const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

  return {
    en: sortItems(dedup(enItems)).slice(0, 10),
    th: sortItems(thItems).slice(0, 10),
  };
}

// ─── Thai translation for English headlines ─────────────────────

const TH_ZONE_MAP: Record<string, string> = {
  Phuket: "ภูเก็ต", Patong: "ป่าตอง", Kata: "กะตะ", Karon: "กะรน",
  Airport: "สนามบิน", "Old Town": "เมืองเก่า", Krabi: "กระบี่",
  "Phang Nga": "พังงา", "Khao Lak": "เขาหลัก", "Pier corridor": "ท่าเรือ",
  "Andaman region": "อันดามัน",
};

const TH_KEYWORD_MAP: [RegExp, string][] = [
  [/weather|forecast|climate/i, "สภาพอากาศ"],
  [/storm|monsoon|typhoon/i, "พายุ/มรสุม"],
  [/rain|flood|rainfall/i, "ฝนตก/น้ำท่วม"],
  [/tourism|tourist|visitor|arrivals/i, "การท่องเที่ยว"],
  [/beach|sea|marine|ocean|wave|jellyfish/i, "ทะเล/ชายหาด"],
  [/airport|flight|airline/i, "สนามบิน/เที่ยวบิน"],
  [/ferry|pier|boat/i, "เรือ/ท่าเรือ"],
  [/accident|crash|incident|killed|dead|death/i, "อุบัติเหตุ"],
  [/warning|alert|danger/i, "เตือนภัย"],
  [/hotel|resort|accommodation/i, "โรงแรม/ที่พัก"],
  [/arrest|drug|crime|police|bust/i, "จับกุม/ตำรวจ"],
  [/security|safety|patrol/i, "ความปลอดภัย"],
  [/governor|government|administration/i, "ผู้ว่าราชการ"],
  [/economy|economic|cost|price|billion|baht/i, "เศรษฐกิจ"],
  [/traffic|road|transport|tuk.?tuk/i, "จราจร/คมนาคม"],
  [/rescue|emergency|ambulance/i, "กู้ภัย/ฉุกเฉิน"],
  [/overstay|immigration|visa/i, "ตรวจคนเข้าเมือง"],
  [/scam|fraud|complaint/i, "ร้องเรียน/หลอกลวง"],
  [/construction|road.?work|infrastructure/i, "โครงสร้างพื้นฐาน"],
  [/fire|blaze|burn/i, "ไฟไหม้"],
];

function translateToTh(title: string): string {
  const zone = getZone(title);
  const thZone = TH_ZONE_MAP[zone] ?? "อันดามัน";
  for (const [pattern, thTopic] of TH_KEYWORD_MAP) {
    if (pattern.test(title)) {
      return `${thZone}: ${thTopic}`;
    }
  }
  return `${thZone}: ข่าวล่าสุด`;
}

// ─── Chinese translation ────────────────────────────────────────

const ZH_ZONE_MAP: Record<string, string> = {
  Phuket: "普吉", Patong: "芭东", Kata: "卡塔", Karon: "卡伦",
  Airport: "机场", "Old Town": "老城", Krabi: "甲米",
  "Phang Nga": "攀牙", "Khao Lak": "考拉", "Pier corridor": "码头",
  "Andaman region": "安达曼",
};

const ZH_KEYWORD_MAP: [RegExp, string][] = [
  [/weather|forecast|climate/i, "天气预报"],
  [/storm|monsoon|typhoon/i, "风暴预警"],
  [/rain|flood|rainfall/i, "降雨信息"],
  [/tourism|tourist|visitor/i, "旅游动态"],
  [/beach|sea|marine|ocean/i, "海滩与海况"],
  [/airport|flight|airline/i, "机场航班"],
  [/accident|crash|killed/i, "事故报道"],
  [/warning|alert|danger/i, "安全警告"],
  [/arrest|drug|crime|police/i, "治安消息"],
  [/hotel|resort/i, "住宿信息"],
];

function translateToZh(title: string): string {
  const zone = getZone(title);
  const zhZone = ZH_ZONE_MAP[zone] ?? "安达曼";
  for (const [pattern, zhTitle] of ZH_KEYWORD_MAP) {
    if (pattern.test(title)) return `${zhZone}: ${zhTitle}`;
  }
  return `${zhZone}地区最新消息`;
}

function buildChineseSignals(enItems: MultilingualNewsItem[]): MultilingualNewsItem[] {
  return enItems.slice(0, 6).map((item, idx) => ({
    id: `zh-${idx + 1}`,
    lang: "zh" as const,
    title: translateToZh(item.title),
    summary: item.summary,
    source: `${item.source} (译)`,
    zone: item.zone,
    severity: item.severity,
    publishedAt: item.publishedAt,
    url: item.url,
  }));
}

// ─── Main handler ───────────────────────────────────────────────

export async function GET() {
  const { th, en } = await fetchRealPhuketNews();
  const zh = buildChineseSignals(en);

  const response: MultilingualNewsResponse = {
    generatedAt: new Date().toISOString(),
    th,
    en,
    zh,
    sources: [
      "The Phuket Express",
      "The Thaiger (Phuket)",
      "Bangkok Post",
      "Google News Phuket",
      "GDELT",
    ],
  };

  return NextResponse.json(response);
}

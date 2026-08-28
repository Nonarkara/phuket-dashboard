// ─── Lopburi Social Listening ───────────────────────────────────
// Aggregates public mention streams about Lopburi province:
//   - Google News RSS (Thai query "ลพบุรี", English query "Lopburi")
//   - GDELT DOC 2.0 global media firehose (English coverage)
// Each mention is categorized, severity-scored, and sentiment-tagged
// via a transparent keyword lexicon (marked as such in the UI).
// Falls back to deterministic scenario mentions when feeds are
// unreachable or a demo scenario is pinned.

import { cached } from "../cache";
import type {
  SocialChannel,
  SocialListeningResponse,
  SocialMention,
  SocialSentiment,
  SocialSeverity,
} from "../../types/lopburi";
import { normalizeLopburiScenario } from "./config";

const ATTRIBUTION = "Google News RSS + GDELT DOC 2.0 — lexicon sentiment";

const CATEGORIES: { label: string; color: string; pattern: RegExp; severity: SocialSeverity }[] = [
  { label: "FLOOD", color: "#ef4444", pattern: /flood|น้ำท่วม|น้ำล้น|เขื่อน|ระบายน้ำ|inundat|overflow/i, severity: "alert" },
  { label: "ACCIDENT", color: "#ef4444", pattern: /accident|crash|kill|dead|death|injur|อุบัติเหตุ|เสียชีวิต|ชน/i, severity: "alert" },
  { label: "CRIME", color: "#f97316", pattern: /arrest|drug|crime|police|raid|fraud|scam|จับกุม|ตำรวจ|ยาเสพติด|ปล้น/i, severity: "watch" },
  { label: "MONKEY", color: "#f59e0b", pattern: /monkey|macaque|ลิง/i, severity: "watch" },
  { label: "WEATHER", color: "#6366f1", pattern: /storm|rain|monsoon|heat|พายุ|ฝน|อากาศ|ร้อน/i, severity: "watch" },
  { label: "MILITARY", color: "#22c55e", pattern: /army|military|ทหาร|กองทัพ|special warfare|รบพิเศษ|airbase/i, severity: "info" },
  { label: "TOURISM", color: "#0ea5e9", pattern: /tourism|tourist|sunflower|festival|ท่องเที่ยว|ทานตะวัน|เทศกาล|งานแผ่นดิน/i, severity: "info" },
  { label: "TRAFFIC", color: "#f59e0b", pattern: /traffic|road|highway|จราจร|ถนน|ทางหลวง/i, severity: "watch" },
  { label: "GOV", color: "#22c55e", pattern: /governor|government|budget|ผู้ว่า|รัฐบาล|งบประมาณ|จังหวัด/i, severity: "info" },
];

const NEGATIVE = /flood|dead|death|kill|crash|accident|arrest|drug|crime|fire|damage|warning|เตือน|น้ำท่วม|เสียชีวิต|อุบัติเหตุ|จับกุม|ไฟไหม้|เสียหาย|วิกฤต|ระบาด/i;
const POSITIVE = /open|launch|award|win|success|festival|boost|celebrate|record|เปิด|รางวัล|สำเร็จ|เทศกาล|คึกคัก|ฟื้นตัว|ยอดเยี่ยม|ต้อนรับ/i;

function classify(title: string): { category: string; color: string; severity: SocialSeverity } {
  for (const c of CATEGORIES) {
    if (c.pattern.test(title)) return { category: c.label, color: c.color, severity: c.severity };
  }
  return { category: "MENTION", color: "#858585", severity: "info" };
}

function sentimentOf(title: string): SocialSentiment {
  const neg = NEGATIVE.test(title);
  const pos = POSITIVE.test(title);
  if (neg && !pos) return "negative";
  if (pos && !neg) return "positive";
  return "neutral";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseRssItems(xml: string, channel: SocialChannel, lang: "th" | "en"): SocialMention[] {
  const items: SocialMention[] = [];
  const blocks = xml.split(/<item[\s>]/).slice(1);
  for (const block of blocks.slice(0, 25)) {
    const title = decodeEntities(
      /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? "",
    );
    if (!title) continue;
    const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]?.trim() ?? null;
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]?.trim() ?? null;
    const source = decodeEntities(
      /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(block)?.[1] ?? "Google News",
    );
    const cls = classify(title);
    let publishedAt: string | null = null;
    if (pubDate) {
      const t = Date.parse(pubDate);
      if (Number.isFinite(t)) publishedAt = new Date(t).toISOString();
    }
    items.push({
      id: `${channel}-${items.length}-${(link ?? title).slice(-24)}`,
      title,
      url: link,
      source,
      channel,
      lang,
      category: cls.category,
      categoryColor: cls.color,
      sentiment: sentimentOf(title),
      severity: cls.severity,
      publishedAt,
    });
  }
  return items;
}

async function fetchGoogleNews(query: string, hl: string, gl: string, ceid: string, channel: SocialChannel, lang: "th" | "en") {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 LopburiDashboard/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [] as SocialMention[];
  return parseRssItems(await res.text(), channel, lang);
}

interface GdeltArticle {
  url?: string;
  title?: string;
  domain?: string;
  seendate?: string; // yyyyMMddThhmmssZ
  language?: string;
}

async function fetchGdelt(): Promise<SocialMention[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=Lopburi&mode=artlist&format=json&maxrecords=20&timespan=5d&sort=datedesc";
  const res = await fetch(url, {
    headers: { "User-Agent": "LopburiDashboard/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const articles: GdeltArticle[] = json?.articles ?? [];
  return articles.slice(0, 20).map((a, i) => {
    const title = decodeEntities(a.title ?? "");
    const cls = classify(title);
    let publishedAt: string | null = null;
    if (a.seendate && /^\d{8}T\d{6}Z$/.test(a.seendate)) {
      const s = a.seendate;
      publishedAt = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
    }
    return {
      id: `gdelt-${i}-${(a.url ?? "").slice(-24)}`,
      title,
      url: a.url ?? null,
      source: a.domain ?? "GDELT",
      channel: "gdelt" as const,
      lang: "en" as const,
      category: cls.category,
      categoryColor: cls.color,
      sentiment: sentimentOf(title),
      severity: cls.severity,
      publishedAt,
    };
  });
}

function buildResponse(
  mentions: SocialMention[],
  source: SocialListeningResponse["source"],
  attribution: string,
): SocialListeningResponse {
  // Dedupe near-identical titles across channels.
  const seen = new Set<string>();
  const deduped = mentions.filter((m) => {
    const key = m.title.toLowerCase().slice(0, 72);
    if (!m.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (a.severity === "alert" && b.severity !== "alert") return -1;
    if (b.severity === "alert" && a.severity !== "alert") return 1;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const byChannel: Record<SocialChannel, number> = { "news-th": 0, "news-en": 0, gdelt: 0 };
  const topicCount = new Map<string, { color: string; count: number }>();
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let alerts = 0;

  for (const m of deduped) {
    byChannel[m.channel] += 1;
    if (m.sentiment === "positive") positive += 1;
    else if (m.sentiment === "negative") negative += 1;
    else neutral += 1;
    if (m.severity === "alert") alerts += 1;
    if (m.category !== "MENTION") {
      const cur = topicCount.get(m.category) ?? { color: m.categoryColor, count: 0 };
      cur.count += 1;
      topicCount.set(m.category, cur);
    }
  }

  const topTopics = [...topicCount.entries()]
    .map(([label, v]) => ({ label, color: v.color, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    source,
    attribution,
    mentions: deduped.slice(0, 60),
    counts: { total: deduped.length, positive, neutral, negative, alerts, byChannel },
    topTopics,
  };
}

// ─── Scenario mentions ──────────────────────────────────────────
// Deterministic modeled mention set for pinned demo scenarios. Every
// item is clearly scenario-modeled (no fabricated live URLs).

function scenarioMentions(scenario: string): SocialMention[] {
  const now = Date.now();
  const at = (minAgo: number) => new Date(now - minAgo * 60000).toISOString();
  const mk = (
    i: number,
    title: string,
    lang: "th" | "en",
    channel: SocialChannel,
    minAgo: number,
  ): SocialMention => {
    const cls = classify(title);
    return {
      id: `scn-${scenario}-${i}`,
      title,
      url: null,
      source: "Scenario model",
      channel,
      lang,
      category: cls.category,
      categoryColor: cls.color,
      sentiment: sentimentOf(title),
      severity: cls.severity,
      publishedAt: at(minAgo),
    };
  };

  if (scenario === "red-monsoon-day") {
    return [
      mk(1, "เตือนน้ำท่วมฉับพลัน ลุ่มน้ำลพบุรี อ.ท่าวุ้ง-บ้านหมี่ ระดับน้ำใกล้ตลิ่ง", "th", "news-th", 22),
      mk(2, "เขื่อนป่าสักชลสิทธิ์เพิ่มการระบายน้ำ แจ้งเตือนท้ายเขื่อน 2 อำเภอ", "th", "news-th", 41),
      mk(3, "Pa Sak dam raises discharge as monsoon band stalls over central Thailand", "en", "gdelt", 65),
      mk(4, "ฝนตกหนักต่อเนื่อง ถนนสาย 21 ชัยบาดาล น้ำท่วมผิวจราจร", "th", "news-th", 88),
      mk(5, "Flood watch: Lopburi lowland villages stage sandbag lines along river", "en", "news-en", 120),
      mk(6, "ผู้ว่าฯ ลพบุรี ตั้งศูนย์บัญชาการน้ำ สั่งเฝ้าระวัง 24 ชม.", "th", "news-th", 150),
    ];
  }
  if (scenario === "stable-recovery-day") {
    return [
      mk(1, "ลพบุรีฟื้นตัว ยอดนักท่องเที่ยววังนารายณ์เพิ่มต่อเนื่อง", "th", "news-th", 35),
      mk(2, "Sunflower fields draw weekend visitors back to Lopburi", "en", "news-en", 70),
      mk(3, "เขื่อนป่าสักเก็บกักน้ำเข้าสู่แผนฤดูแล้ง สถานการณ์ปกติ", "th", "news-th", 110),
      mk(4, "งานแผ่นดินสมเด็จพระนารายณ์เตรียมเปิดฉาก คึกคักทั้งเมืองเก่า", "th", "news-th", 160),
      mk(5, "Lopburi monkey festival preparations underway at Phra Prang Sam Yot", "en", "gdelt", 210),
    ];
  }
  return [
    mk(1, "ทุ่งทานตะวันเขาจีนแลบานสะพรั่ง นักท่องเที่ยวแน่นสุดสัปดาห์", "th", "news-th", 25),
    mk(2, "Traffic builds on Highway 1 as sunflower-season crowds head to Lopburi", "en", "news-en", 55),
    mk(3, "ตำรวจจัดกำลังดูแลจราจรเส้นทางชมทุ่งทานตะวัน พัฒนานิคม", "th", "news-th", 90),
    mk(4, "โรงแรมเมืองลพบุรียอดจองเต็มรับเทศกาล", "th", "news-th", 140),
    mk(5, "Monkey banquet weekend: Lopburi old town braces for visitor surge", "en", "gdelt", 190),
  ];
}

export async function loadLopburiSocial(
  scenarioParam: string | null,
): Promise<SocialListeningResponse> {
  const scenario = normalizeLopburiScenario(scenarioParam);
  if (scenario) {
    return buildResponse(
      scenarioMentions(scenario),
      "scenario",
      `${ATTRIBUTION} (scenario-modeled: ${scenario})`,
    );
  }

  return cached("lopburi-social-live", 180, async () => {
    const [th, en, gdelt] = await Promise.all([
      fetchGoogleNews("ลพบุรี", "th", "TH", "TH:th", "news-th", "th").catch(() => []),
      fetchGoogleNews("Lopburi", "en-US", "US", "US:en", "news-en", "en").catch(() => []),
      fetchGdelt().catch(() => []),
    ]);
    const all = [...th, ...en, ...gdelt];
    if (all.length === 0) {
      return buildResponse(
        scenarioMentions("tourism-surge-weekend"),
        "modeled",
        `${ATTRIBUTION} (reference model — live feeds unreachable)`,
      );
    }
    return buildResponse(all, "live", ATTRIBUTION);
  });
}

/**
 * Pure news helpers — no fetch, no KV, no AI, no clock beyond what is passed in.
 * Kept separate from index.js so test.mjs can assert on them directly.
 */

// Bing News RSS, one market per visitor-origin language.
//
// Google News RSS is NOT used: it returns 503 to every Cloudflare Worker egress IP.
// Verified 2026-07-26 — works from a laptop, hard-fails from the edge. Bing serves
// the same markets and answers Workers, so it is the only viable multilingual source
// for a cron that runs on Cloudflare. Do not "restore" Google here.
//
// Queries are in native script: searching "Phuket" on the Russian market returns a
// fraction of what "Пхукет" does.
export const LANG_FEEDS = [
  { lang: "th", q: "ภูเก็ต", mkt: "th-TH" },
  { lang: "en", q: "Phuket", mkt: "en-US" },
  // Bing has no mainland (zh-CN) market — it returns zero items. zh-HK serves
  // Simplified-Chinese results about Phuket, which is what we want.
  { lang: "zh", q: "普吉岛", mkt: "zh-HK" },
  { lang: "ru", q: "Пхукет", mkt: "ru-RU" },
  { lang: "hi", q: "फुकेत", mkt: "hi-IN" },
  { lang: "ko", q: "푸껫", mkt: "ko-KR" },
  { lang: "ja", q: "プーケット", mkt: "ja-JP" },
  { lang: "de", q: "Phuket", mkt: "de-DE" },
  // Bare "פוקט" also matches "Polly Pocket" and similar brand transliterations,
  // which pulled film listings into the feed. Pairing it with תאילנד disambiguates.
  { lang: "he", q: "פוקט תאילנד", mkt: "he-IL" },
  // kk-KZ and ru-KZ both return zero. Narrowing the ru-RU market with "Казахстан"
  // is what actually surfaces Kazakh-market coverage (e.g. medical repatriations).
  { lang: "kk", q: "Пхукет Казахстан", mkt: "ru-RU" },
  { lang: "fr", q: "Phuket", mkt: "fr-FR" },
];

// Local outlets, kept from the previous pipeline along with their trust weights.
// thephuketnews.com/rss/phuket-news.xml was dropped — it 404s from Cloudflare and
// 403s from a laptop. It had been dead in the old pipeline.
export const LOCAL_FEEDS = [
  { url: "https://thethaiger.com/news/phuket/feed", source: "The Thaiger (Phuket)", lang: "en", trust: 0.8 },
  { url: "https://thethaiger.com/news/south/feed", source: "The Thaiger (South)", lang: "en", trust: 0.75 },
  { url: "https://www.bangkokpost.com/rss/data/thailand.xml", source: "Bangkok Post", lang: "en", trust: 0.9 },
  { url: "https://www.nationthailand.com/rss", source: "Nation Thailand", lang: "en", trust: 0.8 },
  { url: "https://www.thaipbsworld.com/feed/", source: "Thai PBS World", lang: "en", trust: 0.85 },
];

export function bingNewsUrl({ q, mkt }) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&mkt=${mkt}`;
}

/** Bing wraps every link in apiclick.aspx?...&url=<encoded>&... — unwrap to the publisher. */
export function unwrapLink(link) {
  const m = link.match(/[?&]url=([^&]+)/);
  if (!m) return link;
  try { return decodeURIComponent(m[1]); } catch { return link; }
}

const TAG = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};

export function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Google News titles arrive as "Headline - Publisher". Split off the publisher. */
export function splitPublisher(title) {
  const i = title.lastIndexOf(" - ");
  if (i > 20 && i > title.length - 60) {
    return { title: title.slice(0, i).trim(), publisher: title.slice(i + 3).trim() };
  }
  return { title: title.trim(), publisher: "" };
}

export function parseRss(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const title = decodeEntities(TAG(b, "title"));
    if (!title) continue;
    out.push({
      title,
      link: unwrapLink(decodeEntities(TAG(b, "link"))),
      publishedAt: decodeEntities(TAG(b, "pubDate")),
      description: decodeEntities(TAG(b, "description")).slice(0, 400),
      // Bing uses <News:Source>; plain RSS uses <source>. Match either.
      sourceTag: decodeEntities(TAG(b, "News:Source") || TAG(b, "source")),
    });
  }
  return out;
}

// Zones are matched on native script too — a Russian article says "Патонг", not "Patong".
const ZONES = [
  ["Patong", /patong|ป่าตอง|芭东|巴东|パトン|파통|Патонг|पटोंग|פאטונג/i],
  ["Kata", /\bkata\b|กะตะ|卡塔|カタ|까따|Ката/i],
  ["Karon", /karon|กะรน|卡伦|カロン|까론|Карон/i],
  ["Kamala", /kamala|กมลา|卡马拉|カマラ|Камала/i],
  ["Rawai", /rawai|ราไวย์|拉威|ラワイ|Раваи/i],
  ["Chalong", /chalong|ฉลอง|查龙|チャロン|Чалонг/i],
  ["Airport", /airport|สนามบิน|机场|空港|공항|аэропорт|हवाई अड्डा|נמל התעופה/i],
  ["Old Town", /old town|เมืองเก่า|老城|オールドタウン|Старый город/i],
  ["Bang Tao", /bang ?tao|บางเทา|邦涛|バンタオ|Бангтао/i],
  ["Mai Khao", /mai ?khao|ไม้ขาว|迈考|マイカオ/i],
  ["Pier", /pier|marina|ท่าเรือ|码头|港|причал|埠頭/i],
];

export function getZone(text) {
  for (const [zone, re] of ZONES) if (re.test(text)) return zone;
  return "Phuket";
}

const ALERT = /killed|death|died|fatal|drown|crash|collapse|arrest|stab|shoot|flood|tsunami|earthquake|evacuat|explosion|fire\b|robber|rape|murder|เสียชีวิต|จมน้ำ|อุบัติเหตุ|น้ำท่วม|จับกุม|ไฟไหม้|死|遇难|溺水|事故|погиб|утонул|авари|задержан|मौत|हादसा|사망|사고|死亡|Getötet|נהרג/i;
const WATCH = /warning|alert|storm|heavy rain|closed|protest|surge|shortage|outage|delay|scam|เตือน|พายุ|ฝนตกหนัก|ปิด|ประท้วง|警告|暴雨|关闭|предупрежд|шторм|закрыт|चेतावनी|경보|폭우|Warnung|אזהרה/i;

export function severity(text) {
  if (ALERT.test(text)) return "alert";
  if (WATCH.test(text)) return "watch";
  return "stable";
}

const SPORTS = /football|soccer|premier league|fifa|nba|golf tournament|tennis|badminton|muay thai fight night|regatta result/i;

// General/national feeds carry plenty of non-Phuket news; language feeds are already
// scoped by the query. Native-script Phuket spellings included.
const PHUKET = /phuket|patong|kata|karon|kamala|rawai|chalong|thalang|kathu|andaman|ภูเก็ต|ป่าตอง|ถลาง|กะทู้|普吉|プーケット|푸껫|Пхукет|फुकेत|פוקט/i;

export function isRelevant(text, { scoped }) {
  if (SPORTS.test(text)) return false;
  return scoped || PHUKET.test(text);
}

/** Normalised key for cross-language dedup of syndicated wire copy. */
export function dedupKey(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 60);
}

export function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.lang}:${dedupKey(it.title)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * FNV-1a. Ids were previously the title's first 40 characters, which collided
 * constantly — Russian headlines share long prefixes, and React then rendered
 * duplicate keys. Sync and pure so toItem stays testable.
 */
export function hashId(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const RANK = { alert: 0, watch: 1, stable: 2 };

export function rank(items) {
  return [...items].sort((a, b) => {
    const s = RANK[a.severity] - RANK[b.severity];
    if (s !== 0) return s;
    return (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0);
  });
}

/** Build a normalised item from a raw RSS entry. Returns null if it should be dropped. */
export function toItem(raw, { lang, source, trust, scoped }) {
  const { title, publisher } = splitPublisher(raw.title);
  const haystack = `${title} ${raw.description}`;
  if (!title || !isRelevant(haystack, { scoped })) return null;
  const iso = Date.parse(raw.publishedAt);
  return {
    id: `${lang}-${hashId(`${title}|${raw.link}`)}`,
    lang,
    title,
    url: raw.link,
    source: publisher || raw.sourceTag || source || "Google News",
    trust: trust ?? 0.6,
    zone: getZone(haystack),
    severity: severity(haystack),
    publishedAt: Number.isFinite(iso) ? new Date(iso).toISOString() : null,
    // Filled in by the translation stage. Never synthesised.
    titleEn: lang === "en" ? title : null,
    titleTh: lang === "th" ? title : null,
    translation: null,
  };
}

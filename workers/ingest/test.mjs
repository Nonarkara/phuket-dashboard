/**
 * Self-check for the pure news helpers. Run: node workers/ingest/test.mjs
 * No framework. Fails loudly if the parsing/classification logic breaks.
 */
import assert from "node:assert/strict";
import {
  parseRss, splitPublisher, decodeEntities, getZone, severity,
  isRelevant, dedupKey, dedupe, rank, toItem, bingNewsUrl, unwrapLink, hashId, LANG_FEEDS,
} from "./src/news-core.js";

const RSS = `<rss><channel>
<item><title>Russian tourist dies in Patong crash - The Phuket News</title>
<link>https://example.com/a</link><pubDate>Sat, 26 Jul 2026 04:00:00 GMT</pubDate>
<description><![CDATA[<p>A crash on Nanai Rd &amp; the bypass.</p>]]></description></item>
<item><title>Phuket football club wins league - Sport Daily</title>
<link>https://example.com/b</link><pubDate>Sat, 26 Jul 2026 03:00:00 GMT</pubDate>
<description>Match report</description></item>
<item><title>Bangkok condo prices rise - Property Post</title>
<link>https://example.com/c</link><pubDate>Sat, 26 Jul 2026 02:00:00 GMT</pubDate>
<description>Nothing to do with the island</description></item>
</channel></rss>`;

// --- parsing -----------------------------------------------------------------
const raw = parseRss(RSS);
assert.equal(raw.length, 3, "should parse 3 items");
assert.equal(raw[0].description, "A crash on Nanai Rd & the bypass.", "CDATA/HTML/entities stripped");
assert.equal(decodeEntities("&#8220;hi&#8221;"), "“hi”", "numeric entities decode");

// --- publisher split ---------------------------------------------------------
assert.deepEqual(
  splitPublisher("Russian tourist dies in Patong crash - The Phuket News"),
  { title: "Russian tourist dies in Patong crash", publisher: "The Phuket News" },
);
assert.equal(splitPublisher("Short - x").title, "Short - x", "does not split a short title");

// --- classification ----------------------------------------------------------
assert.equal(getZone("crash in Patong last night"), "Patong");
assert.equal(getZone("Погиб турист в Патонге"), "Patong", "zone matches native script");
assert.equal(getZone("something in town"), "Phuket", "falls back to province");
assert.equal(severity("tourist drowned off Kata"), "alert");
assert.equal(severity("heavy rain warning issued"), "watch");
assert.equal(severity("new cafe opens"), "stable");
assert.equal(severity("Российский турист погиб"), "alert", "severity matches native script");

// --- relevance ---------------------------------------------------------------
assert.equal(isRelevant("Phuket football club wins league", { scoped: false }), false, "sports excluded");
assert.equal(isRelevant("Phuket football club wins league", { scoped: true }), false, "sports excluded even when scoped");
assert.equal(isRelevant("Bangkok condo prices rise", { scoped: false }), false, "off-island dropped on general feeds");
assert.equal(isRelevant("Bangkok condo prices rise", { scoped: true }), true, "language feeds are pre-scoped by query");
assert.equal(isRelevant("Пхукет закрыт", { scoped: false }), true, "native-script Phuket recognised");

// --- item building -----------------------------------------------------------
const items = raw.map((r) => toItem(r, { lang: "en", source: "Test", trust: 0.9, scoped: false })).filter(Boolean);
assert.equal(items.length, 1, "sports + off-island dropped, 1 survives");
const it = items[0];
assert.equal(it.zone, "Patong");
assert.equal(it.severity, "alert");
assert.equal(it.titleEn, it.title, "English source needs no translation");
assert.equal(it.titleTh, null, "Thai translation is left for the AI stage, never invented");
assert.equal(it.publishedAt, "2026-07-26T04:00:00.000Z");

const noDate = toItem({ ...raw[0], pubDate: "", publishedAt: "not a date" }, { lang: "en", scoped: true });
assert.equal(noDate.publishedAt, null, "unparseable date becomes null, not Date.now()");

// --- dedup + rank ------------------------------------------------------------
assert.equal(dedupKey("Tourist Dies!!  In Patong"), dedupKey("tourist dies in patong"));
const dupes = [
  { lang: "ru", title: "Погиб турист", severity: "alert", publishedAt: "2026-07-26T01:00:00Z" },
  { lang: "ru", title: "Погиб  турист!", severity: "alert", publishedAt: "2026-07-26T02:00:00Z" },
  { lang: "kk", title: "Погиб турист", severity: "alert", publishedAt: "2026-07-26T03:00:00Z" },
];
assert.equal(dedupe(dupes).length, 2, "dedup within a language, not across (kk is a distinct market)");

const ordered = rank([
  { severity: "stable", publishedAt: "2026-07-26T09:00:00Z" },
  { severity: "alert", publishedAt: "2026-07-26T01:00:00Z" },
  { severity: "watch", publishedAt: "2026-07-26T08:00:00Z" },
]);
assert.deepEqual(ordered.map((x) => x.severity), ["alert", "watch", "stable"], "severity beats recency");

// --- Bing specifics ----------------------------------------------------------
const BING = `<rss><channel><item>
<title>Пхукет готовится к буддийскому посту</title>
<link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;url=https%3a%2f%2fwww.tourprom.ru%2fnews%2f87801%2f&amp;c=81717&amp;mkt=ru-ru</link>
<description>Туристов ждут ограничения на продажу алкоголя.</description>
<pubDate>Sat, 25 Jul 2026 14:06:00 GMT</pubDate>
<News:Source>ТУРПРОМ</News:Source></item></channel></rss>`;
const [bing] = parseRss(BING);
assert.equal(bing.link, "https://www.tourprom.ru/news/87801/", "Bing redirect unwrapped to the publisher URL");
assert.equal(bing.sourceTag, "ТУРПРОМ", "News:Source parsed");
assert.equal(unwrapLink("https://plain.example/article"), "https://plain.example/article", "non-Bing link passes through");

const ruItem = toItem(bing, { lang: "ru", scoped: true });
assert.equal(ruItem.source, "ТУРПРОМ", "publisher taken from News:Source");
assert.equal(ruItem.titleEn, null, "Russian item awaits real translation");
assert.equal(ruItem.titleTh, null);
assert.equal(ruItem.url, "https://www.tourprom.ru/news/87801/");

// --- ids must not collide on long shared prefixes -----------------------------
// Real regression: Russian headlines share 40+ character prefixes, and truncating
// the title for the id produced duplicate React keys in the sidebar.
const longA = "Высокопоставленный чиновник сбил насмерть российского туриста в Таиланде";
const longB = "Высокопоставленный чиновник сбил насмерть российского туриста на Пхукете";
const idA = toItem({ title: longA, link: "https://a.example/1", publishedAt: "", description: "" }, { lang: "ru", scoped: true }).id;
const idB = toItem({ title: longB, link: "https://a.example/2", publishedAt: "", description: "" }, { lang: "ru", scoped: true }).id;
assert.notEqual(idA, idB, "near-identical long headlines must get distinct ids");
assert.equal(
  idA,
  toItem({ title: longA, link: "https://a.example/1", publishedAt: "", description: "" }, { lang: "ru", scoped: true }).id,
  "id must be stable for the same title+link",
);
assert.equal(hashId("a"), hashId("a"));
assert.notEqual(hashId("a"), hashId("b"));

// --- feed config -------------------------------------------------------------
assert.equal(LANG_FEEDS.length, 11, "11 visitor-origin languages");
assert.equal(new Set(LANG_FEEDS.map((f) => f.lang)).size, 11, "no duplicate language codes");
assert.equal(
  bingNewsUrl(LANG_FEEDS.find((f) => f.lang === "ru")),
  "https://www.bing.com/news/search?q=%D0%9F%D1%85%D1%83%D0%BA%D0%B5%D1%82&format=RSS&mkt=ru-RU",
);
// zh must not use a mainland market — Bing returns zero items for zh-CN.
assert.notEqual(LANG_FEEDS.find((f) => f.lang === "zh").mkt, "zh-CN");
// kk must not be a bare copy of the ru feed, or it just duplicates Russian results.
const kk = LANG_FEEDS.find((f) => f.lang === "kk");
const ru = LANG_FEEDS.find((f) => f.lang === "ru");
assert.notEqual(kk.q, ru.q, "kk feed must be narrowed, not identical to ru");

console.log("news-core: all checks passed");

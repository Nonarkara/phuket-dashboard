/**
 * Phuket ingest worker — cron-driven. Fetches, translates and writes finished JSON
 * to KV. The dashboard's API routes only ever read KV, so a slow or dead upstream
 * can never block a page load.
 *
 * Deliberately a separate worker from the OpenNext-generated app worker: adding a
 * scheduled() handler to generated build output means patching it on every build.
 */
import {
  LANG_FEEDS, LOCAL_FEEDS, bingNewsUrl, parseRss, toItem, dedupe, rank,
} from "./news-core.js";

const NEWS_KEY = "news:latest";
// Prefix doubles as the cache version. Bump it whenever the translation prompt or
// model changes, otherwise the cache serves output from the old prompt forever.
// v3 = anti-hallucination prompt (no invented places, no currency conversion).
const TR_PREFIX = "tr3:";
// Per-tick translation budget. Deliberately small: a tick that tries to translate
// everything gets killed mid-flight and never writes back its enriched payload.
// 30 x 4 ticks/hour = ~2,900/day against ~100-300 genuinely new headlines, so the
// backlog drains within an hour of a cold cache and stays drained after that.
// Each translate() writes its own KV entry, so work already done survives a killed
// run — the next tick picks it up from cache for free.
const TRANSLATE_BUDGET = 30;
const TRANSLATE_DEADLINE_MS = 25_000;

// Bake-off 2026-07-26 on a hard Korean headline
// ("푸껫 센트럴 빠통에서 꼭 가야 하는 매장 4 (feat. 직원 추천템)"):
//   m2m100-1.2b   -> "4 Things to Do in Punch Central (feat."   truncated + wrong
//   llama-3.1-8b  -> "Phuket Central Patong Must-visit stores…" correct
//   mistral-small -> "Must-Visit Stores at Phuket Central Patong (Feat. …)" best
// Mistral also honours the place-name glossary (Phuket -> ภูเก็ต) which m2m100
// mangles into invented transliterations. m2m100 stays as the fallback: it is
// cheap and fine on ru/ja/zh, so it covers us if the instruct model errors.
const MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const FALLBACK_MODEL = "@cf/meta/m2m100-1.2b";

async function fetchText(url, ms = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "user-agent": "PhuketDashboard/1.0 (+https://phuket.nonarkara.org)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Place names are the thing a general translator gets wrong most often, and they are
// exactly what a Phuket operator scans for. Pin them.
const GLOSSARY = "Phuket=ภูเก็ต, Patong=ป่าตอง, Kata=กะตะ, Karon=กะรน, Kamala=กมลา, Rawai=ราไวย์, Chalong=ฉลอง, Thalang=ถลาง, Kathu=กะทู้";
const TARGET_NAME = { en: "English", th: "Thai" };

function llmTranslateMessages(text, target) {
  return [
    {
      role: "system",
      content:
        `Translate the news headline into ${TARGET_NAME[target]}. ` +
        `Output ONLY the translation — no quotes, no notes, no romanisation, no source text. ` +
        `Translate the whole headline; never truncate. ` +
        `Add no fact that is not in the source: do not name a place, cause or outcome the source does not name. ` +
        `Never convert currencies, units or numbers — keep the original symbol and value. ` +
        `When, and only when, the headline refers to the Thai island or province, ` +
        `use these place names: ${GLOSSARY}. ` +
        `If a similar-sounding word is not that place (a brand, a film, a person), translate it normally.`,
    },
    { role: "user", content: text },
  ];
}

/** Instruct models like to add quotes, prefixes and stray commentary. Strip them. */
function cleanLlm(s) {
  if (!s) return "";
  let out = String(s).trim();
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  out = out.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
  out = out.replace(/^(translation|แปล|output)\s*[:：]\s*/i, "");
  out = out.replace(/^["'“”‘’「『]|["'“”‘’」』]$/g, "");
  return out.trim();
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Translate once, cache forever. Headlines are immutable, so a hit is always valid. */
async function translate(env, text, from, to, budget) {
  if (from === to) return { text, model: "source", cached: true, spent: 0 };
  const key = `${TR_PREFIX}${from}:${to}:${await sha256(text)}`;
  const hit = await env.PHUKET_KV.get(key, "json");
  if (hit) return { ...hit, cached: true, spent: 0 };
  if (budget.left <= 0) return null;
  budget.left -= 1;

  let out = "";
  let model = MODEL;
  try {
    const r = await env.AI.run(MODEL, {
      messages: llmTranslateMessages(text, to),
      max_tokens: 220,
      temperature: 0.1,
    });
    out = cleanLlm(r?.response);
  } catch { /* fall through */ }

  if (!out) {
    model = FALLBACK_MODEL;
    try {
      const r = await env.AI.run(FALLBACK_MODEL, { text, source_lang: from, target_lang: to });
      out = (r?.translated_text || "").trim();
    } catch { /* give up for this tick */ }
  }
  if (!out) return null;

  const rec = { text: out, model };
  await env.PHUKET_KV.put(key, JSON.stringify(rec)); // no TTL — a headline never restales
  return { ...rec, cached: false, spent: 1 };
}

async function collect() {
  const jobs = [
    ...LANG_FEEDS.map((f) => ({ url: bingNewsUrl(f), meta: { lang: f.lang, scoped: true } })),
    ...LOCAL_FEEDS.map((f) => ({
      url: f.url,
      meta: { lang: f.lang, source: f.source, trust: f.trust, scoped: false },
    })),
  ];
  const settled = await Promise.allSettled(
    jobs.map(async (j) => parseRss(await fetchText(j.url)).map((r) => toItem(r, j.meta)))
  );
  const items = [];
  const failed = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") items.push(...s.value.filter(Boolean));
    else failed.push({ url: jobs[i].url, lang: jobs[i].meta.lang, error: String(s.reason?.message ?? s.reason) });
  });
  return { items, failed };
}

function selectItems(items) {
  const ranked = rank(dedupe(items));
  // Alerts first, then a fair slice per language so one loud feed can't crowd out
  // the quiet ones — the point of this feature is the languages nobody else reads.
  const perLang = new Map();
  const chosen = [];
  for (const it of ranked) {
    const n = perLang.get(it.lang) ?? 0;
    if (n >= 12) continue;
    perLang.set(it.lang, n + 1);
    chosen.push(it);
  }
  return { chosen, counts: Object.fromEntries(perLang) };
}

/**
 * Enrich in place, bounded by both a call budget and a wall clock. Returns how many
 * fresh model calls were spent. Never throws — a translation problem must not cost
 * us the news.
 */
async function translateBatch(env, chosen, deadlineMs) {
  const budget = { left: TRANSLATE_BUDGET };
  let translated = 0;
  const CONCURRENCY = 6;
  for (let i = 0; i < chosen.length; i += CONCURRENCY) {
    if (Date.now() > deadlineMs || budget.left <= 0) break;
    await Promise.all(chosen.slice(i, i + CONCURRENCY).map(async (it) => {
      const used = new Set();
      // English for everything — it is the operator's working language and the
      // whole point of watching foreign coverage.
      if (!it.titleEn) {
        const r = await translate(env, it.title, it.lang, "en", budget);
        if (r) { it.titleEn = r.text; translated += r.spent; used.add(r.model); }
      }
      // Thai only for what an official has to act on. A 24B model on every stable
      // travel-listicle would burn the daily neuron budget for no operational gain;
      // alert/watch items are the ones that reach a desk.
      if (!it.titleTh && it.severity !== "stable") {
        const r = await translate(env, it.title, it.lang, "th", budget);
        if (r) { it.titleTh = r.text; translated += r.spent; used.add(r.model); }
      }
      if (used.size) {
        it.translation = { provider: [...used].join("+"), from: it.lang, at: new Date().toISOString() };
      } else if (it.titleEn || it.titleTh) {
        it.translation = { provider: "source", from: it.lang, at: new Date().toISOString() };
      }
    }));
  }
  return translated;
}

function payloadOf(chosen, counts, failed, translated) {
  return {
    generatedAt: new Date().toISOString(),
    items: chosen,
    counts,
    translatedThisRun: translated,
    // Items still waiting on a translator. They ship anyway, in their source
    // language, and get picked up on a later tick once the cache warms.
    awaitingTranslation: chosen.filter((i) => !i.titleEn).length,
    failedFeeds: failed,
    ok: chosen.length > 0,
  };
}

/**
 * Publish first, translate second.
 *
 * Translation is the slow, flaky, quota-bounded step; fetching is not. If they share
 * one write, a slow model means no news at all — which is the failure this whole
 * worker exists to prevent. So the fetched set is written as soon as it exists, then
 * the same set is re-written enriched. Worst case the dashboard shows real headlines
 * in their source language for a few minutes.
 */
async function runNews(env) {
  let payload;
  try {
    const { items, failed } = await collect();
    const { chosen, counts } = selectItems(items);

    if (chosen.length) {
      await env.PHUKET_KV.put(NEWS_KEY, JSON.stringify(payloadOf(chosen, counts, failed, 0)));
    }

    const translated = await translateBatch(env, chosen, Date.now() + TRANSLATE_DEADLINE_MS);
    payload = payloadOf(chosen, counts, failed, translated);
  } catch (e) {
    // waitUntil swallows throws — record it or the run is invisible.
    await env.PHUKET_KV.put("news:lastrun", JSON.stringify({
      at: new Date().toISOString(), ok: false, crashed: String(e?.stack ?? e?.message ?? e).slice(0, 800),
    }));
    throw e;
  }
  // Always record the attempt, even a failed one — otherwise a run that produces
  // nothing is indistinguishable from a run that never happened.
  await env.PHUKET_KV.put("news:lastrun", JSON.stringify({
    at: payload.generatedAt,
    ok: payload.ok,
    items: payload.items.length,
    counts: payload.counts,
    translated: payload.translatedThisRun,
    awaitingTranslation: payload.awaitingTranslation,
    failedFeeds: payload.failedFeeds,
  }));
  if (!payload.ok) return payload; // never overwrite last-known-good with nothing
  await env.PHUKET_KV.put(NEWS_KEY, JSON.stringify(payload));
  return payload;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runNews(env));
  },

  // Manual trigger + health probe. Handy for `curl .../run?job=news` after a deploy.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
      "cache-control": "no-store", // else the edge serves a stale run result
    };
    if (url.pathname === "/run" && url.searchParams.get("job") === "news") {
      // A full run outlives the request budget — hand it to waitUntil and let the
      // caller poll `/`. Same path the cron takes.
      ctx.waitUntil(runNews(env));
      return new Response(JSON.stringify({ started: true, poll: "/" }, null, 2), { status: 202, headers: cors });
    }
    const raw = await env.PHUKET_KV.get(NEWS_KEY);
    if (url.pathname === "/news") {
      return new Response(raw ?? '{"ok":false,"items":[]}', { headers: cors });
    }
    const p = raw ? JSON.parse(raw) : null;
    const lastRun = await env.PHUKET_KV.get("news:lastrun", "json");
    return new Response(JSON.stringify({
      served: {
        ok: Boolean(p),
        generatedAt: p?.generatedAt ?? null,
        items: p?.items?.length ?? 0,
        counts: p?.counts ?? {},
      },
      lastRun,
    }, null, 2), { headers: cors });
  },
};

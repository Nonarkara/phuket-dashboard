/**
 * Multilingual Phuket news.
 *
 * This route does no fetching, no parsing and no translating. All of that runs on a
 * cron in workers/ingest, which writes a finished payload to KV. Here we only read
 * it, so a slow feed or a busy translation model can never delay a page load.
 *
 * The previous version of this file fetched its feeds inline and faked the Thai and
 * Chinese output with regex keyword tables (translateToTh / translateToZh) that
 * rewrote an English headline as "{zone}: {topic}" and labelled it a translation.
 * Nothing here synthesises a headline: every item carries its real source text plus
 * a translation record naming the model that produced it.
 */
import { NextResponse } from "next/server";
import { cached, invalidateCache } from "../../../../lib/cache";
import type { MultilingualNewsResponse } from "../../../../types/news";

export const dynamic = "force-dynamic";

const INGEST_NEWS_URL = "https://phuket-ingest.drnon.workers.dev/news";
const NEWS_CACHE_KEY = "news-multilingual";
// The cron republishes every 15 min; 60s keeps this cheap without going stale.
const NEWS_CACHE_TTL_SECONDS = 60;

const EMPTY: MultilingualNewsResponse = {
  generatedAt: new Date(0).toISOString(),
  items: [],
  counts: {},
  awaitingTranslation: 0,
  failedFeeds: [],
  ageSeconds: null,
  source: "unavailable",
  ok: false,
};

type Partial_ = Partial<MultilingualNewsResponse>;

/** Only the one method we call — cheaper than depending on @cloudflare/workers-types. */
type KvReader = { get(key: string, type: "json"): Promise<unknown> };

/**
 * In the Cloudflare runtime, read the KV namespace the ingest worker writes to.
 *
 * The obvious alternative — fetching the ingest worker's public URL — does NOT work
 * here: Cloudflare rejects Worker-to-Worker requests on the same zone with error
 * 1042. Reading the shared namespace also removes a network hop. Returns null when
 * there is no CF context (next dev, static export) so the caller can fall back.
 */
async function readFromKv(): Promise<{ data: Partial_ | null; note: string }> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    // The async form is the one that works from a route handler; the sync form
    // throws when the context has not been initialised for this execution path.
    const ctx = await getCloudflareContext({ async: true });
    const kv = (ctx.env as unknown as Record<string, unknown>).PHUKET_KV as KvReader | undefined;
    if (!kv) return { data: null, note: "no-binding" };
    const data = (await kv.get("news:latest", "json")) as Partial_ | null;
    return { data, note: data ? "kv" : "kv-empty" };
  } catch (e) {
    return { data: null, note: `kv-error:${String((e as Error)?.message ?? e).slice(0, 60)}` };
  }
}

/** Dev and any non-Worker runtime: the ingest worker's public endpoint. */
async function readFromUrl(): Promise<Partial_> {
  const res = await fetch(INGEST_NEWS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ingest ${res.status}`);
  return (await res.json()) as Partial_;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("fresh") === "1") {
    invalidateCache(NEWS_CACHE_KEY);
  }

  const response = await cached<MultilingualNewsResponse>(
    NEWS_CACHE_KEY,
    NEWS_CACHE_TTL_SECONDS,
    async () => {
      const kv = await readFromKv();
      const data = kv.data ?? (await readFromUrl());
      const items = Array.isArray(data.items) ? data.items : [];
      const generatedAt = data.generatedAt ?? EMPTY.generatedAt;
      const ts = Date.parse(generatedAt);
      return {
        generatedAt,
        items,
        counts: data.counts ?? {},
        awaitingTranslation: data.awaitingTranslation ?? 0,
        failedFeeds: data.failedFeeds ?? [],
        // Surfaced so the UI can state the feed's age rather than imply "now".
        ageSeconds: Number.isFinite(ts) ? Math.max(0, Math.round((Date.now() - ts) / 1000)) : null,
        // Which path served this: "kv" in the Cloudflare runtime, "url" elsewhere.
        // Kept in the payload so a silent fallback is visible instead of guessed at.
        source: kv.note,
        ok: items.length > 0,
      };
    },
  ).catch(() => EMPTY);

  return NextResponse.json(response);
}

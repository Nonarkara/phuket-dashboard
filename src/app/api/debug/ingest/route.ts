import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), ".cursor");
const LOG_PATH = join(LOG_DIR, "debug-939707.log");

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const line = JSON.stringify({
      sessionId: "939707",
      ...payload,
      timestamp: Date.now(),
    });

    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, line + "\n", "utf8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 200 },
    );
  }
}


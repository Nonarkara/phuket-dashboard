import { NextResponse } from "next/server";

const CACHE_TTL = 900; // 15 minutes

export const revalidate = 900;

async function getLiveVideoId(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/${handle}/streams`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: CACHE_TTL },
    });
    
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Split into videoRenderer blocks to isolate properties per video
    const blocks = html.split('"videoRenderer":');
    blocks.shift(); // remove everything before the first video

    let foundId: string | null = null;

    // First pass: Look for an actively live video (contains "watching")
    for (const block of blocks) {
      if (block.includes('"viewCountText"') && block.includes('watching"')) {
        const match = block.match(/"videoId":"([^"]{11})"/);
        if (match) {
          foundId = match[1];
          break;
        }
      }
    }

    // Fallback: Just grab the first video ID if no active live stream is explicitly found
    if (!foundId && blocks.length > 0) {
      const match = blocks[0].match(/"videoId":"([^"]{11})"/);
      if (match) {
        foundId = match[1];
      }
    }
    
    return foundId;
  } catch (error) {
    console.error(`Failed to fetch live ID for ${handle}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  const videoId = await getLiveVideoId(handle);

  if (!videoId) {
    return NextResponse.json({ error: "No live stream found" }, { status: 404 });
  }

  return NextResponse.json({ videoId });
}

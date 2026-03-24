"use client";

import { useState, useEffect } from "react";

const WAR_ROOM_BREAKPOINT = 3000;

/**
 * Returns true when viewport width >= 3000px (74-inch 4K LED screen).
 * Used for:
 * - Lucide icon size props (numeric, can't use Tailwind)
 * - Array .slice() limits (show more items at 4K)
 * - Conditional layout changes (dual-column news, split-view map)
 */
export function useWarRoomScale(): boolean {
  const [is4K, setIs4K] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WAR_ROOM_BREAKPOINT}px)`);
    setIs4K(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIs4K(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return is4K;
}

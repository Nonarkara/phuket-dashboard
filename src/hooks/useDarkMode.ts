"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "phuket-dark-mode";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsDark(stored === "true");
    } else {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-surface='phuket-dashboard']");
    if (!el) return;
    el.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return [isDark, toggle] as const;
}

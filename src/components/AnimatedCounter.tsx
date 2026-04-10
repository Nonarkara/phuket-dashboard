"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

export default function AnimatedCounter({ value, className = "" }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const numericMatch = value.match(/^(\d+)/);
    if (!numericMatch) {
      setDisplay(value);
      return;
    }

    const target = parseInt(numericMatch[1], 10);
    const suffix = value.slice(numericMatch[1].length);
    const duration = 800;
    const start = performance.now();

    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setDisplay(`${current}${suffix}`);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    setDisplay(`0${suffix}`);
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);

  return (
    <span ref={ref} className={className} aria-live="polite">
      {display}
    </span>
  );
}

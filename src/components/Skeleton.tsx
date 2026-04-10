"use client";

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width, height = "12px", className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, minHeight: height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRow({ count = 3, gap = "8px" }: { count?: number; gap?: string }) {
  return (
    <div className="flex" style={{ gap }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height="28px" className="flex-1" />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="border border-[var(--line)] p-3 space-y-3" aria-hidden="true">
      <Skeleton width="40%" height="10px" />
      <Skeleton width="60%" height="20px" />
      <Skeleton width="100%" height="10px" />
    </div>
  );
}

export function SkeletonOpsPanel() {
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3" aria-hidden="true">
      <Skeleton width="50%" height="10px" />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="flex h-full items-end gap-1 p-4" aria-hidden="true">
      {[40, 65, 35, 80, 55, 70, 45, 60].map((h, i) => (
        <Skeleton key={i} className="flex-1" height={`${h}%`} />
      ))}
    </div>
  );
}

export function SkeletonStrip() {
  return (
    <div className="flex items-center gap-3 px-3 py-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} width="80px" height="22px" />
      ))}
    </div>
  );
}

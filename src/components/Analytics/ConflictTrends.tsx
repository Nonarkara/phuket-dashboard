"use client";
import { apiUrl } from "../../lib/asset-path";

import React from "react";
import { RefreshCw } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { SkeletonChart } from "../Skeleton";
import type { ConflictTrendsResponse } from "../../types/dashboard";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function ConflictTrends() {
  const [data, setData] = React.useState<ConflictTrendsResponse | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(
    () =>
      fetch(apiUrl("/api/conflict-trends"))
        .then((res) => res.json())
        .then(setData)
        .catch(() => setData(null)),
    [],
  );

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().then(() => setTimeout(() => setRefreshing(false), 600));
  };

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center"><SkeletonChart /></div>
    );
  }

  const totalCurrent = data.provincialData.current.reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalBaseline = data.provincialData.yoy.reduce(
    (sum, value) => sum + value,
    0,
  );
  const latestFatalityValue =
    data.fatalities.data[data.fatalities.data.length - 1] ?? 0;

  const provincialData = {
    labels: data.provincialData.labels,
    datasets: [
      {
        label: "Current",
        data: data.provincialData.current,
        backgroundColor: "#38bdf8",
        borderColor: "#38bdf8",
        borderWidth: 0,
        barThickness: 8,
      },
      {
        label: "Baseline",
        data: data.provincialData.yoy,
        backgroundColor: "#1e293b",
        borderColor: "#1e293b",
        borderWidth: 0,
        barThickness: 8,
      },
    ],
  };

  const fatalitiesTrend = {
    labels: data.fatalities.labels,
    datasets: [
      {
        fill: false,
        label: "Fatalities",
        data: data.fatalities.data,
        borderColor: "#f59e0b",
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: "easeOutQuart" as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f1628",
        borderColor: "#d4d0c8",
        borderWidth: 1,
        titleFont: { size: 9, weight: 700 as const },
        bodyFont: { size: 9 },
        titleColor: "#111827",
        bodyColor: "#94a3b8",
        padding: 8,
        cornerRadius: 6,
        displayColors: false,
      },
    },
    scales: {
      y: {
        grid: { color: "#d4d0c8", drawBorder: false },
        ticks: { color: "#475569", font: { size: 8, family: "IBM Plex Mono" } },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#475569", font: { size: 8, family: "IBM Plex Mono" } },
      },
    },
  };

  return (
    <section className="grid h-full grid-cols-1 bg-[var(--bg-surface)] select-none lg:grid-cols-2">
      <div className="flex flex-col border-b border-[var(--line)] p-4 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow">By province</div>
            <button type="button" onClick={handleRefresh} className="text-[var(--dim)] hover:text-[var(--cool)] transition-colors" title="Refresh local trend data">
              <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
            <div className="pt-1 text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)]">
              Road safety
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Cur / base
            </div>
            <div className="pt-0.5 text-[13px] font-mono font-bold tabular-nums text-[var(--ink)]">
              {totalCurrent} / {totalBaseline}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <Bar options={options} data={provincialData} />
        </div>
        <div className="mt-1 text-[7px] font-mono tracking-[0.1em] text-[var(--dim)]">
          Source: local incident cache · Refreshes every 5 min
        </div>
      </div>

      <div className="flex flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Weather cycle</div>
            <div className="pt-1 text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)]">
              Rain burden
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
              Latest
            </div>
            <div className="pt-0.5 text-[13px] font-mono font-bold tabular-nums text-[#f59e0b]">
              {latestFatalityValue}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <Line options={options} data={fatalitiesTrend} />
        </div>
        <div className="mt-1 text-[7px] font-mono tracking-[0.1em] text-[var(--dim)]">
          Source: weekly pressure proxy · 5-min polling
        </div>
      </div>
    </section>
  );
}

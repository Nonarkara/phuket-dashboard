import { ExternalLink, Globe, TrendingUp, X } from "lucide-react";
import type { ProvinceSelection } from "../../types/dashboard";

interface ProvinceDashboardProps {
    province: ProvinceSelection | null;
    onClose: () => void;
}

export default function ProvinceDashboard({ province, onClose }: ProvinceDashboardProps) {
  if (!province) return null;

  const signalCount = province.fatalities ?? 0;
  const readinessIndex = Math.max(5.2, Number((8.9 - signalCount * 0.4).toFixed(1)));
  const weatherPressure = Math.min(92, 26 + signalCount * 12);
  const tourismPulse = province.iso ? 70 : Math.max(40, 82 - signalCount * 6);
  const tourismTone =
    tourismPulse >= 70 ? "Strong" : tourismPulse >= 50 ? "Mixed" : "Soft";
  const summaryLine =
    province.notes ?? `${province.name} selected from the Phuket regional monitoring surface.`;
  const attentionLevel =
    signalCount >= 2 ? "Immediate review" : signalCount >= 1 ? "Elevated attention" : "Routine monitoring";
  const guidance = [
    "Read this place against rainfall, AQI, and transport overlays before escalating.",
    "Use the economy and briefing cards to see whether pressure is localized or regional.",
    province.externalUrl
      ? "Use the live source link below when you need direct visual confirmation."
      : "Use the map overlays to cross-check what sits immediately around this point.",
    province.eventDate
      ? `Latest logged signal: ${province.eventDate}.`
      : `Use ${province.name} as a geographic anchor for adjacent Phuket-region signals.`,
  ];

  return (
    <div className="fixed inset-x-4 bottom-14 z-[60] mx-auto w-[min(920px,calc(100vw-2rem))] border border-[var(--line-bright)] bg-[rgba(250,248,242,0.94)] backdrop-blur-xl">
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.35fr)_120px_120px_180px_auto] lg:items-start">
        <div className="min-w-0">
          <div className="eyebrow">Selected place</div>
          <h2 className="pt-1 text-[22px] font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {province.name}
          </h2>
          <p className="pt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--dim)]">
            {province.type ?? `Sector: ${province.iso ?? "Regional"}`}
          </p>
          {province.location ? (
            <p className="pt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-[var(--dim)]">
              {province.location}
            </p>
          ) : null}
          <p className="pt-3 text-[12px] leading-5 text-[var(--muted)]">{summaryLine}</p>
        </div>

        <div>
          <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
            Readiness
          </div>
          <div className="pt-1 font-mono text-[28px] font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {readinessIndex}
          </div>
          <div className="text-[9px] text-[var(--dim)]">out of 10</div>
        </div>

        <div>
          <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
            Signals
          </div>
          <div
            className={`flex items-center gap-1 pt-1 font-mono text-[28px] font-semibold tracking-[-0.04em] ${
              signalCount > 0 ? "text-[#f59e0b]" : "text-[var(--cool)]"
            }`}
          >
            {signalCount}
            <TrendingUp size={12} />
          </div>
          <div className="text-[9px] text-[var(--dim)]">{attentionLevel}</div>
        </div>

        <div className="space-y-3 lg:border-l lg:border-[var(--line)] lg:pl-4">
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <span>Weather pressure</span>
              <span>{signalCount > 0 ? "Elevated" : "Seasonal"}</span>
            </div>
            <div className="mt-1.5 h-[2px] w-full overflow-hidden bg-[var(--line)]">
              <div className="h-full bg-[#f59e0b]" style={{ width: `${weatherPressure}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-[var(--dim)]">
              <span>Tourism pulse</span>
              <span className="text-[var(--cool)]">{tourismTone}</span>
            </div>
            <div className="mt-1.5 h-[2px] w-full overflow-hidden bg-[var(--line)]">
              <div className="h-full bg-[var(--cool)]" style={{ width: `${tourismPulse}%` }} />
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--line-bright)] hover:text-[var(--ink)]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid gap-3 border-t border-[var(--line)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-2 md:grid-cols-4">
          {guidance.map((item) => (
            <div
              key={item}
              className="border border-[var(--line)] px-3 py-2 text-[10px] leading-4 text-[var(--muted)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border border-[var(--line)] px-3 py-2">
          <div className="flex items-center gap-2">
            <Globe size={12} className="text-[var(--cool)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--dim)]">
              {province.source
                ? `Source ${province.source}`
                : province.eventDate
                  ? `Event ${province.eventDate}`
                  : `Sector ${province.iso ?? province.name}`}
            </span>
          </div>
          {province.externalUrl ? (
            <a
              href={province.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-[var(--line-bright)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition-colors hover:border-[var(--cool)] hover:text-[var(--cool)]"
            >
              <ExternalLink size={11} />
              Open Source
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

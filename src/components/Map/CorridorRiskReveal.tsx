import type { Blackspot } from "../../data/phuket-blackspots";
import { PHUKET_DISTRICTS, PHUKET_BY_VEHICLE } from "../../data/phuket-road-safety";

interface ForecastPeak {
  hour: number;
  risk: number;
  rainMm: number;
}

interface Props {
  blackspot: Blackspot | null;
  peak: ForecastPeak | null;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  "steep-descent": "Steep descent",
  curve: "Curve",
  junction: "Junction",
  roundabout: "Roundabout",
  straight: "Open straight",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The Slope Story — the signature analytical moment.
 *
 * When a blackspot is selected the camera flies to it on the 3D slope and this
 * card states the chain plainly (the Four Noble Truths as a brief): the slope →
 * the toll → tonight's rain-risk → why → the action. It fuses terrain (SRTM),
 * crash data (THAIRSC) and the forecast (TimesFM) into one legible insight.
 */
export default function CorridorRiskReveal({ blackspot, peak, onClose }: Props) {
  if (!blackspot) return null;

  const accent = blackspot.severity === "high" ? "#ef4444" : "#f59e0b";
  const district = PHUKET_DISTRICTS.find((d) => d.corridor === blackspot.corridor);
  const corridorDeaths = district?.deaths;
  const steep = blackspot.slopeDeg >= 10;
  const peakLabel = peak ? `${pad2(peak.hour)}:00` : "this evening";

  const why = steep
    ? `A ${blackspot.slopeDeg}° descent — among the steepest roads on the island. In rain, two-wheel braking distance collapses on the grade.`
    : `${KIND_LABEL[blackspot.kind] ?? "Conflict"} point on the ${blackspot.corridor} corridor, which carries the island's heaviest motorcycle mix.`;

  const action = steep
    ? `Wet-surface warning + speed enforcement on the descent. Pre-position patrol from ${peakLabel}.`
    : `Signal & signage audit; visible patrol from ${peakLabel}.`;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-3 border-t border-[rgba(15,23,42,0.12)] py-1.5 first:border-t-0">
      <div className="w-[64px] shrink-0 pt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">
        {label}
      </div>
      <div className="min-w-0 flex-1 text-[11px] leading-4 text-[var(--ink)]">{children}</div>
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:justify-start sm:px-4 sm:pb-4">
      <section
        role="dialog"
        aria-label={`Corridor risk: ${blackspot.name}`}
        className="pointer-events-auto w-[min(380px,calc(100%-1.5rem))] border border-[rgba(15,23,42,0.18)] bg-[rgba(241,237,226,0.94)] backdrop-blur-md"
        style={{
          color: "#0d1117",
          ["--ink" as never]: "#0d1117",
          ["--dim" as never]: "#475569",
          ["--muted" as never]: "#1e293b",
          borderLeft: `3px solid ${accent}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ backgroundColor: accent }} aria-hidden="true" />
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">
                Corridor risk
              </span>
            </div>
            <h3 className="mt-1 truncate text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">
              {blackspot.name}
            </h3>
            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--dim)]">
              {KIND_LABEL[blackspot.kind] ?? blackspot.kind} · {blackspot.corridor} corridor
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close corridor risk"
            className="shrink-0 border border-[rgba(15,23,42,0.2)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--dim)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>

        {/* Chain */}
        <div className="mt-2 px-4 pb-3">
          <Row label="The slope">
            <span className="font-mono font-bold" style={{ color: accent }}>
              {blackspot.slopeDeg}°
            </span>{" "}
            · {blackspot.slopePct}% grade · {blackspot.elevationM} m elevation
          </Row>
          <Row label="The toll">
            {corridorDeaths != null ? (
              <>
                <span className="font-mono font-bold text-[var(--ink)]">{corridorDeaths}</span> deaths
                · {PHUKET_BY_VEHICLE.motorcycle}% motorcycle · {blackspot.district}
              </>
            ) : (
              <>{blackspot.district} · {PHUKET_BY_VEHICLE.motorcycle}% motorcycle</>
            )}
          </Row>
          <Row label="Tonight">
            {peak ? (
              <>
                Peak{" "}
                <span className="font-mono font-bold" style={{ color: accent }}>
                  {pad2(peak.hour)}:00
                </span>{" "}
                · {peak.rainMm}mm rain · risk{" "}
                <span className="font-mono font-bold">{peak.risk}/100</span>
              </>
            ) : (
              <span className="text-[var(--dim)]">forecast loading…</span>
            )}
          </Row>
          <Row label="Why">{why}</Row>
          <Row label="Act">{action}</Row>

          <div className="mt-2 text-[7px] uppercase tracking-[0.16em] text-[var(--dim)]">
            SRTM 30 m · THAIRSC · TimesFM
          </div>
        </div>
      </section>
    </div>
  );
}

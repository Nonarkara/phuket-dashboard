import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const BG = "#0d1117";
const INK = "#e6edf3";
const DIM = "#7d8590";
const COOL = "#58a6ff";
const FIRE = "#f87171";
const WIN = "#4ade80";
const RISK = "#fbbf24";
const LINE = "#30363d";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: INK,
          fontFamily: '"Helvetica","Arial",sans-serif',
          padding: "48px 56px",
          gap: 28,
        }}
      >
        {/* Header strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: `1px solid ${LINE}`,
            paddingBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 14,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: DIM,
              fontWeight: 700,
            }}
          >
            <span style={{ color: INK }}>PHUKET DASHBOARD</span>
            <span>·</span>
            <span>v7</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              fontSize: 14,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: DIM,
              fontWeight: 700,
            }}
          >
            <span style={{ color: COOL }}>● LIVE</span>
            <span>HKT</span>
          </div>
        </div>

        {/* Hero title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: DIM,
              fontWeight: 700,
            }}
          >
            Governor&apos;s desk
          </div>
          <div
            style={{
              fontSize: 80,
              lineHeight: 0.96,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              color: INK,
            }}
          >
            Daily brief
          </div>
        </div>

        {/* 4-tile grid: fires / wins / risk / reality */}
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 4,
          }}
        >
          {[
            { label: "Today's fires", value: "03", color: FIRE },
            { label: "Wins ready", value: "03", color: WIN },
            { label: "Tomorrow's risk", value: "01", color: RISK },
            { label: "Reality checks", value: "03", color: COOL },
          ].map((tile) => (
            <div
              key={tile.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                border: `1px solid ${LINE}`,
                padding: "20px 22px",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: DIM,
                  fontWeight: 700,
                }}
              >
                {tile.label}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 64,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  fontWeight: 700,
                  fontFamily:
                    '"IBM Plex Mono","SFMono-Regular","Menlo",monospace',
                  color: tile.color,
                }}
              >
                {tile.value}
              </div>
            </div>
          ))}
        </div>

        {/* Footer strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${LINE}`,
            paddingTop: 18,
            marginTop: "auto",
            fontSize: 14,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: DIM,
            fontWeight: 700,
          }}
        >
          <span>
            <span style={{ color: INK }}>News</span>
            <span style={{ color: LINE }}> · </span>
            <span style={{ color: INK }}>Maritime</span>
            <span style={{ color: LINE }}> · </span>
            <span style={{ color: INK }}>Weather</span>
            <span style={{ color: LINE }}> · </span>
            <span style={{ color: INK }}>Transit</span>
            <span style={{ color: LINE }}> · </span>
            <span style={{ color: INK }}>Tourism</span>
          </span>
          <span style={{ color: COOL }}>phuket-dashboard.nonarkara.org</span>
        </div>
      </div>
    ),
    size,
  );
}

import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background:
            "linear-gradient(135deg, #0b1422 0%, #13364a 55%, #efe7d7 120%)",
          color: "white",
          fontFamily:
            '"Iowan Old Style","Palatino Linotype","Times New Roman",serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(255,223,166,0.38), transparent 32%), radial-gradient(circle at bottom right, rgba(120,221,211,0.25), transparent 30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "56px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: '"Avenir Next","Segoe UI",sans-serif',
              fontSize: 20,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            Phuket Dashboard
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 36 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
              <div style={{ fontSize: 78, lineHeight: 0.94, letterSpacing: "-0.08em" }}>
                Policy without product is theater.
              </div>
              <div
                style={{
                  marginTop: 24,
                  fontFamily: '"Avenir Next","Segoe UI",sans-serif',
                  fontSize: 26,
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,0.76)",
                }}
              >
                Curated showcase first. Live operational war room underneath.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                alignSelf: "flex-end",
                minWidth: 260,
              }}
            >
              {[
                "6 coastal corridors",
                "3 modeled stress tests",
                "4 decision lenses",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    border: "1px solid rgba(255,255,255,0.18)",
                    padding: "16px 18px",
                    fontFamily: '"Avenir Next","Segoe UI",sans-serif',
                    fontSize: 22,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

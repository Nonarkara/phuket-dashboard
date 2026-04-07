import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f6f88, #0d5a6e)",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            border: "6px solid rgba(255,255,255,0.88)",
          }}
        />
      </div>
    ),
    size,
  );
}

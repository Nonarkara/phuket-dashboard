import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f6f88",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            border: "2.5px solid rgba(255,255,255,0.92)",
          }}
        />
      </div>
    ),
    size,
  );
}

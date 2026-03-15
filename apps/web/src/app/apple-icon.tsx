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
          background: "hsl(0, 0%, 45%)",
          borderRadius: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 80, height: 8, background: "white", borderRadius: 4 }} />
          <div style={{ width: 64, height: 8, background: "white", borderRadius: 4 }} />
          <div style={{ width: 48, height: 8, background: "white", borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}

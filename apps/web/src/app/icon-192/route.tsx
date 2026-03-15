import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(238, 84%, 67%)",
          borderRadius: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 13,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 85, height: 9, background: "white", borderRadius: 4 }} />
          <div style={{ width: 68, height: 9, background: "white", borderRadius: 4 }} />
          <div style={{ width: 51, height: 9, background: "white", borderRadius: 4 }} />
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}

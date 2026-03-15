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
          background: "hsl(0, 0%, 45%)",
          borderRadius: 68,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 34,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 227, height: 23, background: "white", borderRadius: 6 }} />
          <div style={{ width: 182, height: 23, background: "white", borderRadius: 6 }} />
          <div style={{ width: 136, height: 23, background: "white", borderRadius: 6 }} />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}

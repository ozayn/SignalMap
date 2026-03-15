import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(0, 0%, 45%)",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 16, height: 2, background: "white", borderRadius: 1 }} />
          <div style={{ width: 12, height: 2, background: "white", borderRadius: 1 }} />
          <div style={{ width: 8, height: 2, background: "white", borderRadius: 1 }} />
        </div>
      </div>
    ),
    { width: 32, height: 32 }
  );
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return response;
}

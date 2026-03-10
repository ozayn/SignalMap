import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/** Proxy to FastAPI YouTube channel refresh-analysis. POST with JSON body: { channel_id: string } */
export async function POST(request: NextRequest) {
  try {
    let body: { channel_id?: string };
    try {
      body = (await request.json()) as { channel_id?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { channel_id: string }" },
        { status: 422 }
      );
    }

    const channelId = body?.channel_id?.trim();
    if (!channelId) {
      return NextResponse.json(
        { error: "channel_id is required in request body" },
        { status: 422 }
      );
    }

    const res = await fetch(`${API_BASE}/api/youtube/channel/refresh-analysis`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel_id: channelId }),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const errMsg =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail) && data.detail.length > 0
            ? (data.detail[0] as { msg?: string })?.msg ?? String(data.detail[0])
            : `API returned ${res.status}`;
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

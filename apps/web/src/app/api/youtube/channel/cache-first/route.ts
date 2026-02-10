import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/** Thin proxy: forward handle, channel_id, force_live, limit to FastAPI YouTube channel cache-first. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const handle = searchParams.get("handle");
  const channelId = searchParams.get("channel_id");
  if ((!handle || !handle.trim()) && (!channelId || !channelId.trim())) {
    return NextResponse.json(
      { error: "Either handle or channel_id is required" },
      { status: 422 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (handle?.trim()) params.set("handle", handle.trim());
    if (channelId?.trim()) params.set("channel_id", channelId.trim());
    const forceLive = searchParams.get("force_live");
    if (forceLive != null) params.set("force_live", String(forceLive));
    const limit = searchParams.get("limit");
    if (limit != null) params.set("limit", limit);

    const res = await fetch(`${API_BASE}/api/youtube/channel/cache-first?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        data?.detail ? { error: data.detail, ...data } : { error: `API returned ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

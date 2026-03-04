import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/** Proxy to FastAPI YouTube comments sentiment (one video). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channel_id");
  const videoId = searchParams.get("video_id");
  if (!channelId?.trim() || !videoId?.trim()) {
    return NextResponse.json(
      { error: "channel_id and video_id are required" },
      { status: 422 }
    );
  }

  try {
    const params = new URLSearchParams({
      channel_id: channelId.trim(),
      video_id: videoId.trim(),
    });
    const includePolarities = searchParams.get("include_polarities");
    if (includePolarities != null) params.set("include_polarities", includePolarities);

    const res = await fetch(`${API_BASE}/api/youtube/comments/sentiment?${params}`, {
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

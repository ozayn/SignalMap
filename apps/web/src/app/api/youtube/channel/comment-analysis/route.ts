import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/** Proxy to FastAPI YouTube channel comment analysis. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channel_id");
  const identifier = searchParams.get("identifier");
  if ((!channelId || !channelId.trim()) && (!identifier || !identifier.trim())) {
    return NextResponse.json(
      { error: "Either channel_id or identifier is required" },
      { status: 422 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (channelId?.trim()) params.set("channel_id", channelId.trim());
    if (identifier?.trim()) params.set("identifier", identifier.trim());
    const videosLimit = searchParams.get("videos_limit");
    if (videosLimit != null) params.set("videos_limit", videosLimit);
    const commentsPerVideo = searchParams.get("comments_per_video");
    if (commentsPerVideo != null) params.set("comments_per_video", commentsPerVideo);

    const res = await fetch(`${API_BASE}/api/youtube/channel/comment-analysis?${params}`, {
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

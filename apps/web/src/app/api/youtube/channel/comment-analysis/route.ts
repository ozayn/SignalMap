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
    const refresh = searchParams.get("refresh");
    if (refresh === "1" || refresh === "true") params.set("refresh", "1");
    const recompute = searchParams.get("recompute");
    if (recompute === "1" || recompute === "true") params.set("recompute", "1");
    const recomputeWordcloud = searchParams.get("recompute_wordcloud");
    if (recomputeWordcloud === "1" || recomputeWordcloud === "true") params.set("recompute_wordcloud", "1");
    const adminCode = searchParams.get("admin_code");
    if (adminCode?.trim()) params.set("admin_code", adminCode.trim());

    const res = await fetch(`${API_BASE}/api/youtube/channel/comment-analysis?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
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
    const hint = !process.env.API_URL
      ? "Set API_URL on the web service. For local dev, ensure the API is running (pnpm dev in apps/api)."
      : "Backend unreachable. Check API_URL and that the API service is running.";
    return NextResponse.json(
      { error: msg, hint },
      { status: 502 }
    );
  }
}

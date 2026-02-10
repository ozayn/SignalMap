import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/** Thin proxy: forward query params to FastAPI YouTube comments wordcloud. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channelId = searchParams.get("channel_id");
  const windowStart = searchParams.get("window_start");
  const windowEnd = searchParams.get("window_end");
  if (!channelId?.trim() || !windowStart?.trim() || !windowEnd?.trim()) {
    return NextResponse.json(
      { error: "channel_id, window_start, and window_end are required" },
      { status: 422 }
    );
  }

  try {
    const params = new URLSearchParams({
      channel_id: channelId.trim(),
      window_start: windowStart.trim(),
      window_end: windowEnd.trim(),
    });
    const by = searchParams.get("by");
    if (by != null) params.set("by", by);
    const topN = searchParams.get("top_n");
    if (topN != null) params.set("top_n", topN);
    const channelTerms = searchParams.get("channel_terms");
    if (channelTerms != null) params.set("channel_terms", channelTerms);

    const res = await fetch(`${API_BASE}/api/youtube/comments/wordcloud?${params}`, {
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

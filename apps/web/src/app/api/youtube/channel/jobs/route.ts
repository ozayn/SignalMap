import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

/**
 * Thin proxy: forward query params (handle, channel_id, force_live, limit) to FastAPI.
 * No body required. Example: POST /api/youtube/channel/jobs?handle=googledevelopers
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const handle = searchParams.get("handle");
    const channelId = searchParams.get("channel_id");
    if ((!handle || !handle.trim()) && (!channelId || !channelId.trim())) {
      return NextResponse.json(
        { error: "Either handle or channel_id is required (query param)" },
        { status: 422 }
      );
    }

    const params = new URLSearchParams();
    if (handle?.trim()) params.set("handle", handle.trim());
    if (channelId?.trim()) params.set("channel_id", channelId.trim());
    const forceLive = searchParams.get("force_live");
    if (forceLive != null) params.set("force_live", forceLive);
    const limit = searchParams.get("limit");
    if (limit != null) params.set("limit", limit);

    const res = await fetch(`${API_BASE}/api/youtube/channel/jobs?${params}`, {
      method: "POST",
      headers: { Accept: "application/json" },
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const maxDuration = 120;

/** Thin proxy: forward normalized params (handle preferred; username/input deprecated) to FastAPI. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const handle = searchParams.get("handle") ?? searchParams.get("username") ?? searchParams.get("input");
  if (!handle?.trim()) {
    return NextResponse.json(
      { error: "One of handle, username, or input is required", detail: "Prefer 'handle'." },
      { status: 422 }
    );
  }

  try {
    const params = new URLSearchParams({ handle: handle.trim() });
    const forceLive = searchParams.get("force_live");
    if (forceLive !== null && forceLive !== undefined) params.set("force_live", String(forceLive));
    const limit = searchParams.get("limit");
    if (limit !== null && limit !== undefined) params.set("limit", limit);

    const res = await fetch(`${API_BASE}/api/wayback/youtube/cache-first?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        body?.detail ? { error: body.detail, ...body } : { error: `API returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

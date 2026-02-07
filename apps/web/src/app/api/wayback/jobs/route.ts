import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  const limit = searchParams.get("limit");

  try {
    const params = new URLSearchParams();
    if (username) params.set("username", username);
    if (limit) params.set("limit", limit);

    const res = await fetch(`${API_BASE}/api/wayback/jobs/list?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      // Normalize 500 to 503 so UI shows "Database not configured" instead of raw 500
      const status = res.status === 500 ? 503 : res.status;
      return NextResponse.json({ jobs: [] }, { status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

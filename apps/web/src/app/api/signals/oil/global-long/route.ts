import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end (YYYY-MM-DD) required" },
        { status: 400 }
      );
    }
    const res = await fetch(
      `${API_BASE}/api/signals/oil/global-long?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      let body: { error?: string } = { error: `API returned ${res.status}` };
      try {
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if (parsed?.detail) body = { error: parsed.detail };
      } catch {}
      return NextResponse.json(body, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

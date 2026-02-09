import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const input = searchParams.get("input");
  if (!input) {
    return NextResponse.json(
      { error: "input is required (e.g. @handle or full URL)" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({ input });
    const sample = searchParams.get("sample");
    if (sample) params.set("sample", sample);

    const res = await fetch(`${API_BASE}/api/wayback/youtube/cache-first?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
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

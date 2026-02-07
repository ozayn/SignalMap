import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, from_year, to_year, from_date, to_date, sample } = body;
    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const res = await fetch(`${API_BASE}/api/wayback/instagram/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        username,
        from_year: from_year ?? 2012,
        to_year: to_year ?? 2026,
        from_date: from_date ?? null,
        to_date: to_date ?? null,
        sample: sample ?? 24,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { detail?: string }).detail ?? `API returned ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

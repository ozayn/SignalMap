import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({ username });
    const from = searchParams.get("from_year");
    const to = searchParams.get("to_year");
    const sample = searchParams.get("sample");
    const includeEvidence = searchParams.get("include_evidence");
    const progress = searchParams.get("progress");
    if (from) params.set("from_year", from);
    if (to) params.set("to_year", to);
    if (sample) params.set("sample", sample);
    if (includeEvidence !== null) params.set("include_evidence", includeEvidence);
    if (progress !== null) params.set("progress", progress);

    const res = await fetch(`${API_BASE}/api/wayback/instagram?${params}`, {
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

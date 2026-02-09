import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "username is required (e.g. jack or @jack)" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({ username });
    const fromYear = searchParams.get("from_year");
    const toYear = searchParams.get("to_year");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const sample = searchParams.get("sample");
    if (fromYear) params.set("from_year", fromYear);
    if (toYear) params.set("to_year", toYear);
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    if (sample) params.set("sample", sample);

    const res = await fetch(`${API_BASE}/api/wayback/twitter?${params}`, {
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

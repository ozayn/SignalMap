import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startYear = searchParams.get("start_year") ?? "2018";
    const endYear = searchParams.get("end_year") ?? "2023";

    const url = new URL(`${API_BASE}/api/networks/oil-trade`);
    url.searchParams.set("start_year", startYear);
    url.searchParams.set("end_year", endYear);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      let body: { error?: string } = { error: `API returned ${res.status}` };
      try {
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if (parsed?.detail) body = { error: parsed.detail };
      } catch {
        // ignore
      }
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

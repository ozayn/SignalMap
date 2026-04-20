import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

const LEVELS_VALUE_TYPES = new Set(["real", "usd", "toman"]);

export async function GET(request: NextRequest) {
  try {
    const reqParams = request.nextUrl.searchParams;
    const start = reqParams.get("start");
    const end = reqParams.get("end");
    const country = reqParams.get("country") ?? "IRN";
    const rawType = (reqParams.get("levels_value_type") ?? "real").toLowerCase();
    const levelsValueType = LEVELS_VALUE_TYPES.has(rawType) ? rawType : "real";
    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end (YYYY-MM-DD) required" },
        { status: 400 }
      );
    }
    const params = new URLSearchParams({
      start,
      end,
      country,
      levels_value_type: levelsValueType,
    });
    const res = await fetch(`${API_BASE}/api/signals/macro/gdp-composition?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      let body: { error?: string } = { error: `API returned ${res.status}` };
      try {
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if (parsed?.detail) body = { error: String(parsed.detail) };
      } catch {
        /* ignore */
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

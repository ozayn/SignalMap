import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const studyId = searchParams.get("study_id") ?? "1";
    const anchorEventId = searchParams.get("anchor_event_id");
    const windowDays = searchParams.get("window_days");
    const url = new URL(`${API_BASE}/api/overview`);
    url.searchParams.set("study_id", studyId);
    if (anchorEventId) url.searchParams.set("anchor_event_id", anchorEventId);
    if (windowDays) url.searchParams.set("window_days", windowDays);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const hint =
      process.env.NODE_ENV === "production"
        ? !process.env.API_URL
          ? "Set API_URL in Railway: Web service → Variables → API_URL = https://${{api.RAILWAY_PUBLIC_DOMAIN}}"
          : "API unreachable. Check API_URL and that the API service is running."
        : undefined;
    return NextResponse.json({ error: msg, hint }, { status: 502 });
  }
}

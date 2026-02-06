import { NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/overview`, {
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

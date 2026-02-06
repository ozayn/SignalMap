import { NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export async function GET() {
  const hasApiUrl = !!process.env.API_URL;
  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
    });
    const ok = res.ok;
    const text = await res.text();
    return NextResponse.json({
      web: "ok",
      apiConfigured: hasApiUrl,
      apiReachable: ok,
      apiStatus: res.status,
      apiBody: ok ? text : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      web: "ok",
      apiConfigured: hasApiUrl,
      apiReachable: false,
      error: msg,
      hint: !hasApiUrl
        ? "Set API_URL on the web service"
        : "For private networking, include port: http://SERVICE.railway.internal:PORT. Or use public URL.",
    });
  }
}

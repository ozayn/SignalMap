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
    return NextResponse.json(
      {
        error: msg,
        hint:
          !process.env.API_URL &&
          process.env.NODE_ENV === "production"
            ? "Set API_URL on the web service in Railway"
            : undefined,
      },
      { status: 502 }
    );
  }
}

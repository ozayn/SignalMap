import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const revalidate = 3600;

type Edge = { source: string; target: string; value: number };

/** Curated fallback when backend returns 404 or is unreachable. */
const CURATED_FALLBACK: Record<string, Edge[]> = {
  "2018": [
    { source: "Saudi Arabia", target: "China", value: 1100 },
    { source: "Saudi Arabia", target: "India", value: 750 },
    { source: "Russia", target: "China", value: 500 },
    { source: "Russia", target: "EU", value: 1500 },
    { source: "United States", target: "EU", value: 450 },
    { source: "United States", target: "India", value: 120 },
    { source: "Iran", target: "China", value: 600 },
    { source: "UAE", target: "India", value: 650 },
  ],
  "2019": [
    { source: "Saudi Arabia", target: "China", value: 1200 },
    { source: "Russia", target: "EU", value: 1480 },
    { source: "United States", target: "EU", value: 520 },
    { source: "UAE", target: "India", value: 720 },
  ],
  "2020": [
    { source: "Russia", target: "EU", value: 1400 },
    { source: "United States", target: "EU", value: 700 },
    { source: "United States", target: "India", value: 280 },
  ],
  "2021": [
    { source: "Russia", target: "EU", value: 1350 },
    { source: "United States", target: "EU", value: 720 },
    { source: "United States", target: "India", value: 380 },
  ],
  "2022": [
    { source: "Russia", target: "India", value: 1600 },
    { source: "Russia", target: "EU", value: 200 },
    { source: "United States", target: "EU", value: 900 },
    { source: "United States", target: "India", value: 520 },
  ],
  "2023": [
    { source: "Russia", target: "India", value: 1600 },
    { source: "Russia", target: "EU", value: 250 },
    { source: "United States", target: "EU", value: 900 },
    { source: "United States", target: "India", value: 580 },
  ],
};

function getCuratedFallback(startYear: string, endYear: string): { years: Record<string, Edge[]> } {
  const s = parseInt(startYear, 10) || 2018;
  const e = parseInt(endYear, 10) || 2023;
  const years: Record<string, Edge[]> = {};
  for (let y = s; y <= e; y++) {
    const key = String(y);
    if (CURATED_FALLBACK[key]) years[key] = CURATED_FALLBACK[key];
  }
  return { years };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startYear = searchParams.get("start_year") ?? "2018";
  const endYear = searchParams.get("end_year") ?? "2023";

  try {
    const url = new URL(`${API_BASE}/api/networks/oil-trade`);
    url.searchParams.set("start_year", startYear);
    url.searchParams.set("end_year", endYear);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (res.status === 404 || !process.env.API_URL) {
      return NextResponse.json(getCuratedFallback(startYear, endYear));
    }

    let body: { error?: string } = { error: `API returned ${res.status}` };
    try {
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      if (parsed?.detail) body = { error: parsed.detail };
    } catch {
      // ignore
    }
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(getCuratedFallback(startYear, endYear));
  }
}

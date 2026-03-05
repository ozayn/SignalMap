import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const revalidate = 3600;

type Edge = { source: string; target: string; value: number };

/** Curated fallback when backend returns 404 or is unreachable. Matches backend 2010–2023. */
const CURATED_FALLBACK: Record<string, Edge[]> = {
  "2010": [
    { source: "Saudi Arabia", target: "China", value: 900 },
    { source: "Saudi Arabia", target: "Japan", value: 1100 },
    { source: "Saudi Arabia", target: "India", value: 550 },
    { source: "Saudi Arabia", target: "South Korea", value: 650 },
    { source: "Russia", target: "EU", value: 1400 },
    { source: "Russia", target: "China", value: 350 },
    { source: "Russia", target: "Japan", value: 180 },
    { source: "Iran", target: "China", value: 450 },
    { source: "Iran", target: "India", value: 380 },
    { source: "Iran", target: "Japan", value: 420 },
    { source: "Iran", target: "South Korea", value: 280 },
    { source: "Iran", target: "Turkey", value: 220 },
    { source: "Iran", target: "EU", value: 550 },
    { source: "Iraq", target: "China", value: 400 },
    { source: "Iraq", target: "India", value: 350 },
    { source: "UAE", target: "Japan", value: 380 },
    { source: "UAE", target: "India", value: 500 },
    { source: "United States", target: "EU", value: 120 },
    { source: "United States", target: "Canada", value: 80 },
  ],
  "2011": [
    { source: "Saudi Arabia", target: "China", value: 950 },
    { source: "Saudi Arabia", target: "Japan", value: 1080 },
    { source: "Saudi Arabia", target: "India", value: 600 },
    { source: "Saudi Arabia", target: "South Korea", value: 680 },
    { source: "Russia", target: "EU", value: 1450 },
    { source: "Russia", target: "China", value: 380 },
    { source: "Russia", target: "Japan", value: 200 },
    { source: "Iran", target: "China", value: 480 },
    { source: "Iran", target: "India", value: 400 },
    { source: "Iran", target: "Japan", value: 400 },
    { source: "Iran", target: "South Korea", value: 260 },
    { source: "Iran", target: "Turkey", value: 240 },
    { source: "Iran", target: "EU", value: 480 },
    { source: "Iraq", target: "China", value: 420 },
    { source: "Iraq", target: "India", value: 380 },
    { source: "UAE", target: "Japan", value: 400 },
    { source: "UAE", target: "India", value: 520 },
    { source: "United States", target: "EU", value: 150 },
    { source: "United States", target: "Canada", value: 100 },
  ],
  "2012": [
    { source: "Saudi Arabia", target: "China", value: 1000 },
    { source: "Saudi Arabia", target: "Japan", value: 1050 },
    { source: "Saudi Arabia", target: "India", value: 650 },
    { source: "Saudi Arabia", target: "South Korea", value: 700 },
    { source: "Russia", target: "EU", value: 1500 },
    { source: "Russia", target: "China", value: 420 },
    { source: "Russia", target: "Japan", value: 220 },
    { source: "Iran", target: "China", value: 520 },
    { source: "Iran", target: "India", value: 420 },
    { source: "Iran", target: "Turkey", value: 260 },
    { source: "Iran", target: "Japan", value: 180 },
    { source: "Iran", target: "South Korea", value: 120 },
    { source: "Iran", target: "EU", value: 120 },
    { source: "Iraq", target: "China", value: 480 },
    { source: "Iraq", target: "India", value: 420 },
    { source: "UAE", target: "Japan", value: 420 },
    { source: "UAE", target: "India", value: 580 },
    { source: "United States", target: "EU", value: 200 },
    { source: "United States", target: "Canada", value: 150 },
  ],
  "2013": [
    { source: "Saudi Arabia", target: "China", value: 1050 },
    { source: "Saudi Arabia", target: "Japan", value: 1020 },
    { source: "Saudi Arabia", target: "India", value: 700 },
    { source: "Saudi Arabia", target: "South Korea", value: 720 },
    { source: "Russia", target: "EU", value: 1520 },
    { source: "Russia", target: "China", value: 460 },
    { source: "Russia", target: "Japan", value: 240 },
    { source: "Iran", target: "China", value: 580 },
    { source: "Iran", target: "India", value: 450 },
    { source: "Iran", target: "Turkey", value: 280 },
    { source: "Iran", target: "Japan", value: 80 },
    { source: "Iran", target: "South Korea", value: 40 },
    { source: "Iran", target: "EU", value: 30 },
    { source: "Iraq", target: "China", value: 520 },
    { source: "Iraq", target: "India", value: 450 },
    { source: "UAE", target: "Japan", value: 440 },
    { source: "UAE", target: "India", value: 620 },
    { source: "United States", target: "EU", value: 280 },
    { source: "United States", target: "Canada", value: 220 },
  ],
  "2014": [
    { source: "Saudi Arabia", target: "China", value: 1080 },
    { source: "Saudi Arabia", target: "Japan", value: 1000 },
    { source: "Saudi Arabia", target: "India", value: 720 },
    { source: "Saudi Arabia", target: "South Korea", value: 750 },
    { source: "Russia", target: "EU", value: 1480 },
    { source: "Russia", target: "China", value: 500 },
    { source: "Russia", target: "Japan", value: 260 },
    { source: "Iran", target: "China", value: 620 },
    { source: "Iran", target: "India", value: 480 },
    { source: "Iran", target: "Turkey", value: 260 },
    { source: "Iraq", target: "China", value: 550 },
    { source: "Iraq", target: "India", value: 480 },
    { source: "UAE", target: "Japan", value: 450 },
    { source: "UAE", target: "India", value: 650 },
    { source: "United States", target: "EU", value: 380 },
    { source: "United States", target: "South Korea", value: 120 },
    { source: "United States", target: "Japan", value: 80 },
  ],
  "2015": [
    { source: "Saudi Arabia", target: "China", value: 1100 },
    { source: "Saudi Arabia", target: "Japan", value: 980 },
    { source: "Saudi Arabia", target: "India", value: 750 },
    { source: "Saudi Arabia", target: "South Korea", value: 780 },
    { source: "Russia", target: "EU", value: 1520 },
    { source: "Russia", target: "China", value: 520 },
    { source: "Russia", target: "Japan", value: 280 },
    { source: "Iran", target: "China", value: 650 },
    { source: "Iran", target: "India", value: 500 },
    { source: "Iran", target: "Turkey", value: 240 },
    { source: "Iraq", target: "China", value: 580 },
    { source: "Iraq", target: "India", value: 500 },
    { source: "UAE", target: "Japan", value: 460 },
    { source: "UAE", target: "India", value: 680 },
    { source: "United States", target: "EU", value: 420 },
    { source: "United States", target: "South Korea", value: 180 },
    { source: "United States", target: "Japan", value: 120 },
  ],
  "2016": [
    { source: "Saudi Arabia", target: "China", value: 1120 },
    { source: "Saudi Arabia", target: "Japan", value: 960 },
    { source: "Saudi Arabia", target: "India", value: 780 },
    { source: "Saudi Arabia", target: "South Korea", value: 800 },
    { source: "Russia", target: "EU", value: 1510 },
    { source: "Russia", target: "China", value: 480 },
    { source: "Russia", target: "Japan", value: 270 },
    { source: "Iran", target: "China", value: 620 },
    { source: "Iran", target: "India", value: 480 },
    { source: "Iran", target: "Turkey", value: 200 },
    { source: "Iraq", target: "China", value: 560 },
    { source: "Iraq", target: "India", value: 470 },
    { source: "UAE", target: "Japan", value: 430 },
    { source: "UAE", target: "India", value: 660 },
    { source: "United States", target: "EU", value: 400 },
    { source: "United States", target: "South Korea", value: 220 },
    { source: "United States", target: "Japan", value: 150 },
  ],
  "2017": [
    { source: "Saudi Arabia", target: "China", value: 1150 },
    { source: "Saudi Arabia", target: "Japan", value: 1000 },
    { source: "Saudi Arabia", target: "India", value: 760 },
    { source: "Saudi Arabia", target: "South Korea", value: 820 },
    { source: "Russia", target: "EU", value: 1520 },
    { source: "Russia", target: "China", value: 490 },
    { source: "Russia", target: "Japan", value: 260 },
    { source: "Iran", target: "China", value: 610 },
    { source: "Iran", target: "India", value: 460 },
    { source: "Iran", target: "Turkey", value: 180 },
    { source: "Iraq", target: "China", value: 560 },
    { source: "Iraq", target: "India", value: 475 },
    { source: "UAE", target: "Japan", value: 425 },
    { source: "UAE", target: "India", value: 655 },
    { source: "United States", target: "EU", value: 430 },
    { source: "United States", target: "South Korea", value: 240 },
    { source: "United States", target: "Japan", value: 165 },
  ],
  "2018": [
    { source: "Saudi Arabia", target: "China", value: 1100 },
    { source: "Saudi Arabia", target: "India", value: 750 },
    { source: "Saudi Arabia", target: "Japan", value: 1000 },
    { source: "Russia", target: "China", value: 500 },
    { source: "Russia", target: "India", value: 200 },
    { source: "Russia", target: "EU", value: 1500 },
    { source: "United States", target: "EU", value: 450 },
    { source: "United States", target: "South Korea", value: 250 },
    { source: "United States", target: "Japan", value: 180 },
    { source: "United States", target: "India", value: 120 },
    { source: "United States", target: "Singapore", value: 80 },
    { source: "Iran", target: "China", value: 600 },
    { source: "Iraq", target: "China", value: 550 },
    { source: "Iraq", target: "India", value: 480 },
    { source: "UAE", target: "Japan", value: 420 },
    { source: "UAE", target: "India", value: 650 },
    { source: "UAE", target: "China", value: 320 },
  ],
  "2019": [
    { source: "Saudi Arabia", target: "China", value: 1200 },
    { source: "Saudi Arabia", target: "India", value: 800 },
    { source: "Saudi Arabia", target: "Japan", value: 980 },
    { source: "Russia", target: "China", value: 550 },
    { source: "Russia", target: "India", value: 280 },
    { source: "Russia", target: "EU", value: 1480 },
    { source: "United States", target: "EU", value: 520 },
    { source: "United States", target: "South Korea", value: 300 },
    { source: "United States", target: "Japan", value: 220 },
    { source: "United States", target: "India", value: 180 },
    { source: "United States", target: "Singapore", value: 120 },
    { source: "Iran", target: "China", value: 480 },
    { source: "Iraq", target: "China", value: 620 },
    { source: "Iraq", target: "India", value: 500 },
    { source: "UAE", target: "Japan", value: 460 },
    { source: "UAE", target: "India", value: 720 },
    { source: "UAE", target: "China", value: 350 },
  ],
  "2020": [
    { source: "Saudi Arabia", target: "China", value: 1300 },
    { source: "Saudi Arabia", target: "India", value: 680 },
    { source: "Saudi Arabia", target: "Japan", value: 920 },
    { source: "Russia", target: "China", value: 750 },
    { source: "Russia", target: "India", value: 420 },
    { source: "Russia", target: "EU", value: 1400 },
    { source: "United States", target: "EU", value: 700 },
    { source: "United States", target: "South Korea", value: 400 },
    { source: "United States", target: "Japan", value: 300 },
    { source: "United States", target: "India", value: 280 },
    { source: "United States", target: "Singapore", value: 200 },
    { source: "Iran", target: "China", value: 520 },
    { source: "Iraq", target: "China", value: 680 },
    { source: "Iraq", target: "India", value: 460 },
    { source: "UAE", target: "Japan", value: 400 },
    { source: "UAE", target: "India", value: 600 },
    { source: "UAE", target: "China", value: 380 },
  ],
  "2021": [
    { source: "Saudi Arabia", target: "China", value: 1400 },
    { source: "Saudi Arabia", target: "India", value: 780 },
    { source: "Saudi Arabia", target: "Japan", value: 950 },
    { source: "Russia", target: "China", value: 900 },
    { source: "Russia", target: "India", value: 550 },
    { source: "Russia", target: "EU", value: 1350 },
    { source: "United States", target: "EU", value: 720 },
    { source: "United States", target: "South Korea", value: 440 },
    { source: "United States", target: "Japan", value: 340 },
    { source: "United States", target: "India", value: 380 },
    { source: "United States", target: "Singapore", value: 280 },
    { source: "Iran", target: "China", value: 580 },
    { source: "Iraq", target: "China", value: 720 },
    { source: "Iraq", target: "India", value: 520 },
    { source: "UAE", target: "Japan", value: 430 },
    { source: "UAE", target: "India", value: 780 },
    { source: "UAE", target: "China", value: 360 },
  ],
  "2022": [
    { source: "Saudi Arabia", target: "China", value: 1550 },
    { source: "Saudi Arabia", target: "India", value: 920 },
    { source: "Saudi Arabia", target: "Japan", value: 1000 },
    { source: "Russia", target: "China", value: 1200 },
    { source: "Russia", target: "India", value: 1600 },
    { source: "Russia", target: "EU", value: 200 },
    { source: "United States", target: "EU", value: 900 },
    { source: "United States", target: "South Korea", value: 500 },
    { source: "United States", target: "Japan", value: 380 },
    { source: "United States", target: "India", value: 520 },
    { source: "United States", target: "Singapore", value: 350 },
    { source: "Iran", target: "China", value: 640 },
    { source: "Iraq", target: "China", value: 780 },
    { source: "Iraq", target: "India", value: 580 },
    { source: "UAE", target: "Japan", value: 480 },
    { source: "UAE", target: "India", value: 850 },
    { source: "UAE", target: "China", value: 400 },
  ],
  "2023": [
    { source: "Saudi Arabia", target: "China", value: 1650 },
    { source: "Saudi Arabia", target: "India", value: 880 },
    { source: "Saudi Arabia", target: "Japan", value: 580 },
    { source: "Russia", target: "China", value: 1200 },
    { source: "Russia", target: "India", value: 1600 },
    { source: "Russia", target: "EU", value: 250 },
    { source: "United States", target: "EU", value: 900 },
    { source: "United States", target: "South Korea", value: 480 },
    { source: "United States", target: "Japan", value: 360 },
    { source: "United States", target: "India", value: 580 },
    { source: "United States", target: "Singapore", value: 400 },
    { source: "Iran", target: "China", value: 680 },
    { source: "Iraq", target: "China", value: 760 },
    { source: "Iraq", target: "India", value: 560 },
    { source: "UAE", target: "Japan", value: 470 },
    { source: "UAE", target: "India", value: 880 },
    { source: "UAE", target: "China", value: 420 },
  ],
};

function getCuratedFallback(startYear: string, endYear: string): { years: Record<string, Edge[]> } {
  const s = parseInt(startYear, 10) || 2010;
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
  const startYear = searchParams.get("start_year") ?? "2010";
  const endYear = searchParams.get("end_year") ?? "2023";
  const source = searchParams.get("source") ?? "curated";

  try {
    const url = new URL(`${API_BASE}/api/networks/oil-trade`);
    url.searchParams.set("start_year", startYear);
    url.searchParams.set("end_year", endYear);
    url.searchParams.set("source", source);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: source === "db" ? 300 : 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Only use curated fallback when source=curated. For source=db, return error so All data doesn't silently show curated.
    if (res.status === 404 || !process.env.API_URL) {
      if (source === "curated") {
        return NextResponse.json(getCuratedFallback(startYear, endYear));
      }
      return NextResponse.json(
        { error: "Backend unavailable. All data requires the API." },
        { status: 503 }
      );
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
    if (source === "curated") {
      return NextResponse.json(getCuratedFallback(startYear, endYear));
    }
    return NextResponse.json(
      { error: "Backend unreachable. All data requires the API." },
      { status: 503 }
    );
  }
}

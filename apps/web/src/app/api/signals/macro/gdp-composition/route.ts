import { NextRequest, NextResponse } from "next/server";
import { proxySignalGetJson, signalProxyPolicy } from "@/lib/signal-api-proxy";

const LEVELS_VALUE_TYPES = new Set(["real", "usd", "toman"]);

export async function GET(request: NextRequest) {
  const reqParams = request.nextUrl.searchParams;
  const start = reqParams.get("start");
  const end = reqParams.get("end");
  const country = reqParams.get("country") ?? "IRN";
  const rawType = (reqParams.get("levels_value_type") ?? "real").toLowerCase();
  const levelsValueType = LEVELS_VALUE_TYPES.has(rawType) ? rawType : "real";
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end (YYYY-MM-DD) required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  const params = new URLSearchParams({
    start,
    end,
    country,
    levels_value_type: levelsValueType,
  });
  return proxySignalGetJson(
    "/api/signals/macro/gdp-composition",
    params.toString(),
    signalProxyPolicy.wdiAnnual
  );
}

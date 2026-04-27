import { NextRequest } from "next/server";
import { proxySignalGetJson, signalProxyPolicy, startEndOr400 } from "@/lib/signal-api-proxy";

export async function GET(request: NextRequest) {
  const r = startEndOr400(request.nextUrl.searchParams);
  if (r instanceof Response) return r;
  return proxySignalGetJson("/api/signals/oil/brent", r.q, signalProxyPolicy.oilSpot);
}

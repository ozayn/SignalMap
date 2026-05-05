import { NextRequest } from "next/server";
import { proxySignalGetJson, signalProxyPolicy } from "@/lib/signal-api-proxy";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.searchParams.toString();
  return proxySignalGetJson(
    "/api/signals/wdi/country-economy-bundle",
    qs,
    signalProxyPolicy.wdiAnnual,
    { logUpstreamFailures: true }
  );
}

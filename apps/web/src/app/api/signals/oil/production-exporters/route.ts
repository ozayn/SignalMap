import { NextRequest } from "next/server";
import { proxySignalGetJson, signalProxyPolicy } from "@/lib/signal-api-proxy";

/** Forwards all query params (e.g. `nocache=1` for API debugging). */
export async function GET(request: NextRequest) {
  const qs = request.nextUrl.searchParams.toString();
  return proxySignalGetJson(
    "/api/signals/oil/production-exporters",
    qs,
    signalProxyPolicy.oilEconomy
  );
}

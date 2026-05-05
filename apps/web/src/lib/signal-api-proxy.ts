/**
 * Next.js → FastAPI signal proxies: `fetch` cache + `Cache-Control` for repeat study-page loads.
 * Aligns with API in-process TTL (6h bundles; FX merge shorter). Errors are not cached.
 */

import { NextResponse } from "next/server";

export const API_BASE = process.env.API_URL ?? "http://localhost:8000";

export const signalProxyPolicy = {
  /** Open FX / daily-ish merged series (backend 6h + internal merge cache). */
  fxDaily: { revalidate: 120, cacheControl: "public, s-maxage=120, stale-while-revalidate=60" as const },
  /**
   * Daily or near-daily oil (Brent, real oil) — FRED/DB; refresh more often than annual blends.
   * Same s-maxage as `fxDaily`.
   */
  oilSpot: { revalidate: 120, cacheControl: "public, s-maxage=120, stale-while-revalidate=60" as const },
  /** WDI annual, macro composition, static annuals (gold, minimum wage, multi-country WDI). */
  wdiAnnual: { revalidate: 1800, cacheControl: "public, s-maxage=1800, stale-while-revalidate=300" as const },
  /**
   * Faster annual WDI refresh for endpoints that are more prone to transient upstream gaps/timeouts.
   * Kept on the same typed cache-policy rails as other proxies.
   */
  wdiFast: { revalidate: 120, cacheControl: "public, s-maxage=120, stale-while-revalidate=60" as const },
  /**
   * Oil study bundles: PPP, long stitched series, production/exporters, export capacity, economy overview.
   */
  oilEconomy: { revalidate: 600, cacheControl: "public, s-maxage=600, stale-while-revalidate=120" as const },
} as const;

export type SignalProxyPolicyEntry = (typeof signalProxyPolicy)[keyof typeof signalProxyPolicy];

export type ProxySignalOptions = {
  /** Log full upstream URL + status + raw body (truncated) on non-2xx (also logs fetch failures). */
  logUpstreamFailures?: boolean;
};

const ERR_HEADERS = { "Cache-Control": "no-store" } as const;

const shouldLog =
  process.env.NODE_ENV === "development" && process.env.SIGNAL_PROXY_LOG !== "0";

function logDev(path: string, line: string): void {
  if (shouldLog) {
    // eslint-disable-next-line no-console
    console.info(`[signal-proxy] ${path} ${line}`);
  }
}

export function signalApiUrl(path: string, searchParams: string): string {
  return `${API_BASE}${path}${searchParams ? `?${searchParams}` : ""}`;
}

/** BFF: start/end (YYYY-MM-DD) required. Returns encoded query or 400. */
export function startEndOr400(searchParams: URLSearchParams): { q: string } | NextResponse {
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end (YYYY-MM-DD) required" },
      { status: 400, headers: ERR_HEADERS }
    );
  }
  return { q: `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` };
}

/**
 * Pass-through GET to the Python API with `next.revalidate` + `Cache-Control` on success.
 * 4xx/5xx and network errors: `no-store`. Dev: timing and JSON body size.
 */
export async function proxySignalGetJson(
  apiPath: string,
  searchQuery: string,
  policy: SignalProxyPolicyEntry,
  options?: ProxySignalOptions
): Promise<NextResponse> {
  const url = signalApiUrl(apiPath, searchQuery);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: policy.revalidate },
    });
    const ms = (performance.now() - t0).toFixed(1);
    if (!res.ok) {
      logDev(apiPath, `upstream ${res.status} in ${ms}ms`);
      let body: { error?: string } = { error: `API returned ${res.status}` };
      try {
        const text = await res.text();
        if (options?.logUpstreamFailures || process.env.SIGNAL_PROXY_UPSTREAM_LOG === "1") {
          // eslint-disable-next-line no-console
          console.warn("[signal-proxy] upstream non-OK", {
            apiPath,
            url,
            status: res.status,
            ms,
            bodyPreview: text.slice(0, 8000),
          });
        }
        let parsed: unknown = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }
        if (parsed && typeof parsed === "object") {
          const d = (parsed as { detail?: unknown }).detail;
          if (typeof d === "string") {
            body = { error: d };
          } else if (Array.isArray(d)) {
            body = { error: JSON.stringify(d) };
          } else {
            const err = (parsed as { error?: unknown }).error;
            if (typeof err === "string") body = { error: err };
          }
        }
      } catch {
        // ignore parse error; keep generic body
      }
      return NextResponse.json(body, { status: res.status, headers: ERR_HEADERS });
    }
    const data = (await res.json()) as unknown;
    const durMs = Math.round(Number(ms));
    if (shouldLog) {
      const size = new TextEncoder().encode(JSON.stringify(data)).length;
      logDev(apiPath, `200 in ${ms}ms ~${(size / 1024).toFixed(1)}KiB`);
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": policy.cacheControl,
        "Server-Timing": `proxy;dur=${durMs}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (shouldLog) {
      const ms = (performance.now() - t0).toFixed(1);
      logDev(apiPath, `error in ${ms}ms: ${msg}`);
    }
    if (options?.logUpstreamFailures || process.env.SIGNAL_PROXY_UPSTREAM_LOG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[signal-proxy] fetch to upstream failed", { apiPath, url, error: msg });
    }
    return NextResponse.json({ error: msg }, { status: 502, headers: ERR_HEADERS });
  }
}

import { NextResponse } from "next/server";
import { HOME_PREVIEW_CARDS_META } from "@/lib/home-preview-config";
import type { HomePreviewCardPayload, HomePreviewResponse } from "@/lib/home-preview-models";
import { HOME_PREVIEW_MAX_POINTS, downsampleSeries } from "@/lib/home-preview-series";
import { signalApiUrl, signalProxyPolicy } from "@/lib/signal-api-proxy";

/**
 * Combined JSON for CDN/browser: ~5 min fresh, stale while revalidate.
 * Upstream `fetch` uses separate `next.revalidate` (see below) aligned with signal proxies.
 */
const RESPONSE_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=120" as const;

const FX_START = "2015-01-01";
const CPI_START = "2000-01-01";
const OIL_START = "2015-01-01";

type FxUsdTomanSignalData = { points?: { date: string; value: number }[] };
type CpiInflationResponse = { series?: { iran?: { date: string; value: number }[] } };
type OilSignalData = { points?: { date: string; value: number }[] };

async function fetchUpstreamJson<T>(fullPath: string, searchQuery: string, revalidate: number): Promise<T | null> {
  const url = signalApiUrl(fullPath, searchQuery);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse<HomePreviewResponse>> {
  const end = new Date().toISOString().slice(0, 10);
  const qFx = `start=${encodeURIComponent(FX_START)}&end=${encodeURIComponent(end)}`;
  const qCpi = `start=${encodeURIComponent(CPI_START)}&end=${encodeURIComponent(end)}`;
  const qOil = `start=${encodeURIComponent(OIL_START)}&end=${encodeURIComponent(end)}`;

  const fxDaily = signalProxyPolicy.fxDaily.revalidate;
  const oilSpot = signalProxyPolicy.oilSpot.revalidate;
  const wdiAnnual = signalProxyPolicy.wdiAnnual.revalidate;

  const [fxRaw, cpiRaw, oilRaw] = await Promise.all([
    fetchUpstreamJson<FxUsdTomanSignalData>("/api/signals/fx/usd-toman", qFx, fxDaily),
    fetchUpstreamJson<CpiInflationResponse>("/api/signals/wdi/cpi-inflation-yoy", qCpi, wdiAnnual),
    fetchUpstreamJson<OilSignalData>("/api/signals/oil/brent", qOil, oilSpot),
  ]);

  const fxUp = fxRaw?.points ?? [];
  const cpiUp = cpiRaw?.series?.iran ?? [];
  const oilUp = oilRaw?.points ?? [];

  const fxPrev = downsampleSeries(fxUp, HOME_PREVIEW_MAX_POINTS);
  const cpiPrev = downsampleSeries(cpiUp, HOME_PREVIEW_MAX_POINTS);
  const oilPrev = downsampleSeries(oilUp, HOME_PREVIEW_MAX_POINTS);

  const pointById: Record<string, { upstream: typeof fxUp; preview: typeof fxPrev }> = {
    "usd-toman": { upstream: fxUp, preview: fxPrev },
    "inflation-cpi": { upstream: cpiUp, preview: cpiPrev },
    brent: { upstream: oilUp, preview: oilPrev },
  };

  const cards: HomePreviewCardPayload[] = HOME_PREVIEW_CARDS_META.map((meta) => {
    const { upstream, preview } = pointById[meta.id];
    return {
      id: meta.id,
      title: meta.title,
      href: meta.href,
      subtitle: meta.subtitle,
      points: preview,
      stats: { upstream: upstream.length, preview: preview.length },
    };
  });

  const body: HomePreviewResponse = { generated_at: end, cards };

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(
      `[homepage/previews] upstream → preview: usd-toman ${fxUp.length}→${fxPrev.length}, cpi ${cpiUp.length}→${cpiPrev.length}, brent ${oilUp.length}→${oilPrev.length}`
    );
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": RESPONSE_CACHE_CONTROL,
    },
  });
}

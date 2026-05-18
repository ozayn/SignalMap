import { NextResponse } from "next/server";
import { HOME_PREVIEW_CARDS_META } from "@/lib/home-preview-config";
import type { HomePreviewCardPayload, HomePreviewResponse } from "@/lib/home-preview-models";
import {
  HOME_PREVIEW_MAX_POINTS,
  downsampleSeries,
  downsampleStackedSeries,
  type HomePreviewStackedPoint,
} from "@/lib/home-preview-series";
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
const GDP_START = "2000-01-01";

type FxUsdTomanSignalData = { points?: { date: string; value: number }[] };
type CpiInflationResponse = { series?: { iran?: { date: string; value: number }[] } };
type OilSignalData = { points?: { date: string; value: number }[] };
type GdpGlobalResponse = {
  series_current_usd?: Record<string, { date: string; value: number }[]>;
};

function buildWorldGdpStackedPreview(
  seriesCurrentUsd: GdpGlobalResponse["series_current_usd"]
): HomePreviewStackedPoint[] {
  if (!seriesCurrentUsd) return [];
  const usByDate = new Map((seriesCurrentUsd.united_states ?? []).map((p) => [p.date, p.value] as const));
  const chinaByDate = new Map((seriesCurrentUsd.china ?? []).map((p) => [p.date, p.value] as const));
  const worldByDate = new Map((seriesCurrentUsd.world ?? []).map((p) => [p.date, p.value] as const));
  const out: HomePreviewStackedPoint[] = [];
  const dates = Array.from(worldByDate.keys()).sort((a, b) => a.localeCompare(b));
  for (const date of dates) {
    const world = worldByDate.get(date);
    const us = usByDate.get(date);
    const china = chinaByDate.get(date);
    if (
      !Number.isFinite(world as number) ||
      !Number.isFinite(us as number) ||
      !Number.isFinite(china as number) ||
      (world as number) <= 0
    ) {
      continue;
    }
    const usShare = ((us as number) / (world as number)) * 100;
    const chinaShare = ((china as number) / (world as number)) * 100;
    const rawOther = 100 - (usShare + chinaShare);
    if (rawOther < -1e-6) continue;
    out.push({
      date,
      us: usShare,
      china: chinaShare,
      other: rawOther < 0 ? 0 : rawOther,
    });
  }
  return out;
}

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
  const qGdp = `start=${encodeURIComponent(GDP_START)}&end=${encodeURIComponent(end)}`;

  const fxDaily = signalProxyPolicy.fxDaily.revalidate;
  const oilSpot = signalProxyPolicy.oilSpot.revalidate;
  const wdiAnnual = signalProxyPolicy.wdiAnnual.revalidate;

  const [fxRaw, cpiRaw, oilRaw, gdpRaw] = await Promise.all([
    fetchUpstreamJson<FxUsdTomanSignalData>("/api/signals/fx/usd-toman", qFx, fxDaily),
    fetchUpstreamJson<CpiInflationResponse>("/api/signals/wdi/cpi-inflation-yoy", qCpi, wdiAnnual),
    fetchUpstreamJson<OilSignalData>("/api/signals/oil/brent", qOil, oilSpot),
    fetchUpstreamJson<GdpGlobalResponse>("/api/signals/wdi/gdp-global-comparison", qGdp, wdiAnnual),
  ]);

  const fxUp = fxRaw?.points ?? [];
  const cpiUp = cpiRaw?.series?.iran ?? [];
  const oilUp = oilRaw?.points ?? [];

  const fxPrev = downsampleSeries(fxUp, HOME_PREVIEW_MAX_POINTS);
  const cpiPrev = downsampleSeries(cpiUp, HOME_PREVIEW_MAX_POINTS);
  const oilPrev = downsampleSeries(oilUp, HOME_PREVIEW_MAX_POINTS);
  const gdpStackedUp = buildWorldGdpStackedPreview(gdpRaw?.series_current_usd);
  const gdpStackedPrev = downsampleStackedSeries(gdpStackedUp, HOME_PREVIEW_MAX_POINTS);

  const pointById: Record<
    string,
    {
      upstream: typeof fxUp;
      preview: typeof fxPrev;
      chartKind?: "line" | "stacked_area";
      stackedUpstream?: HomePreviewStackedPoint[];
      stackedPreview?: HomePreviewStackedPoint[];
    }
  > = {
    "usd-toman": { upstream: fxUp, preview: fxPrev },
    "inflation-cpi": { upstream: cpiUp, preview: cpiPrev },
    brent: { upstream: oilUp, preview: oilPrev },
    "world-gdp-decomposition": {
      upstream: [],
      preview: [],
      chartKind: "stacked_area",
      stackedUpstream: gdpStackedUp,
      stackedPreview: gdpStackedPrev,
    },
  };

  const cards: HomePreviewCardPayload[] = HOME_PREVIEW_CARDS_META.map((meta) => {
    const { upstream, preview, chartKind, stackedUpstream, stackedPreview } = pointById[meta.id];
    return {
      id: meta.id,
      title: meta.title,
      href: meta.href,
      subtitle: meta.subtitle,
      points: preview,
      chartKind,
      stackedPoints: stackedPreview,
      stats: {
        upstream: upstream.length,
        preview: preview.length,
        stackedUpstream: stackedUpstream?.length ?? 0,
        stackedPreview: stackedPreview?.length ?? 0,
      },
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

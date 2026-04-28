"use client";

import * as echarts from "echarts";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/api";

type Point = { date: string; value: number };

type FxUsdTomanSignalData = {
  points: Point[];
};

type CpiInflationResponse = {
  series?: { iran?: Point[] };
};

type OilSignalData = {
  points: Point[];
};

const FX_START = "2015-01-01";
const CPI_START = "2000-01-01";
const OIL_START = "2015-01-01";
const MAX_FX_POINTS = 96;
const MAX_CPI_POINTS = 40;
const MAX_OIL_POINTS = 96;

function downsampleSeries(points: Point[], maxPoints: number): Point[] {
  const valid = points.filter((p) => Number.isFinite(p.value));
  const sorted = [...valid].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (sorted.length <= maxPoints) return sorted;
  const out: Point[] = [];
  const n = sorted.length;
  const target = maxPoints;
  for (let i = 0; i < target; i++) {
    const idx = Math.round((i * (n - 1)) / Math.max(1, target - 1));
    out.push(sorted[idx]!);
  }
  return out;
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}

function MiniChart({
  points,
  lineColor,
}: {
  points: Point[] | undefined;
  lineColor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !points || points.length < 2) return;

    const data = points
      .map((p) => [new Date(p.date).getTime(), p.value] as [number, number])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    if (data.length < 2) return;

    let chart: echarts.ECharts | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;
    let layoutAttempts = 0;

    const option = {
      animation: false,
      tooltip: { show: false },
      axisPointer: { show: false },
      grid: { left: 0, right: 0, top: 2, bottom: 0 },
      xAxis: { type: "time" as const, show: false, boundaryGap: false },
      yAxis: { type: "value" as const, show: false, scale: true },
      series: [
        {
          type: "line" as const,
          data,
          showSymbol: false,
          smooth: 0.12,
          silent: true,
          lineStyle: { width: 1.25, color: lineColor },
          emphasis: { disabled: true },
        },
      ],
    };

    const mount = () => {
      if (disposed || !el.isConnected) return;
      if (el.clientWidth < 4 || el.clientHeight < 4) {
        if (++layoutAttempts < 90) requestAnimationFrame(mount);
        return;
      }
      try {
        chart = echarts.init(el, undefined, { renderer: "canvas" });
        chart.setOption(option);
      } catch {
        return;
      }
      ro = new ResizeObserver(() => {
        if (!chart || disposed) return;
        try {
          chart.resize();
        } catch {
          /* disposed or zero-size */
        }
      });
      ro.observe(el);
    };

    requestAnimationFrame(mount);

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.dispose();
      chart = null;
      ro = null;
    };
  }, [points, lineColor]);

  if (points === undefined) {
    return <div className="h-[96px] w-full animate-pulse rounded-md bg-muted/45 dark:bg-muted/25" />;
  }
  if (points.length < 2) {
    return <div className="h-[96px] w-full rounded-md bg-muted/25 dark:bg-muted/15" />;
  }

  return <div ref={ref} className="h-[96px] w-full min-w-0" />;
}

function PreviewCard({
  href,
  title,
  description,
  points,
  lineColor,
}: {
  href: string;
  title: string;
  description: string;
  points: Point[] | undefined;
  lineColor: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full min-h-[196px] flex-col rounded-lg border border-border/35 bg-muted/15 px-4 pb-4 pt-3 transition-colors hover:border-border/55 hover:bg-muted/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border/25 dark:bg-muted/10 dark:hover:border-border/45 dark:hover:bg-muted/18"
    >
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[#111827] dark:text-[#e5e7eb]">
        {title}
      </h3>
      <div className="mt-3 min-h-[96px] flex-1">
        <MiniChart points={points} lineColor={lineColor} />
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[#6b7280] dark:text-[#9ca3af]">{description}</p>
    </Link>
  );
}

export function HomePreviewSection() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [fx, setFx] = useState<Point[] | undefined>(undefined);
  const [cpi, setCpi] = useState<Point[] | undefined>(undefined);
  const [oil, setOil] = useState<Point[] | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const colors = useMemo(
    () =>
      dark
        ? ["hsl(238 84% 72%)", "hsl(160 42% 52%)", "hsl(32 78% 58%)"]
        : ["hsl(238 84% 54%)", "hsl(160 44% 36%)", "hsl(32 82% 42%)"],
    [dark]
  );

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const end = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetchJson<FxUsdTomanSignalData>(
        `/api/signals/fx/usd-toman?start=${encodeURIComponent(FX_START)}&end=${encodeURIComponent(end)}`,
        ac.signal
      ),
      fetchJson<CpiInflationResponse>(
        `/api/signals/wdi/cpi-inflation-yoy?start=${encodeURIComponent(CPI_START)}&end=${encodeURIComponent(end)}`,
        ac.signal
      ),
      fetchJson<OilSignalData>(
        `/api/signals/oil/brent?start=${encodeURIComponent(OIL_START)}&end=${encodeURIComponent(end)}`,
        ac.signal
      ),
    ])
      .then(([fxRes, cpiRes, oilRes]) => {
        if (cancelled) return;
        setFx(downsampleSeries(fxRes.points ?? [], MAX_FX_POINTS));
        setCpi(downsampleSeries(cpiRes.series?.iran ?? [], MAX_CPI_POINTS));
        setOil(downsampleSeries(oilRes.points ?? [], MAX_OIL_POINTS));
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortError(err)) return;
        setFx([]);
        setCpi([]);
        setOil([]);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  return (
    <section className="home-preview" aria-label="Signal previews">
      <div className="mx-auto grid max-w-[960px] gap-5 md:grid-cols-3 md:gap-6 md:items-stretch">
        <PreviewCard
          href="/studies/iran-fx-regime"
          title="USD → Toman"
          description="Open-market rate over time."
          points={fx}
          lineColor={colors[0]!}
        />
        <PreviewCard
          href="/studies/inflation-rate"
          title="Inflation (CPI)"
          description="Annual CPI inflation (% YoY), Iran."
          points={cpi}
          lineColor={colors[1]!}
        />
        <PreviewCard
          href="/studies/iran"
          title="Brent (USD/bbl)"
          description="Nominal Brent crude benchmark."
          points={oil}
          lineColor={colors[2]!}
        />
      </div>
    </section>
  );
}

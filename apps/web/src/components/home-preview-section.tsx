"use client";

import * as echarts from "echarts";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { HOME_PREVIEW_CARDS_META } from "@/lib/home-preview-config";
import type { HomePreviewCardPayload } from "@/lib/home-preview-models";
import type { HomePreviewPoint, HomePreviewStackedPoint } from "@/lib/home-preview-series";

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}

function fallbackCards(): HomePreviewCardPayload[] {
  return HOME_PREVIEW_CARDS_META.map((m) => ({
    id: m.id,
    title: m.title,
    href: m.href,
    subtitle: m.subtitle,
    points: [],
    chartKind: m.id === "world-gdp-decomposition" ? "stacked_area" : "line",
    stackedPoints:
      m.id === "world-gdp-decomposition"
        ? [
            { date: "2000-01-01", us: 31, china: 4, other: 65 },
            { date: "2005-01-01", us: 28, china: 6, other: 66 },
            { date: "2010-01-01", us: 23, china: 9, other: 68 },
            { date: "2015-01-01", us: 24, china: 15, other: 61 },
            { date: "2020-01-01", us: 24, china: 18, other: 58 },
            { date: "2023-01-01", us: 26, china: 17, other: 57 },
          ]
        : undefined,
  }));
}

function MiniChart({
  points,
  lineColor,
}: {
  points: HomePreviewPoint[];
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
    let disposed = false;

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

    const sync = () => {
      if (disposed || !el.isConnected) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;

      if (!chart) {
        try {
          chart = echarts.init(el, undefined, {
            renderer: "canvas",
            width: w,
            height: h,
          });
          chart.setOption(option);
        } catch {
          return;
        }
        return;
      }
      try {
        chart.resize({ width: w, height: h });
      } catch {
        /* disposed */
      }
    };

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    requestAnimationFrame(() => sync());

    return () => {
      disposed = true;
      ro.disconnect();
      chart?.dispose();
      chart = null;
    };
  }, [points, lineColor]);

  if (points.length < 2) {
    return <div className="h-full w-full rounded-md bg-muted/25 dark:bg-muted/15" />;
  }

  /* Avoid min-w-0 here — it lets flex/grid shrink width to 0 and breaks ECharts sizing. */
  return <div ref={ref} className="h-full w-full min-w-[2px]" />;
}

function StackedMiniChart({
  points,
  colors,
}: {
  points: HomePreviewStackedPoint[];
  colors: { us: string; china: string; other: string };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !points || points.length < 2) return;
    const us = points
      .map((p) => [new Date(p.date).getTime(), p.us] as [number, number])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    const china = points
      .map((p) => [new Date(p.date).getTime(), p.china] as [number, number])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    const other = points
      .map((p) => [new Date(p.date).getTime(), p.other] as [number, number])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    if (us.length < 2 || china.length < 2 || other.length < 2) return;

    let chart: echarts.ECharts | null = null;
    let disposed = false;
    const option = {
      animation: false,
      tooltip: { show: false },
      axisPointer: { show: false },
      grid: { left: 0, right: 0, top: 2, bottom: 0 },
      xAxis: { type: "time" as const, show: false, boundaryGap: false },
      yAxis: { type: "value" as const, show: false, min: 0, max: 100 },
      series: [
        {
          type: "line" as const,
          data: us,
          stack: "world-share",
          showSymbol: false,
          smooth: false,
          silent: true,
          lineStyle: { width: 1.05, color: colors.us },
          areaStyle: { color: colors.us, opacity: 0.42 },
          emphasis: { disabled: true },
        },
        {
          type: "line" as const,
          data: china,
          stack: "world-share",
          showSymbol: false,
          smooth: false,
          silent: true,
          lineStyle: { width: 1.05, color: colors.china },
          areaStyle: { color: colors.china, opacity: 0.42 },
          emphasis: { disabled: true },
        },
        {
          type: "line" as const,
          data: other,
          stack: "world-share",
          showSymbol: false,
          smooth: false,
          silent: true,
          lineStyle: { width: 1.05, color: colors.other },
          areaStyle: { color: colors.other, opacity: 0.36 },
          emphasis: { disabled: true },
        },
      ],
    };

    const sync = () => {
      if (disposed || !el.isConnected) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      if (!chart) {
        try {
          chart = echarts.init(el, undefined, { renderer: "canvas", width: w, height: h });
          chart.setOption(option);
        } catch {
          return;
        }
        return;
      }
      try {
        chart.resize({ width: w, height: h });
      } catch {
        /* disposed */
      }
    };

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    requestAnimationFrame(() => sync());
    return () => {
      disposed = true;
      ro.disconnect();
      chart?.dispose();
      chart = null;
    };
  }, [points, colors]);

  if (points.length < 2) {
    return <div className="h-full w-full rounded-md bg-muted/25 dark:bg-muted/15" />;
  }
  return <div ref={ref} className="h-full w-full min-w-[2px]" />;
}

function PreviewCard({
  href,
  title,
  subtitle,
  points,
  lineColor,
  chartKind,
  stackedPoints,
  stackedColors,
}: {
  href: string;
  title: string;
  subtitle: string;
  points: HomePreviewPoint[];
  lineColor: string;
  chartKind?: "line" | "stacked_area";
  stackedPoints?: HomePreviewStackedPoint[];
  stackedColors: { us: string; china: string; other: string };
}) {
  return (
    <Link
      href={href}
      className="flex h-full min-h-[196px] flex-col rounded-lg border border-border/35 bg-muted/15 px-4 pb-4 pt-3 transition-colors hover:border-border/55 hover:bg-muted/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border/25 dark:bg-muted/10 dark:hover:border-border/45 dark:hover:bg-muted/18"
    >
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[#111827] dark:text-[#e5e7eb]">
        {title}
      </h3>
      <div className="mt-3 w-full max-w-[320px] sm:max-w-[280px] md:max-w-[240px] aspect-[4/3] self-center">
        {chartKind === "stacked_area" ? (
          <StackedMiniChart points={stackedPoints ?? []} colors={stackedColors} />
        ) : (
          <MiniChart points={points} lineColor={lineColor} />
        )}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[#6b7280] dark:text-[#9ca3af]">{subtitle}</p>
    </Link>
  );
}

export function HomePreviewSection() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cards, setCards] = useState<HomePreviewCardPayload[] | null>(null);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const colors = useMemo(
    () =>
      dark
        ? ["hsl(238 84% 72%)", "hsl(160 42% 52%)", "hsl(32 78% 58%)"]
        : ["hsl(238 84% 54%)", "hsl(160 44% 36%)", "hsl(32 82% 42%)"],
    [dark]
  );
  const stackedColors = useMemo(
    () =>
      dark
        ? { us: "hsl(238 84% 72%)", china: "hsl(160 42% 52%)", other: "hsl(220 9% 58%)" }
        : { us: "hsl(238 84% 54%)", china: "hsl(160 44% 36%)", other: "hsl(220 10% 46%)" },
    [dark]
  );

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    void (async () => {
      try {
        const res = await fetch("/api/homepage/previews", { signal: ac.signal });
        if (cancelled) return;
        if (!res.ok) {
          setCards(fallbackCards());
          return;
        }
        const data = (await res.json()) as { cards?: HomePreviewCardPayload[] };
        if (cancelled) return;
        setCards(Array.isArray(data.cards) ? data.cards : fallbackCards());
      } catch (err: unknown) {
        if (cancelled || isAbortError(err)) return;
        setCards(fallbackCards());
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  if (cards === null) {
    return (
      <section className="home-preview" aria-label="Signal previews" aria-busy="true">
        <div className="mx-auto grid max-w-[1080px] gap-5 md:grid-cols-2 md:gap-6 md:items-stretch">
          {HOME_PREVIEW_CARDS_META.map((m) => (
            <div
              key={m.id}
              className="min-h-[196px] animate-pulse rounded-lg border border-border/35 bg-muted/20 dark:border-border/25 dark:bg-muted/10"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="home-preview" aria-label="Signal previews">
      <div className="mx-auto grid max-w-[1080px] gap-5 md:grid-cols-2 md:gap-6 md:items-stretch">
        {cards.map((card, i) => (
          <PreviewCard
            key={card.id}
            href={card.href}
            title={card.title}
            subtitle={card.subtitle}
            points={card.points.length >= 2 ? card.points : []}
            lineColor={colors[i] ?? colors[0]!}
            chartKind={card.chartKind}
            stackedPoints={card.stackedPoints}
            stackedColors={stackedColors}
          />
        ))}
      </div>
    </section>
  );
}

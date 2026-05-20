"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { cssHsl } from "@/lib/utils";
import { CHART_LINE_SYMBOL_ITEM_OPACITY, CHART_LINE_SYMBOL_SIZE } from "@/lib/chart-series-markers";
import { CHART_Y_AXIS_TICK_FONT_SIZE } from "@/lib/chart-axis-label";
import { formatChartAxisNumber, formatChartTooltipNumber } from "@/lib/format-compact-decimal";

/** Short three-letter month names used on the categorical x-axis. */
export const MONTH_LABELS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthlySeriesKind = "line" | "bar";

export type MonthlySeries = {
  /** Stable identifier — used as ECharts series id, must be unique within a chart. */
  key: string;
  /** Legend label. Keep short (`Dushanbe temp`, not `Dushanbe temperature`). */
  label: string;
  /** Exactly 12 monthly values (Jan…Dec). Use `null` for missing months. */
  values: Array<number | null>;
  /** Display color (hex / css). Falls back to a stable palette slot. */
  color?: string;
  /** Which y-axis this series belongs to (0 = left, 1 = right). Default 0. */
  yAxisIndex?: 0 | 1;
  /** Render as line (default) or bar. Lines are best for temperature and daylight; bars
   *  read more naturally for precipitation. */
  kind?: MonthlySeriesKind;
  /** Optional unit shown in the tooltip after the value (e.g. `°C`, `mm`, `hours`). */
  unit?: string;
};

type MonthlyClimatologyChartProps = {
  series: MonthlySeries[];
  /** Y-axis names by index. Index `0` is the left axis, `1` is the right (if used). */
  yAxisNames?: { 0?: string; 1?: string };
  /** Tailwind height class for the chart container. Defaults to `h-64`. */
  heightClassName?: string;
  /** ARIA / accessibility label for the chart container. */
  ariaLabel?: string;
};

const DEFAULT_PALETTE = [
  "#2563eb", // blue (Dushanbe)
  "#dc2626", // red (Bokhtar)
  "#16a34a", // green (Kulob)
  "#f59e0b",
  "#7c3aed",
  "#0d9488",
];

/**
 * Lightweight ECharts wrapper for **monthly climatology data** (12-bin categorical x-axis).
 *
 * Intentionally separate from `TimelineChart`:
 *   - x-axis is a category of `Jan…Dec`, not dated time-series points.
 *   - No year range controls, no focus periods, no event overlays.
 *   - Two-axis layout (temperature left, precipitation right) is built-in but optional —
 *     omit yAxisIndex: 1 on every series and the right axis disappears automatically.
 */
export function MonthlyClimatologyChart({
  series,
  yAxisNames,
  heightClassName = "h-64",
  ariaLabel,
}: MonthlyClimatologyChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || series.length === 0) return;

    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) chart = echarts.init(chartRef.current);

    const hasRightAxis = series.some((s) => s.yAxisIndex === 1);

    const echartsSeries: echarts.SeriesOption[] = series.map((s, idx) => {
      const baseColor = s.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]!;
      if (s.kind === "bar") {
        return {
          id: s.key,
          name: s.label,
          type: "bar",
          yAxisIndex: s.yAxisIndex ?? 0,
          data: s.values,
          itemStyle: { color: baseColor, opacity: 0.85, borderRadius: [2, 2, 0, 0] },
          barGap: "10%",
          barCategoryGap: "30%",
          emphasis: { focus: "series" },
        };
      }
      return {
        id: s.key,
        name: s.label,
        type: "line",
        yAxisIndex: s.yAxisIndex ?? 0,
        data: s.values,
        smooth: true,
        showSymbol: true,
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        lineStyle: { color: baseColor, width: 1.6 },
        itemStyle: { color: baseColor, opacity: CHART_LINE_SYMBOL_ITEM_OPACITY },
        emphasis: { focus: "series", lineStyle: { width: 2.4 } },
      };
    });

    const formatYAxisValue = (v: number) => formatChartAxisNumber(v, "en");

    const yAxisDefs: echarts.YAXisComponentOption[] = [
      {
        type: "value",
        name: yAxisNames?.[0] ?? "",
        nameLocation: "middle",
        nameGap: 38,
        nameTextStyle: { color: mutedFg, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        axisLabel: {
          color: mutedFg,
          fontSize: CHART_Y_AXIS_TICK_FONT_SIZE,
          formatter: formatYAxisValue,
        },
      },
    ];
    if (hasRightAxis) {
      yAxisDefs.push({
        type: "value",
        name: yAxisNames?.[1] ?? "",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { color: mutedFg, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: mutedFg,
          fontSize: CHART_Y_AXIS_TICK_FONT_SIZE,
          formatter: formatYAxisValue,
        },
      });
    }

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const first = params[0] as { axisValue?: string };
          const monthLabel = first?.axisValue ?? "";
          const lines = [`<div style="font-weight:600;margin-bottom:2px">${monthLabel}</div>`];
          for (const p of params as Array<{
            seriesName?: string;
            data?: number | null;
            color?: string;
          }>) {
            const v = p.data;
            const series_def = series.find((s) => s.label === p.seriesName);
            const unitSuffix = series_def?.unit ? ` ${series_def.unit}` : "";
            const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            const valueLabel =
              v == null || !Number.isFinite(v)
                ? "—"
                : `${formatChartTooltipNumber(v, "en")}${unitSuffix}`;
            lines.push(`${swatch}${p.seriesName ?? ""}: <strong>${valueLabel}</strong>`);
          }
          return lines.join("<br/>");
        },
      },
      legend: {
        // `plain` wraps onto multiple rows; `scroll` paginates with arrows and
        // hides items behind a `1/N` indicator at narrow widths. For city
        // climatology with 3–6 short items, wrapping reads cleaner.
        show: true,
        type: "plain",
        bottom: 4,
        left: "center",
        width: "94%",
        itemGap: 14,
        itemWidth: 18,
        itemHeight: 10,
        textStyle: { color: mutedFg, fontSize: 11 },
      },
      grid: {
        // Reserve enough vertical room below the plot area for the legend so it
        // never overlaps x-axis tick labels. With short labels (`Dushanbe temp`)
        // the climate chart can wrap onto up to three rows on narrow viewports,
        // so we budget ~96px (≈3 × 22px legend rows + axis label clearance).
        left: 8,
        right: hasRightAxis ? 36 : 8,
        top: 14,
        bottom: series.length > 4 ? 96 : series.length > 2 ? 56 : 44,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: [...MONTH_LABELS_SHORT],
        boundaryGap: true,
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: { color: mutedFg, fontSize: 11 },
      },
      yAxis: yAxisDefs,
      series: echartsSeries,
    };

    chart.setOption(option, { notMerge: true });

    const handleResize = () => {
      try {
        chart.resize();
      } catch {
        // chart may be disposed
      }
    };
    window.addEventListener("resize", handleResize);

    // ResizeObserver picks up container resize (e.g. grid layout reflow on viewport
    // change). Falls back gracefully if the browser doesn't support it.
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && chartRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
      try {
        chart.dispose();
      } catch {
        // chart already disposed
      }
    };
  }, [series, yAxisNames]);

  return (
    <div
      ref={chartRef}
      className={`${heightClassName} w-full min-w-0`}
      role="img"
      aria-label={ariaLabel ?? "Monthly climatology chart"}
    />
  );
}

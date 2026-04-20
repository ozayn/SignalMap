"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import * as echarts from "echarts";
import { cssHsl } from "@/lib/utils";
import {
  fitLinear,
  fitExponential,
  fitLogistic,
  linearCurve,
  exponentialCurve,
  logisticCurve,
  type Point,
} from "@/lib/growth-models";
import { StudyChartControls } from "@/components/study-chart-controls";
import { downloadEchartsRaster, slugifyChartFilename, type DownloadEchartsRasterOptions } from "@/lib/chart-export";
import { buildStudyChartExportFilenameStem } from "@/lib/chart-export-filename";
import { useStudyChartExportFilenameContext } from "@/components/study-chart-export-filename-context";
import { buildPresentationExportTitle } from "@/lib/chart-export-presentation";
import {
  CHART_Y_AXIS_LABEL_MARGIN,
  CHART_Y_AXIS_NAME_GAP,
  CHART_Y_AXIS_TICK_FONT_SIZE,
  chartYAxisNameTextStyle,
  formatYAxisNameMultiline,
} from "@/lib/chart-axis-label";
import { CHART_LINE_SYMBOL_ITEM_OPACITY, CHART_LINE_SYMBOL_SIZE } from "@/lib/chart-series-markers";
import {
  STUDY_CHART_LEGEND_FONT_PX,
  STUDY_CHART_SOURCE_WRAP_CLASS,
  STUDY_CHART_STACK_GAP_CLASS,
  STUDY_CHART_TITLE_WRAP_CLASS,
} from "@/lib/chart-study-typography";
import { localizeChartNumericDisplayString, localizeChartNumericDisplayStringSafe } from "@/lib/chart-numerals-fa";

export type FollowerGrowthPoint = { date: string; value: number };

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function filterPointsByDateRange(points: [string | number, number][], start: string, end: string) {
  return points.filter(([d]) => {
    const ds = typeof d === "string" ? d.slice(0, 10) : String(d).slice(0, 10);
    return ds >= start && ds <= end;
  });
}

type FollowerGrowthChartProps = {
  data: FollowerGrowthPoint[];
  metricLabel?: string;
  showLinear?: boolean;
  showExponential?: boolean;
  showLogistic?: boolean;
  showChartControls?: boolean;
  exportFileStem?: string;
  exportSourceFooter?: string;
  exportPresentationStudyHeading?: string;
  chartLocale?: "en" | "fa";
};

export function FollowerGrowthChart({
  data,
  metricLabel = "Followers",
  showLinear = true,
  showExponential = true,
  showLogistic = true,
  showChartControls = true,
  exportFileStem,
  exportSourceFooter,
  exportPresentationStudyHeading,
  chartLocale,
}: FollowerGrowthChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");

  const points: Point[] = data.map((d) => ({ date: d.date, value: d.value }));

  const linearParams = fitLinear(points);
  const expParams = fitExponential(points);
  const logisticParams = fitLogistic(points);

  const linearCurveData = linearParams ? linearCurve(linearParams, points) : [];
  const expCurveData = expParams ? exponentialCurve(expParams, points) : [];
  const logisticCurveData = logisticParams ? logisticCurve(logisticParams, points) : [];

  const rangeBounds = useMemo((): [string, string] | undefined => {
    if (data.length === 0) return undefined;
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return [sorted[0]!.date.slice(0, 10), sorted[sorted.length - 1]!.date.slice(0, 10)];
  }, [data]);

  const chartRange = useMemo((): [string, string] | undefined => {
    if (!rangeBounds) return undefined;
    if (!showChartControls) return rangeBounds;
    let [a, b] = rangeBounds;
    if (clipStart) {
      const c = clipStart.slice(0, 10);
      if (c > a) a = c;
    }
    if (clipEnd) {
      const c = clipEnd.slice(0, 10);
      if (c < b) b = c;
    }
    if (a > b) return [b, a];
    return [a, b];
  }, [showChartControls, rangeBounds, clipStart, clipEnd]);

  useEffect(() => {
    setClipStart("");
    setClipEnd("");
  }, [rangeBounds?.[0], rangeBounds?.[1]]);

  const exportFilenameCtx = useStudyChartExportFilenameContext();

  const handleExportPng = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const backgroundColor = cssHsl("--background", "hsl(0, 0%, 100%)");
    const stem =
      exportFilenameCtx && rangeBounds && chartRange
        ? buildStudyChartExportFilenameStem({
            studySlug: exportFilenameCtx.studySlug,
            chartFileStem: exportFileStem,
            locale: exportFilenameCtx.locale,
            yearAxisMode: "gregorian",
            selectedStart: chartRange[0],
            selectedEnd: chartRange[1],
            defaultStart: rangeBounds[0],
            defaultEnd: rangeBounds[1],
            rangeGranularity: "day",
          })
        : slugifyChartFilename(exportFileStem ?? metricLabel);
    const footerColor = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const titleColor = cssHsl("--foreground", "hsl(240, 10%, 3.9%)");
    const resolvedTitle = buildPresentationExportTitle({
      studyHeading: exportPresentationStudyHeading,
      metricLabel,
      timeRange: chartRange,
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const exportOpts: DownloadEchartsRasterOptions = {
            exportSourceFooter: exportSourceFooter?.trim(),
            exportSourceFooterColor: footerColor,
            exportPresentationTitle: resolvedTitle,
            exportPresentationDirection: (chartLocale ?? "en") === "fa" ? "rtl" : "ltr",
            exportPresentationLocale: (chartLocale ?? "en") === "fa" ? "fa" : "en",
            exportPresentationTitleColor: titleColor,
          };
          downloadEchartsRaster(chart, "png", stem, backgroundColor, exportOpts);
        } catch {
          // Instance may be disposed mid-frame
        }
      });
    });
  }, [
    chartLocale,
    chartRange,
    exportFileStem,
    exportFilenameCtx,
    exportPresentationStudyHeading,
    exportSourceFooter,
    metricLabel,
    rangeBounds,
  ]);

  useEffect(() => {
    const colorRaw = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const colorLinear = cssHsl("--chart-2", "hsl(142, 76%, 36%)");
    const colorExp = cssHsl("--chart-3", "hsl(262, 83%, 58%)");
    const colorLogistic = cssHsl("--chart-4", "hsl(25, 95%, 53%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");

    if (!chartRef.current || !data.length || !chartRange) return;

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current);
    }
    chartInstanceRef.current = chart;

    const [t0, t1] = chartRange;
    const tMin = Date.parse(t0);
    const tMax = Date.parse(t1);

    const rawSeriesFull = data.map((d) => [d.date, d.value] as [string, number]);
    const rawSeries = filterPointsByDateRange(rawSeriesFull, t0, t1);

    const series: echarts.SeriesOption[] = [
      {
        name: metricLabel,
        type: "line",
        data: rawSeries,
        showSymbol: true,
        symbolSize: CHART_LINE_SYMBOL_SIZE,
        lineStyle: { color: colorRaw, width: 2, opacity: 1 },
        itemStyle: { color: colorRaw, opacity: CHART_LINE_SYMBOL_ITEM_OPACITY },
        z: 10,
      },
    ];

    if (showLinear && linearCurveData.length > 0) {
      series.push({
        name: "Model: Linear",
        type: "line",
        data: filterPointsByDateRange(
          linearCurveData.map((p) => [p.date, p.value] as [string, number]),
          t0,
          t1
        ),
        showSymbol: false,
        lineStyle: { color: colorLinear, width: 1.5, type: "dashed" },
        z: 5,
      });
    }
    if (showExponential && expCurveData.length > 0) {
      series.push({
        name: "Model: Exponential",
        type: "line",
        data: filterPointsByDateRange(
          expCurveData.map((p) => [p.date, p.value] as [string, number]),
          t0,
          t1
        ),
        showSymbol: false,
        lineStyle: { color: colorExp, width: 1.5, type: "dashed" },
        z: 5,
      });
    }
    if (showLogistic && logisticCurveData.length > 0) {
      series.push({
        name: "Model: Logistic (S-curve)",
        type: "line",
        data: filterPointsByDateRange(
          logisticCurveData.map((p) => [p.date, p.value] as [string, number]),
          t0,
          t1
        ),
        showSymbol: false,
        lineStyle: { color: colorLogistic, width: 1.5, type: "dashed" },
        z: 5,
      });
    }

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: { trigger: "axis", triggerOn: "mousemove|click" },
      grid: {
        left: "10%",
        right: "6%",
        bottom: "11%",
        top: showChartControls ? "14%" : "10%",
        containLabel: true,
      },
      xAxis: {
        type: "time",
        min: tMin,
        max: tMax,
        boundaryGap: [0, 0],
        splitNumber: 8,
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: {
          color: mutedFg,
          fontSize: CHART_Y_AXIS_TICK_FONT_SIZE,
          formatter: (value: number) => String(new Date(value).getFullYear()),
        },
      },
      yAxis: {
        type: "value",
        name: formatYAxisNameMultiline(metricLabel),
        nameLocation: "middle",
        nameRotate: 90,
        nameTextStyle: chartYAxisNameTextStyle(mutedFg),
        nameGap: CHART_Y_AXIS_NAME_GAP,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        axisLabel: {
          color: mutedFg,
          fontSize: CHART_Y_AXIS_TICK_FONT_SIZE,
          margin: CHART_Y_AXIS_LABEL_MARGIN,
          formatter: (v: number) => formatCount(v),
        },
      },
      series,
      legend: {
        show: true,
        selectedMode: true,
        top: showChartControls ? "6%" : 0,
        left: "center",
        textStyle: { fontSize: STUDY_CHART_LEGEND_FONT_PX, color: mutedFg },
        itemGap: 12,
        itemHeight: 11,
      },
    };

    chart.setOption(option, { notMerge: true });

    const handleResize = () => {
      try {
        chart.resize();
      } catch {
        // Chart may be disposed
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      try {
        chart.dispose();
      } catch {
        // Ignore
      }
      chartInstanceRef.current = null;
    };
  }, [
    data,
    metricLabel,
    showLinear,
    showExponential,
    showLogistic,
    linearCurveData,
    expCurveData,
    logisticCurveData,
    chartRange,
    showChartControls,
    chartLocale,
  ]);

  if (!data.length) return null;

  const showToolbar = showChartControls && !!rangeBounds;
  const chartLocaleResolved = chartLocale ?? "en";
  const titleText = localizeChartNumericDisplayString(metricLabel.trim(), chartLocaleResolved);
  const sourceText = exportSourceFooter?.trim() ?? "";

  return (
    <div className={`min-w-0 flex flex-col ${STUDY_CHART_STACK_GAP_CLASS}`}>
      <p className="text-xs leading-snug text-muted-foreground">
        Raw data (scatter + line). Fitted models are descriptive only; no extrapolation beyond last point.
      </p>
      {showToolbar ? (
        <StudyChartControls
          minDate={rangeBounds![0]}
          maxDate={rangeBounds![1]}
          startValue={clipStart}
          endValue={clipEnd}
          onStartChange={setClipStart}
          onEndChange={setClipEnd}
          onExportPng={handleExportPng}
          granularity="day"
        />
      ) : null}
      <p className={STUDY_CHART_TITLE_WRAP_CLASS} dir={chartLocaleResolved === "fa" ? "rtl" : "ltr"}>
        {titleText}
      </p>
      <div ref={chartRef} className="h-72 w-full min-w-0" />
      {sourceText ? (
        <p className={STUDY_CHART_SOURCE_WRAP_CLASS} dir="ltr">
          {localizeChartNumericDisplayStringSafe(sourceText, chartLocaleResolved === "fa" ? "fa" : "en")}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useEffect } from "react";
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

export type FollowerGrowthPoint = { date: string; value: number };

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type FollowerGrowthChartProps = {
  data: FollowerGrowthPoint[];
  metricLabel?: string;
  showLinear?: boolean;
  showExponential?: boolean;
  showLogistic?: boolean;
};

export function FollowerGrowthChart({
  data,
  metricLabel = "Followers",
  showLinear = true,
  showExponential = true,
  showLogistic = true,
}: FollowerGrowthChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const points: Point[] = data.map((d) => ({ date: d.date, value: d.value }));

  const linearParams = fitLinear(points);
  const expParams = fitExponential(points);
  const logisticParams = fitLogistic(points);

  const linearCurveData = linearParams ? linearCurve(linearParams, points) : [];
  const expCurveData = expParams ? exponentialCurve(expParams, points) : [];
  const logisticCurveData = logisticParams ? logisticCurve(logisticParams, points) : [];

  useEffect(() => {
    const colorRaw = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const colorLinear = cssHsl("--chart-2", "hsl(142, 76%, 36%)");
    const colorExp = cssHsl("--chart-3", "hsl(262, 83%, 58%)");
    const colorLogistic = cssHsl("--chart-4", "hsl(25, 95%, 53%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");

    if (!chartRef.current || !data.length) return;

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current);
    }

    const rawSeries = data.map((d) => [d.date, d.value]);

    const series: echarts.SeriesOption[] = [
      {
        name: metricLabel,
        type: "line",
        data: rawSeries,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { color: colorRaw, width: 2 },
        itemStyle: { color: colorRaw },
        z: 10,
      },
    ];

    if (showLinear && linearCurveData.length > 0) {
      series.push({
        name: "Model: Linear",
        type: "line",
        data: linearCurveData.map((p) => [p.date, p.value]),
        showSymbol: false,
        lineStyle: { color: colorLinear, width: 1.5, type: "dashed" },
        z: 5,
      });
    }
    if (showExponential && expCurveData.length > 0) {
      series.push({
        name: "Model: Exponential",
        type: "line",
        data: expCurveData.map((p) => [p.date, p.value]),
        showSymbol: false,
        lineStyle: { color: colorExp, width: 1.5, type: "dashed" },
        z: 5,
      });
    }
    if (showLogistic && logisticCurveData.length > 0) {
      series.push({
        name: "Model: Logistic (S-curve)",
        type: "line",
        data: logisticCurveData.map((p) => [p.date, p.value]),
        showSymbol: false,
        lineStyle: { color: colorLogistic, width: 1.5, type: "dashed" },
        z: 5,
      });
    }

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: { trigger: "axis" },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "18%", containLabel: true },
      xAxis: {
        type: "time",
        boundaryGap: [0, 0],
        splitNumber: 8,
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: {
          color: mutedFg,
          fontSize: 11,
          formatter: (value: number) => String(new Date(value).getFullYear()),
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        axisLabel: {
          color: mutedFg,
          fontSize: 11,
          formatter: (v: number) => formatCount(v),
        },
      },
      series,
      legend: {
        show: true,
        top: 0,
        left: "center",
        textStyle: { fontSize: 11, color: mutedFg },
        itemGap: 16,
      },
    };

    chart.setOption(option);

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
    };
  }, [data, metricLabel, showLinear, showExponential, showLogistic, linearCurveData, expCurveData, logisticCurveData]);

  if (!data.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Raw data (scatter + line). Fitted models are descriptive only; no extrapolation beyond last point.
      </p>
      <div ref={chartRef} className="h-72 w-full min-w-0" />
    </div>
  );
}

"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";

type DataPoint = { date: string; value: number; confidence?: number };

type TimelineChartProps = {
  data: DataPoint[];
  valueKey: keyof DataPoint;
  label: string;
};

export function TimelineChart({
  data,
  valueKey,
  label,
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    if (!chartRef.current || !data.length) return;

    const chart = echarts.init(chartRef.current);

    const dates = data.map((d) => d.date);
    const values = data.map((d) => d[valueKey] as number);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (p && typeof p === "object" && "data" in p) {
            const idx = (p as { dataIndex: number }).dataIndex;
            const pt = data[idx];
            let str = `${pt.date}<br/>${label}: ${pt.value}`;
            if (pt.confidence != null) {
              str += `<br/>Confidence: ${(pt.confidence * 100).toFixed(0)}%`;
            }
            return str;
          }
          return "";
        },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#6b7280", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: { color: "#6b7280", fontSize: 11 },
      },
      series: [
        {
          name: label,
          type: "line",
          data: values,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlphaHsl(color, 0.25) },
              { offset: 1, color: withAlphaHsl(color, 0.03) },
            ]),
          },
        },
      ],
    };

    chart.setOption(option);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [data, valueKey, label]);

  return <div ref={chartRef} className="h-80 w-full" />;
}

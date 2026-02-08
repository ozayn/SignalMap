"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";

type DataPoint = { date: string; value: number; confidence?: number };

export type TimelineEvent = {
  id: string;
  title: string;
  date: string;
  type?: string;
  description?: string;
};

type TimelineChartProps = {
  data: DataPoint[];
  valueKey: keyof DataPoint;
  label: string;
  events?: TimelineEvent[];
};

function findEventIndex(dates: string[], eventDate: string): number | null {
  const idx = dates.indexOf(eventDate);
  if (idx >= 0) return idx;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= eventDate) return i;
  }
  return dates.length - 1;
}

export function TimelineChart({
  data,
  valueKey,
  label,
  events = [],
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const muted = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    if (!chartRef.current || !data.length) return;

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current);
    }
    chartInstanceRef.current = chart;

    const dates = data.map((d) => d.date);
    const values = data.map((d) => d[valueKey] as number);

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const markLineData: { xAxis: number; event: TimelineEvent }[] = [];
    for (const ev of events) {
      if (ev.date < minDate || ev.date > maxDate) continue;
      const idx = findEventIndex(dates, ev.date);
      if (idx != null) {
        markLineData.push({ xAxis: idx, event: ev });
      }
    }

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0];
          if (p && typeof p === "object" && "dataIndex" in p) {
            const idx = (p as { dataIndex: number }).dataIndex;
            const axisValue = (p as { axisValue?: string }).axisValue;
            const ev = markLineData.find((m) => dates[m.xAxis] === axisValue)?.event;
            if (ev) {
              return `${ev.title}<br/>${ev.date}`;
            }
            const pt = data[idx];
            if (pt) {
              let str = `${pt.date}<br/>${label}: ${pt.value}`;
              if (pt.confidence != null) {
                str += `<br/>Confidence: ${(pt.confidence * 100).toFixed(0)}%`;
              }
              return str;
            }
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
          markLine:
            markLineData.length > 0
              ? {
                  symbol: "none",
                  lineStyle: { color: muted, width: 1, type: "solid" },
                  data: markLineData.map((d) => ({ xAxis: d.xAxis, label: { show: false } })),
                }
              : undefined,
        },
      ],
    };

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (!cancelled && chartRef.current) {
        chart.setOption(option);
      }
    });

    const resize = () => {
      if (!cancelled) {
        try {
          chart.resize();
        } catch {
          // Chart may be disposed
        }
      }
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      chartInstanceRef.current = null;
      try {
        chart.dispose();
      } catch {
        // Ignore dispose errors when chart is already torn down
      }
    };
  }, [data, valueKey, label, events]);

  return <div ref={chartRef} className="h-80 w-full" />;
}

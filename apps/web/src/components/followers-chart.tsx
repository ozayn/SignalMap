"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import { cssHsl } from "@/lib/utils";

export type FollowersPoint = {
  date: string;
  followers: number | null;
  confidence: number;
  archived_url: string;
};

type FollowersChartProps = {
  data: FollowersPoint[];
  username: string;
  metricLabel?: string;
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function FollowersChart({ data, username, metricLabel = "Followers" }: FollowersChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");

    if (!chartRef.current || !data.length) return;

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current);
    }

    const seriesData = data.map((d) => [d.date, d.followers != null ? d.followers : null]);

    const option: echarts.EChartsOption = {
      animation: false,
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (p && typeof p === "object" && "dataIndex" in p) {
            const idx = (p as { dataIndex: number }).dataIndex;
            const pt = data[idx];
            const followerLine =
              pt.followers != null
                ? `${formatFollowers(pt.followers)} ${metricLabel.toLowerCase()} · Confidence: ${(pt.confidence * 100).toFixed(0)}%`
                : `No ${metricLabel.toLowerCase()} data extracted`;
            const lines = [pt.date, followerLine];
            if (pt.archived_url) {
              lines.push(`<a href="${pt.archived_url}" target="_blank" rel="noopener noreferrer" style="font-size:11px;text-decoration:underline;margin-top:4px;display:block">View archived snapshot</a>`);
            }
            return lines.join("<br/>");
          }
          return "";
        },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "12%", containLabel: true },
      xAxis: {
        type: "time",
        boundaryGap: [0, 0],
        splitNumber: 8,
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: {
          color: mutedFg,
          fontSize: 11,
          formatter: (value: number) => {
            const d = new Date(value);
            const months = "JanFebMarAprMayJunJulAugSepOctNovDec";
            const m = months.slice(d.getMonth() * 3, d.getMonth() * 3 + 3);
            return `${m} ${d.getFullYear()}`;
          },
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        axisLabel: {
          color: mutedFg,
          fontSize: 11,
          formatter: (v: number) => formatFollowers(v),
        },
      },
      series: [
        {
          name: metricLabel,
          type: "line",
          data: seriesData,
          showSymbol: true,
          symbolSize: 8,
          connectNulls: false,
          lineStyle:
            data.length >= 3
              ? { color, width: 1, opacity: 0.35 }
              : { width: 0 },
          itemStyle: { color },
        },
      ],
    };

    const rafId = requestAnimationFrame(() => {
      if (chartRef.current) {
        chart.setOption(option);
      }
    });

    const resize = () => {
      try {
        chart.resize();
      } catch {
        // Chart may be disposed
      }
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      try {
        chart.dispose();
      } catch {
        // Ignore
      }
    };
  }, [data, username, metricLabel]);

  if (!data.length) return null;

  const withData = data.filter((d) => d.followers != null).length;
  const caption =
    withData === data.length
      ? `${metricLabel} over time (${data.length} point${data.length !== 1 ? "s" : ""})`
      : `${withData} of ${data.length} snapshots had ${metricLabel.toLowerCase()} data`;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{caption}</p>
      {data.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            All {data.length} snapshot dates
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {data.map((d, i) => (
              <span
                key={`${d.date}-${i}`}
                className={d.followers != null ? undefined : "opacity-60"}
                title={d.followers != null ? `${d.followers.toLocaleString()} ${metricLabel.toLowerCase()}` : `No ${metricLabel.toLowerCase()} data`}
              >
                {d.date}
              </span>
            ))}
          </div>
        </details>
      )}
      <div ref={chartRef} className="h-72 w-full" />
    </div>
  );
}

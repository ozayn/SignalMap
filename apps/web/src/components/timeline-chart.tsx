"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";

type DataPoint = { date: string; value: number; confidence?: number };

export type TimelineEvent = {
  id: string;
  title: string;
  date?: string;
  date_start?: string;
  date_end?: string;
  type?: string;
  description?: string;
  confidence?: string;
  sources?: string[];
  layer?: "iran_core" | "world_core" | "sanctions";
  scope?: "iran" | "world" | "sanctions";
};

type OilPoint = { date: string; value: number };

export type SecondSeries = {
  label: string;
  unit?: string;
  points: { date: string; value: number }[];
  yAxisIndex: 1;
};

type TimelineChartProps = {
  data: DataPoint[];
  valueKey: keyof DataPoint;
  label: string;
  unit?: string;
  events?: TimelineEvent[];
  anchorEventId?: string;
  oilPoints?: OilPoint[];
  secondSeries?: SecondSeries;
  timeRange?: [string, string];
};

function findEventIndex(dates: string[], eventDate: string): number | null {
  const idx = dates.indexOf(eventDate);
  if (idx >= 0) return idx;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= eventDate) return i;
  }
  return dates.length - 1;
}

function sparseDatesFromRange(start: string, end: string, stepMonths = 1): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const endD = new Date(end);
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setMonth(d.getMonth() + stepMonths);
  }
  return out;
}

export function TimelineChart({
  data,
  valueKey,
  label,
  unit,
  events = [],
  anchorEventId,
  oilPoints = [],
  secondSeries,
  timeRange,
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const muted = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");

    const getEventScope = (ev: TimelineEvent): "iran" | "world" | "sanctions" =>
      ev.scope ?? (ev.layer === "world_core" ? "world" : ev.layer === "sanctions" ? "sanctions" : "iran");
    const IranOpacity = 0.5;
    const WorldOpacity = 0.3;
    const SanctionsOpacity = 0.28;
    const RangeBandOpacity = 0.06;

    const oilPointsResolved = secondSeries?.points ?? oilPoints;
    const hasData = data.length > 0;
    const hasOil = oilPointsResolved.length > 0;
    const hasFallback = !hasData && (hasOil || (timeRange && events.length > 0));
    if (!chartRef.current || (!hasData && !hasFallback)) return;

    const dates = hasData
      ? data.map((d) => d.date)
      : hasOil
        ? [...new Set(oilPointsResolved.map((p) => p.date))].sort()
        : timeRange
          ? sparseDatesFromRange(timeRange[0], timeRange[1])
          : [];
    const values = hasData ? data.map((d) => d[valueKey] as number) : [];

    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
      chart = echarts.init(chartRef.current);
    }
    chartInstanceRef.current = chart;

    const oilByDate = new Map(oilPointsResolved.map((p) => [p.date, p.value]));
    const oilDates = [...oilByDate.keys()].sort();
    const nearestOil = (d: string) => {
      const exact = oilByDate.get(d);
      if (exact != null) return exact;
      if (oilDates.length === 0) return null;
      const dist = (a: string) => Math.abs(new Date(a).getTime() - new Date(d).getTime());
      const nearest = oilDates.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
      return oilByDate.get(nearest) ?? null;
    };
    const oilValues = dates.map(nearestOil);

    if (dates.length === 0) return;

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const pointEvents = events.filter((e) => e.date != null);
    const rangeEvents = events.filter((e) => e.date_start != null && e.date_end != null);

    const markLineData: { xAxis: string; event: TimelineEvent; isAnchor: boolean }[] = [];
    for (const ev of pointEvents) {
      if (ev.date! < minDate || ev.date! > maxDate) continue;
      const idx = findEventIndex(dates, ev.date!);
      if (idx != null) {
        markLineData.push({
          xAxis: dates[idx],
          event: ev,
          isAnchor: anchorEventId === ev.id,
        });
      }
    }

    const rangeBandData: { xStart: string; xEnd: string; event: TimelineEvent }[] = [];
    for (const ev of rangeEvents) {
      const ds = ev.date_start!;
      const de = ev.date_end!;
      if (de < minDate || ds > maxDate) continue;
      const startIdx = dates.findIndex((d) => d >= ds);
      let endIdx = -1;
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= de) {
          endIdx = i;
          break;
        }
      }
      if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) continue;
      rangeBandData.push({
        xStart: dates[startIdx],
        xEnd: dates[endIdx],
        event: ev,
      });
    }

    const oilColor = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");

    const option: echarts.EChartsOption = {
      animation: false,
      emphasis: { focus: "none" as const },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr.find((x) => x && typeof x === "object" && "dataIndex" in x) as
            | { dataIndex: number; axisValue?: string; value?: unknown }
            | undefined;
          if (!first) return "";
          const idx = first.dataIndex;
          const axisValue = first.axisValue;
          const dateStr = dates[idx] ?? (typeof axisValue === "string" ? axisValue : "") ?? "";
          const hoverTime = dateStr ? new Date(dateStr).getTime() : 0;
          const dayMs = 86400000;
          const rangeEv = rangeBandData.find(
            (r) => dateStr >= r.xStart && dateStr <= r.xEnd
          )?.event;
          const nearestEv = !rangeEv
            ? markLineData
                .map((m) => ({
                  ev: m.event,
                  dist: Math.abs(new Date(m.event.date!).getTime() - hoverTime),
                }))
                .filter((x) => x.dist <= dayMs * 7)
                .sort((a, b) => a.dist - b.dist)[0]
            : null;
          const ev = rangeEv ?? nearestEv?.ev ?? markLineData.find(
            (m) => m.xAxis === axisValue || m.xAxis === dateStr
          )?.event;
          const lines: string[] = [];
          if (ev) {
            const scope = getEventScope(ev);
            const scopeLabel = scope === "sanctions" ? "Sanctions" : scope === "world" ? "World event" : "Iran event";
            lines.push(`<span style="font-size:10px;color:#888">${scopeLabel}</span>`);
            lines.push(`<span style="font-weight:600">${ev.title}</span>`);
            if (ev.date_start && ev.date_end) {
              lines.push(`${ev.date_start} — ${ev.date_end}`);
            } else {
              lines.push(ev.date ?? "");
            }
            if (ev.description) lines.push(ev.description);
            if (ev.sources && ev.sources.length > 0) {
              const urlSources = ev.sources.filter((s) => s.startsWith("http"));
              const textSources = ev.sources.filter((s) => !s.startsWith("http"));
              const parts: string[] = [];
              if (urlSources.length) {
                parts.push(
                  urlSources
                    .map((url, i) => {
                      const label = urlSources.length > 1 ? `Source ${i + 1}` : "Source";
                      return `<a href="${url}" target="_blank" rel="noopener" style="color:#6b9dc7;font-size:11px">${label}</a>`;
                    })
                    .join(" • ")
                );
              }
              if (textSources.length) {
                parts.push(`Sources: ${textSources.join(", ")}`);
              }
              lines.push(parts.join(" • "));
            }
            if (ev.confidence && scope !== "sanctions") lines.push(`Confidence: ${ev.confidence}`);
            lines.push("—");
          }
          lines.push(dateStr);
          const pt = hasData && idx < data.length ? data[idx] : null;
          if (pt) {
            const val = pt[valueKey];
            lines.push(`${label}: ${val ?? "—"}`);
            if (pt.confidence != null) {
              lines.push(`Confidence: ${(pt.confidence * 100).toFixed(0)}%`);
            }
          }
          if (hasOil) {
            const oilVal = oilValues[idx];
            const unit = secondSeries?.unit ?? "USD/barrel";
            const lbl = secondSeries?.label ?? "Brent oil";
            const isToman = unit.includes("toman");
            const formatted =
              oilVal != null
                ? isToman
                  ? `${(oilVal / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k ${unit}`
                  : `${oilVal} ${unit}`
                : "—";
            lines.push(`${lbl}: ${formatted}`);
          }
          return lines.join("<br/>");
        },
      },
      grid: {
        left: "3%",
        right: hasOil || !hasData ? "12%" : "4%",
        bottom: "3%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: { color: mutedFg, fontSize: 11 },
      },
      yAxis: hasOil || !hasData
        ? [
            {
              type: "value" as const,
              position: "left" as const,
              name: (hasData ? label : secondSeries?.label ?? "Brent oil") + (unit ? ` (${unit})` : ""),
              nameTextStyle: { color: mutedFg, fontSize: 11 },
              nameGap: 8,
              axisLine: { show: false },
              splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
              axisLabel: { color: mutedFg, fontSize: 11 },
              show: hasData,
            },
            {
              type: "value" as const,
              position: "right" as const,
              name:
                (secondSeries?.label ?? "Brent oil") +
                (secondSeries?.unit?.includes("toman") ? " (k toman/USD)" : secondSeries?.unit ? ` (${secondSeries.unit})` : ""),
              nameTextStyle: { color: mutedFg, fontSize: 11 },
              nameGap: 8,
              axisLine: { show: false },
              splitLine: { show: false },
              axisLabel: {
                color: mutedFg,
                fontSize: 11,
                ...(secondSeries?.unit?.includes("toman")
                  ? {
                      formatter: (v: number) =>
                        typeof v === "number" ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k` : String(v),
                    }
                  : {}),
              },
            },
          ]
        : {
            type: "value",
            name: label,
            nameTextStyle: { color: mutedFg, fontSize: 11 },
            nameGap: 8,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
            axisLabel: { color: mutedFg, fontSize: 11 },
          },
      series: [
        ...(hasData
          ? [
              {
                name: label,
                type: "line" as const,
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
                emphasis: {
                  focus: "none" as const,
                  areaStyle: {
                    opacity: 1,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: withAlphaHsl(color, 0.25) },
                      { offset: 1, color: withAlphaHsl(color, 0.03) },
                    ]),
                  },
                },
                markLine:
                  markLineData.length > 0
                    ? {
                        symbol: "none",
                        data: markLineData.map((d) => {
                          const scope = getEventScope(d.event);
                          const isSanctions = scope === "sanctions";
                          const isWorld = scope === "world";
                          const opacity = isSanctions ? SanctionsOpacity : isWorld ? WorldOpacity : IranOpacity;
                          const color = d.isAnchor ? mutedFg : withAlphaHsl(muted, opacity);
                          const width = d.isAnchor ? 1.5 : isSanctions ? 1 : isWorld ? 1 : 1.15;
                          const lineType = "dashed" as const;
                          return {
                            xAxis: d.xAxis,
                            label: { show: false },
                            lineStyle: { color, width, type: lineType },
                          };
                        }),
                      }
                    : undefined,
                markArea:
                  rangeBandData.length > 0
                    ? {
                        silent: true,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, 0.2),
                          borderWidth: 1,
                        },
                        data: rangeBandData.map((r) => [
                          { xAxis: r.xStart },
                          { xAxis: r.xEnd },
                        ]),
                      }
                    : undefined,
              },
            ]
          : [
              {
                name: "events",
                type: "line" as const,
                data: dates.map(() => null),
                symbol: "none",
                emphasis: { focus: "none" as const },
                markLine:
                  markLineData.length > 0
                    ? {
                        symbol: "none",
                        data: markLineData.map((d) => {
                          const scope = getEventScope(d.event);
                          const isSanctions = scope === "sanctions";
                          const isWorld = scope === "world";
                          const opacity = isSanctions ? SanctionsOpacity : isWorld ? WorldOpacity : IranOpacity;
                          const color = d.isAnchor ? mutedFg : withAlphaHsl(muted, opacity);
                          const width = d.isAnchor ? 1.5 : isSanctions ? 1 : isWorld ? 1 : 1.15;
                          const lineType = "dashed" as const;
                          return {
                            xAxis: d.xAxis,
                            label: { show: false },
                            lineStyle: { color, width, type: lineType },
                          };
                        }),
                      }
                    : undefined,
                markArea:
                  rangeBandData.length > 0
                    ? {
                        silent: true,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, 0.2),
                          borderWidth: 1,
                        },
                        data: rangeBandData.map((r) => [
                          { xAxis: r.xStart },
                          { xAxis: r.xEnd },
                        ]),
                      }
                    : undefined,
              },
            ]),
        ...(hasOil
          ? [
              {
                name: secondSeries?.label ?? "Brent oil",
                type: "line" as const,
                yAxisIndex: 1,
                data: oilValues,
                smooth: true,
                symbol: "circle",
                symbolSize: 3,
                lineStyle: { color: oilColor, width: 1.5 },
                itemStyle: { color: oilColor },
                emphasis: { focus: "none" as const, lineStyle: { color: oilColor }, itemStyle: { color: oilColor } },
              },
            ]
          : []),
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
    };
  }, [data, valueKey, label, unit, events, anchorEventId, oilPoints, secondSeries, timeRange]);

  useEffect(() => {
    return () => {
      const chart = chartInstanceRef.current;
      if (chart) {
        try {
          chart.dispose();
        } catch {
          // Ignore if already disposed
        }
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} className="h-80 w-full" />;
}

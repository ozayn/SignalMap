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
  layer?: "iran_core" | "world_core" | "world_1900" | "sanctions";
  scope?: "iran" | "world" | "sanctions";
};

type OilPoint = { date: string; value: number };

export type SecondSeries = {
  label: string;
  unit?: string;
  points: { date: string; value: number }[];
  yAxisIndex: 1;
};

export type ChartSeries = {
  key: string;
  label: string;
  yAxisIndex: 0 | 1 | 2;
  unit: string;
  points: { date: string; value: number }[];
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
  /** Multiple series with explicit axis assignment (e.g. gold left, oil right). */
  multiSeries?: ChartSeries[];
  timeRange?: [string, string];
  /** When true, range bands use very low opacity (oil-dominant view). */
  mutedBands?: boolean;
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
  const [sY, sM] = start.split("-").map(Number);
  const [eY, eM] = end.split("-").map(Number);
  const startNum = sY * 12 + (sM - 1);
  const endNum = eY * 12 + (eM - 1);
  for (let n = startNum; n <= endNum; n += stepMonths) {
    const y = Math.floor(n / 12);
    const m = (n % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
  }
  return out;
}

/** Date grid for long-range views (e.g. 1900-present). ~monthly step to keep axis manageable. */
function longRangeDates(start: string, end: string, stepMonths = 1): string[] {
  return sparseDatesFromRange(start, end, stepMonths);
}

/** Return value only for exact date match. No interpolation or resampling. */
function valueAtDate(
  points: { date: string; value: number }[],
  date: string
): number | null {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const exact = byDate.get(date);
  return exact != null ? exact : null;
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
  multiSeries,
  timeRange,
  mutedBands = false,
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const muted = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const goldColor = "hsl(42, 85%, 50%)";
    const oilColorMuted = withAlphaHsl(muted, 0.7);

    const getEventScope = (ev: TimelineEvent): "iran" | "world" | "sanctions" =>
      ev.scope ?? (ev.layer === "world_core" || ev.layer === "world_1900" ? "world" : ev.layer === "sanctions" ? "sanctions" : "iran");
    const IranOpacity = 0.5;
    const WorldOpacity = 0.3;
    const SanctionsOpacity = 0.28;
    const RangeBandOpacity = mutedBands ? 0.02 : 0.06;

    const oilPointsResolved = secondSeries?.points ?? oilPoints;
    const hasData = data.length > 0;
    const hasOil = oilPointsResolved.length > 0;
    const hasMultiSeries = multiSeries != null && multiSeries.length > 0;
    const useTimeRangeForAxis = (mutedBands || hasMultiSeries) && timeRange && timeRange[0] && timeRange[1];
    const hasFallback = !hasData && (hasOil || hasMultiSeries || (timeRange && events.length > 0));
    if (!chartRef.current || (!hasData && !hasFallback)) return;

    const allMultiSeriesDates =
      hasMultiSeries && multiSeries
        ? [...new Set(multiSeries.flatMap((s) => s.points.map((p) => p.date)))].filter((d) => {
            if (!timeRange) return true;
            return d >= timeRange[0] && d <= timeRange[1];
          }).sort()
        : [];
    const useUnionDates =
      hasMultiSeries &&
      allMultiSeriesDates.length > 100 &&
      allMultiSeriesDates.length <= 3000 &&
      timeRange;
    const dates = hasData
      ? data.map((d) => d.date)
      : useUnionDates
        ? allMultiSeriesDates
        : useTimeRangeForAxis && timeRange
          ? longRangeDates(timeRange[0], timeRange[1])
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
    const firstOilDate = oilDates[0] ?? "";
    const lastOilDate = oilDates[oilDates.length - 1] ?? "";
    const nearestOil = (d: string) => {
      const exact = oilByDate.get(d);
      if (exact != null) return exact;
      if (oilDates.length === 0) return null;
      if (d < firstOilDate || d > lastOilDate) return null;
      const dist = (a: string) => Math.abs(new Date(a).getTime() - new Date(d).getTime());
      const nearest = oilDates.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
      return oilByDate.get(nearest) ?? null;
    };
    const oilValues = dates.map(nearestOil);

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const multiSeriesValues = hasMultiSeries && multiSeries
      ? multiSeries.map((s) => dates.map((d) => valueAtDate(s.points, d)))
      : null;

    if (dates.length === 0) return;

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
          if (hasMultiSeries && multiSeries && multiSeriesValues) {
            multiSeries.forEach((s, i) => {
              const val = multiSeriesValues[i]?.[idx];
              const formatted = val != null ? `${val} ${s.unit}` : "—";
              lines.push(`${s.label}: ${formatted}`);
            });
          } else if (hasOil) {
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
        left: hasMultiSeries ? "10%" : "3%",
        right:
          hasMultiSeries && multiSeries && multiSeries.some((s) => s.yAxisIndex >= 2)
            ? "26%"
            : hasOil || !hasData || hasMultiSeries
              ? "12%"
              : "4%",
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
      yAxis: hasMultiSeries && multiSeries
        ? multiSeries
            .sort((a, b) => a.yAxisIndex - b.yAxisIndex)
            .map((s, i) => {
              const isLeft = s.yAxisIndex === 0;
              const isRight = s.yAxisIndex >= 1;
              const hasMultipleRight = multiSeries.filter((x) => x.yAxisIndex >= 1).length > 1;
              const rightOffset = hasMultipleRight && s.yAxisIndex === 2 ? 90 : 0;
              const shortName =
                s.unit?.includes("toman")
                  ? `${s.label} (k)`
                  : s.unit === "USD/oz"
                    ? "Gold (USD/oz)"
                    : `${s.label} (${s.unit})`;
              return {
                type: "value" as const,
                position: (isLeft ? "left" : "right") as "left" | "right",
                offset: isRight ? rightOffset : 0,
                name: shortName,
                nameTextStyle: { color: mutedFg, fontSize: 10 },
                nameGap: 12,
                axisLine: { show: false },
                splitLine: { show: isLeft && s.yAxisIndex === 0, lineStyle: { color: borderColor, type: "dashed" as const } },
                axisLabel: {
                  color: mutedFg,
                  fontSize: 11,
                  ...(s.unit?.includes("toman")
                    ? {
                        formatter: (v: number) =>
                          typeof v === "number" ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k` : String(v),
                      }
                    : {}),
                },
              };
            })
        : hasOil || !hasData
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
        ...(hasMultiSeries && multiSeries && multiSeriesValues
          ? [
              {
                name: "events",
                type: "line" as const,
                data: dates.map(() => null),
                symbol: "none",
                emphasis: { focus: "none" as const },
                markArea:
                  rangeBandData.length > 0
                    ? {
                        silent: true,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, 0.2),
                          borderWidth: 1,
                        },
                        data: rangeBandData.map((r) =>
                          [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                        ),
                      }
                    : undefined,
              },
              ...multiSeries.map((s, i) => {
                const isGold = s.key === "gold";
                const isOil = s.key === "oil";
                const lineColor = isGold ? goldColor : isOil ? color : oilColorMuted;
                const lineWidth = isGold || isOil ? 1.5 : 1;
                const symbolSize = isGold ? 4 : isOil ? 3 : 2;
                return {
                  name: s.label,
                  type: "line" as const,
                  yAxisIndex: s.yAxisIndex,
                  data: multiSeriesValues[i] ?? [],
                  smooth: false,
                  connectNulls: true,
                  step: (isGold ? "start" : false) as "start" | false,
                  symbol: "circle",
                  symbolSize,
                  lineStyle: { color: lineColor, width: lineWidth },
                  itemStyle: { color: lineColor },
                  emphasis: { focus: "none" as const },
                };
              }),
            ]
          : hasData
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
                        data: rangeBandData.map((r) =>
                          [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                        ),
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
                        data: rangeBandData.map((r) =>
                          [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                        ),
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
                connectNulls: true,
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
  }, [data, valueKey, label, unit, events, anchorEventId, oilPoints, secondSeries, multiSeries, timeRange, mutedBands]);

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

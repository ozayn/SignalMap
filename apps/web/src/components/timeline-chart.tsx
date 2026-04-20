"use client";

import { useRef, useEffect, useState } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";
import {
  formatChartCategoryAxisYearLabel,
  formatChartTimeAxisYearLabel,
  type ChartAxisYearMode,
} from "@/lib/chart-axis-year";
import { formatGdpLevelsAxisTick, formatGdpLevelsTooltipValue } from "@/lib/format-compact-decimal";
import { globalMacroOilMarkLineShortLabel } from "@/lib/timeline-global-macro-oil-labels";

/** GDP study: compact absolute values (levels + nominal); `gdp_levels` kept as alias. */
function isGdpCompactMultiSeriesFormat(fmt?: string): boolean {
  return fmt === "gdp_levels" || fmt === "gdp_absolute";
}

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
  layer?:
    | "iran_core"
    | "world_core"
    | "world_1900"
    | "sanctions"
    | "iran_presidents"
    | "opec_decisions"
    | "global_macro_oil";
  scope?: "iran" | "world" | "sanctions" | "oil_exports";
  /** Optional taxonomy (e.g. oil_market, global_macro, war) for curated world anchors. */
  category?: string;
  /** Subtle dashed line + short end label (GDP macro markers); tooltip uses `description`. */
  macroMarker?: boolean;
  /** Optional short text for the markLine caption; full title stays in `title` for tooltips. */
  chartLabel?: string;
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
  /** Optional line/symbol color (CSS color string). */
  color?: string;
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
  /** Use log scale for the data axis (right when secondSeries). */
  yAxisLog?: boolean;
  /** Suffix for y-axis name (e.g. "log scale"). */
  yAxisNameSuffix?: string;
  /** Reduce opacity and stroke of event lines so they do not compete with the curve. */
  mutedEventLines?: boolean;
  /** Horizontal reference line (value on y-axis). */
  referenceLine?: { value: number; label?: string };
  /** Lightly shaded band for a descriptive period (e.g. approximate structural break). */
  regimeArea?: { xStart: string; xEnd: string; label?: string };
  /** Use timeRange for date axis when band overlays (e.g. presidential terms) need full range. Use for dense/short-range data (e.g. FX). */
  useTimeRangeForDateAxis?: boolean;
  /** Comparator series on same axis as secondSeries (e.g. Turkey PPP). Thinner, muted. */
  comparatorSeries?: { label: string; points: { date: string; value: number }[] };
  /** When true, index both series to 100 at first common year so different-scale series (e.g. Iran vs Turkey) are comparable. */
  indexComparator?: boolean;
  /** Optional sanctions periods rendered as low-opacity background bands (Study 9). */
  sanctionsPeriods?: Array<{ date_start: string; date_end: string; title: string; scope?: string }>;
  /** Dates when oil price had shock moves (|daily_return| > 2× rolling vol). Red markers on oil series. */
  oilShockDates?: string[];
  /** When false, shock markers are hidden. Default true. */
  showOilShocks?: boolean;
  /** Chart container height (default h-80 md:h-96). Use e.g. "h-48" for smaller charts. */
  chartHeight?: string;
  /** Override grid.right (e.g. "12%") to align x-axis with another chart above. */
  gridRight?: string;
  /** Dates that are synthetic extensions (e.g. current year when data ends earlier). */
  extendedDates?: string[];
  /** Last official data year for extension tooltip (e.g. "2025"). */
  lastOfficialDateForExtension?: string;
  /** When true, show a circular marker at the latest data point (e.g. Brent study). */
  highlightLatestPoint?: boolean;
  /** When true, use time axis instead of category axis (for short-term high-resolution charts). */
  forceTimeAxis?: boolean;
  /** When true, x-axis ticks come from timeRange only (not from data). Use when switching data sources should not change axis. */
  forceTimeRangeAxis?: boolean;
  /** Fixed y-axis min (for consistent scale when switching data sources). */
  yAxisMin?: number;
  /** Fixed y-axis max (for consistent scale when switching data sources). */
  yAxisMax?: number;
  /** X-axis tick year: Gregorian (default) or Iranian (Solar Hijri); display only. */
  xAxisYearLabel?: ChartAxisYearMode;
  /** When set with dense category axes, show a year label about every N calendar years (Gregorian year index; Jalali label still applies). */
  categoryYearTickStep?: number;
  /** Compact USD / bn-toman tooltips and y-axis ticks (GDP composition absolute-value charts). */
  multiSeriesValueFormat?: "gdp_levels" | "gdp_absolute";
  /** Override multi-series y-axis titles (key = ``yAxisIndex``), e.g. dual-axis reference layouts. */
  multiSeriesYAxisNameOverrides?: Partial<Record<number, string>>;
};

function findEventIndex(dates: string[], eventDate: string): number | null {
  const idx = dates.indexOf(eventDate);
  if (idx >= 0) return idx;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= eventDate) return i;
  }
  return dates.length - 1;
}

/** Minimum Gregorian years between shown Iran macro **top** captions (lines always draw). */
const MIN_LABEL_GAP_YEARS = 3;

/** Minimum years between shown **vertical** global oil / macro captions (lines always draw). */
const MIN_VERTICAL_LABEL_GAP_YEARS = 4;

/** Vertical pixel bands for top captions so nearby years can both show text without stacking on one row. */
const MACRO_LABEL_ROW_HEIGHT = 11;
const MACRO_LABEL_MAX_ROWS = 5;

/** Higher = earlier in sort when years tie (prefer war/sanctions captions). */
function macroEventPriority(ev: TimelineEvent): number {
  const t = ev.type;
  if (t === "war") return 3;
  if (t === "sanctions") return 2;
  if (t === "political") return 1;
  return 0;
}

function eventGregorianYear(ev: TimelineEvent): number {
  const ds = ev.date ?? ev.date_start ?? "";
  const y = parseInt(ds.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

type MacroLabelLayout = { showLabel: boolean; staggerIndex: number };

/**
 * Macro-marker captions: at most one label per MIN_LABEL_GAP_YEARS in time (anchor always gets a label).
 * `staggerIndex` picks a vertical offset band at the top so multiple labels can remain readable.
 */
function buildMacroLabelLayout(args: {
  macroMarkData: { xAxis: string; event: TimelineEvent }[];
  anchorEventId?: string;
}): Map<string, MacroLabelLayout> {
  const { macroMarkData, anchorEventId } = args;
  const layout = new Map<string, MacroLabelLayout>();
  if (macroMarkData.length === 0) return layout;

  for (const d of macroMarkData) {
    layout.set(d.event.id, { showLabel: false, staggerIndex: 0 });
  }

  const sorted = [...macroMarkData].sort((a, b) => {
    const ya = eventGregorianYear(a.event);
    const yb = eventGregorianYear(b.event);
    if (ya !== yb) return ya - yb;
    return macroEventPriority(b.event) - macroEventPriority(a.event);
  });

  let lastLabeledYear = -Infinity;
  let stagger = 0;

  for (const d of sorted) {
    const y = eventGregorianYear(d.event);
    const isAnchor = anchorEventId === d.event.id;
    const show = isAnchor || y - lastLabeledYear >= MIN_LABEL_GAP_YEARS;
    if (show) {
      layout.set(d.event.id, { showLabel: true, staggerIndex: stagger });
      stagger += 1;
      lastLabeledYear = y;
    }
  }

  return layout;
}

type VerticalOilLabelLayout = { showLabel: boolean };

/**
 * Global oil markLines: at most one vertical caption per ``MIN_VERTICAL_LABEL_GAP_YEARS``
 * (anchor always gets a label). Lines for every event stay in ``markLineData``; only labels drop.
 */
function buildVerticalGlobalOilLabelLayout(args: {
  globalOilMarkData: { event: TimelineEvent }[];
  anchorEventId?: string;
}): Map<string, VerticalOilLabelLayout> {
  const { globalOilMarkData, anchorEventId } = args;
  const layout = new Map<string, VerticalOilLabelLayout>();
  if (globalOilMarkData.length === 0) return layout;

  for (const d of globalOilMarkData) {
    layout.set(d.event.id, { showLabel: false });
  }

  const sorted = [...globalOilMarkData].sort((a, b) => {
    const ya = eventGregorianYear(a.event);
    const yb = eventGregorianYear(b.event);
    if (ya !== yb) return ya - yb;
    return macroEventPriority(b.event) - macroEventPriority(a.event);
  });

  let lastLabeledYear = -Infinity;

  for (const d of sorted) {
    const y = eventGregorianYear(d.event);
    const isAnchor = anchorEventId === d.event.id;
    const show = isAnchor || y - lastLabeledYear >= MIN_VERTICAL_LABEL_GAP_YEARS;
    if (show) {
      layout.set(d.event.id, { showLabel: true });
      lastLabeledYear = y;
    }
  }

  return layout;
}

/** Short markLine text; full title stays on the event for tooltips. */
function macroMarkLineCaption(ev: TimelineEvent): string {
  const c = ev.chartLabel?.trim();
  if (c) return c;
  const t = ev.title.trim();
  if (t.length <= 16) return t;
  return `${t.slice(0, 14)}…`;
}

/** Same dashed markLine + caption layout as ``macroMarker`` (API global oil anchors omit the flag). */
function eventUsesMacroMarkLineStyle(ev: TimelineEvent): boolean {
  return ev.macroMarker === true || ev.layer === "global_macro_oil";
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

/** For sparse data (e.g. annual): exact match, or nearest point within range. */
function valueAtDateOrNearest(
  points: { date: string; value: number }[],
  date: string
): number | null {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const exact = byDate.get(date);
  if (exact != null) return exact;
  if (points.length === 0) return null;
  const sorted = [...byDate.keys()].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (date < first || date > last) return null;
  const dist = (a: string) => Math.abs(new Date(a).getTime() - new Date(date).getTime());
  const nearest = sorted.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
  return byDate.get(nearest) ?? null;
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
  yAxisLog = false,
  yAxisNameSuffix,
  mutedEventLines = false,
  referenceLine,
  regimeArea,
  useTimeRangeForDateAxis = false,
  comparatorSeries,
  indexComparator = false,
  sanctionsPeriods = [],
  oilShockDates = [],
  showOilShocks = true,
  chartHeight = "h-80 md:h-96",
  gridRight: gridRightOverride,
  extendedDates = [],
  lastOfficialDateForExtension,
  highlightLatestPoint = false,
  forceTimeAxis = false,
  forceTimeRangeAxis = false,
  yAxisMin,
  yAxisMax,
  xAxisYearLabel,
  categoryYearTickStep,
  multiSeriesValueFormat,
  multiSeriesYAxisNameOverrides,
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [xLabelRotate, setXLabelRotate] = useState(0);

  useEffect(() => {
    const updateRotate = () => setXLabelRotate(window.innerWidth < 640 ? 90 : 0);
    updateRotate();
    window.addEventListener("resize", updateRotate);
    return () => window.removeEventListener("resize", updateRotate);
  }, []);

  useEffect(() => {
    const color = cssHsl("--chart-primary", "hsl(238, 84%, 67%)");
    const muted = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const borderColor = cssHsl("--border", "hsl(240, 5.9%, 90%)");
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const goldColor = "hsl(42, 85%, 50%)";
    const oilColorMuted = withAlphaHsl(muted, 0.7);
    const chart2Color = cssHsl("--chart-2", "hsl(142, 76%, 36%)");
    const productionColors: Record<string, string> = {
      us: "hsl(220, 65%, 50%)",
      saudi: "hsl(142, 55%, 38%)",
      russia: "hsl(0, 60%, 50%)",
      iran: "hsl(35, 85%, 52%)",
      total: "hsl(0, 0%, 55%)",
    };
    const productionSymbols: Record<string, "circle" | "diamond" | "triangle" | "roundRect"> = {
      us: "circle",
      saudi: "diamond",
      russia: "triangle",
      iran: "roundRect",
      total: "circle",
    };

    const getEventScope = (ev: TimelineEvent): "iran" | "world" | "sanctions" =>
      (ev.scope === "oil_exports" ? "sanctions" : ev.scope) ??
      (ev.layer === "world_core" ||
      ev.layer === "world_1900" ||
      ev.layer === "opec_decisions" ||
      ev.layer === "global_macro_oil"
        ? "world"
        : ev.layer === "sanctions"
          ? "sanctions"
          : "iran");
    const isPresidentialEvent = (ev: TimelineEvent) => ev.layer === "iran_presidents";
    const IranOpacity = mutedEventLines ? 0.35 : 0.5;
    const WorldOpacity = mutedEventLines ? 0.3 : 0.3;
    const SanctionsOpacity = mutedEventLines ? 0.45 : 0.45;
    const EventLineWidth = mutedEventLines ? 1 : 1;
    const SanctionsLineWidth = mutedEventLines ? 1.2 : 1;
    const RangeBandOpacity = mutedBands ? 0.02 : 0.06;
    const SanctionsBandOpacity = 0.04;

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
    const useSparseMultiSeriesDates =
      hasMultiSeries && allMultiSeriesDates.length > 0 && allMultiSeriesDates.length <= 50 && timeRange;
    const spanYearsFromRange =
      timeRange && timeRange[0] && timeRange[1]
        ? parseInt(timeRange[1].slice(0, 4), 10) - parseInt(timeRange[0].slice(0, 4), 10)
        : 0;
    const useYearlyAxisForMultiSeries =
      hasMultiSeries && timeRange && useUnionDates && spanYearsFromRange > 0 && spanYearsFromRange <= 20;
    const useTimeRangeForBands =
      useTimeRangeForDateAxis &&
      !hasData &&
      hasOil &&
      !!timeRange?.[0] &&
      !!timeRange?.[1];
    const useYearlyMultiSeries =
      hasMultiSeries && timeRange && useSparseMultiSeriesDates && !forceTimeRangeAxis;
    const yearlyDates =
      useYearlyMultiSeries && timeRange
        ? (() => {
            const years = [...new Set(allMultiSeriesDates.map((d) => d.slice(0, 4)))].sort();
            return years.map((y) => `${y}-07-01`);
          })()
        : [];
    const useForceTimeRangeDates = forceTimeRangeAxis && hasMultiSeries && timeRange && timeRange[0] && timeRange[1];
    const rangeStart = timeRange && timeRange[0].length === 4 ? `${timeRange[0]}-01-01` : timeRange?.[0] ?? "";
    const rangeEnd = timeRange && timeRange[1].length === 4 ? `${timeRange[1]}-12-31` : timeRange?.[1] ?? "";
    let dates = useForceTimeRangeDates
      ? sparseDatesFromRange(rangeStart, rangeEnd, 12)
      : hasData
      ? data.map((d) => d.date)
      : useYearlyMultiSeries
        ? yearlyDates
        : useYearlyAxisForMultiSeries
          ? sparseDatesFromRange(timeRange![0], timeRange![1], 12)
          : useUnionDates
            ? allMultiSeriesDates
            : useSparseMultiSeriesDates
              ? allMultiSeriesDates
              : useTimeRangeForAxis && timeRange
            ? longRangeDates(timeRange[0], timeRange[1])
            : useTimeRangeForBands && timeRange
            ? longRangeDates(timeRange[0], timeRange[1])
            : hasOil
              ? [...new Set(oilPointsResolved.map((p) => p.date))].sort()
              : timeRange
                ? sparseDatesFromRange(timeRange[0], timeRange[1])
                : [];
    if (hasMultiSeries && timeRange && dates.length > 0) {
      const [rangeStart, rangeEnd] = timeRange;
      const firstYear = dates[0]!.slice(0, 4);
      const lastYear = dates[dates.length - 1]!.slice(0, 4);
      if (firstYear > rangeStart.slice(0, 4)) dates = [rangeStart, ...dates.filter((d) => d > rangeStart)].sort();
      if (lastYear < rangeEnd.slice(0, 4)) dates = [...dates.filter((d) => d < rangeEnd), rangeEnd].sort();
    }
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
    const comparatorByDate = comparatorSeries
      ? new Map(comparatorSeries.points.map((p) => [p.date, p.value]))
      : null;
    const nearestComparator = comparatorByDate
      ? (d: string) => {
          const exact = comparatorByDate.get(d);
          if (exact != null) return exact;
          const sorted = [...comparatorByDate.keys()].sort();
          if (sorted.length === 0) return null;
          const first = sorted[0]!;
          const last = sorted[sorted.length - 1]!;
          if (d < first || d > last) return null;
          const dist = (a: string) => Math.abs(new Date(a).getTime() - new Date(d).getTime());
          const nearest = sorted.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
          return comparatorByDate.get(nearest) ?? null;
        }
      : null;
    let comparatorValues = nearestComparator ? dates.map(nearestComparator) : null;

    const useIndexed = indexComparator && comparatorSeries && comparatorValues && hasOil;
    let oilValuesForChart = oilValues;
    let comparatorValuesForChart = comparatorValues;
    let indexBaseYear: number | null = null;
    if (useIndexed) {
      const baseIdx = dates.findIndex((d, i) => {
        const o = oilValues[i];
        const c = comparatorValues?.[i];
        return o != null && o > 0 && c != null && c > 0;
      });
      if (baseIdx >= 0) {
        const baseOil = oilValues[baseIdx] as number;
        const baseComp = comparatorValues[baseIdx] as number;
        indexBaseYear = parseInt(dates[baseIdx]!.slice(0, 4), 10);
        oilValuesForChart = oilValues.map((v) =>
          v != null && v > 0 ? (v / baseOil) * 100 : null
        );
        comparatorValuesForChart = comparatorValues!.map((v) =>
          v != null && v > 0 ? (v / baseComp) * 100 : null
        );
      }
    }

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const firstYearNum = parseInt((minDate ?? "").slice(0, 4), 10);
    const lastYearNum = parseInt((maxDate ?? "").slice(0, 4), 10);
    const spanYears = lastYearNum - firstYearNum;
    const dateMin = minDate ? Date.parse(minDate) : 0;
    const dateMax = maxDate ? Date.parse(maxDate) : 0;
    const spanDays = dateMax && dateMin ? (dateMax - dateMin) / 86400000 : 0;
    const useTimeAxis =
      forceTimeAxis || spanYears > 40 || (spanDays > 0 && spanDays < 400);

    const axisYearMode: ChartAxisYearMode = xAxisYearLabel ?? "gregorian";

    const toTimeData = (vals: (number | null)[]) =>
      dates.map((d, i) => [Date.parse(d), vals[i] ?? null] as [number, number | null]);

    const valueFn =
      mutedBands || useYearlyMultiSeries || (hasMultiSeries && useUnionDates) || (hasMultiSeries && timeRange)
        ? valueAtDateOrNearest
        : valueAtDate;
    const multiSeriesValues = hasMultiSeries && multiSeries
      ? multiSeries.map((s) => dates.map((d) => valueFn(s.points, d)))
      : null;

    if (dates.length === 0) return;

    const shockMarkPointData =
      oilShockDates.length > 0
        ? oilShockDates
            .filter((d) => d >= minDate! && d <= maxDate!)
            .map((d) => {
              const idx = findEventIndex(dates, d);
              if (idx == null) return null;
              const dateStr = dates[idx]!;
              const yVal =
                hasMultiSeries && multiSeries
                  ? (() => {
                      const oilIdx = multiSeries.findIndex((s) => s.key === "oil");
                      if (oilIdx < 0) return null;
                      return multiSeriesValues?.[oilIdx]?.[idx] ?? null;
                    })()
                  : hasData
                    ? valueFn(data, dateStr)
                    : nearestOil(dateStr);
              if (yVal == null || typeof yVal !== "number") return null;
              return {
                coord: (useTimeAxis ? [Date.parse(dateStr), yVal] : [dateStr, yVal]) as [number, number] | [string, number],
              };
            })
            .filter((x): x is { coord: [number, number] | [string, number] } => x != null)
        : [];

    const latestPointData =
      highlightLatestPoint && hasOil
        ? (() => {
            const vals = hasMultiSeries && multiSeries
              ? (() => {
                  const oilIdx = multiSeries.findIndex((s) => s.key === "oil");
                  if (oilIdx < 0) return null;
                  return multiSeriesValues?.[oilIdx] ?? null;
                })()
              : oilValuesForChart;
            if (!vals || vals.length === 0) return null;
            let lastIdx = -1;
            for (let i = vals.length - 1; i >= 0; i--) {
              if (vals[i] != null && typeof vals[i] === "number") {
                lastIdx = i;
                break;
              }
            }
            if (lastIdx < 0) return null;
            const dateStr = dates[lastIdx]!;
            const val = vals[lastIdx] as number;
            return {
              coord: (useTimeAxis ? [Date.parse(dateStr), val] : [dateStr, val]) as [number, number] | [string, number],
              dateStr,
              val,
            };
          })()
        : null;

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

    const iranMacroMarkLineData = markLineData.filter((d) => d.event.macroMarker === true);
    const globalOilMarkLineData = markLineData.filter((d) => d.event.layer === "global_macro_oil");
    const hasTopMacroCaptionRows = iranMacroMarkLineData.length > 0;
    const macroLabelLayout = buildMacroLabelLayout({
      macroMarkData: iranMacroMarkLineData,
      anchorEventId,
    });
    const verticalGlobalOilLabelLayout = buildVerticalGlobalOilLabelLayout({
      globalOilMarkData: globalOilMarkLineData,
      anchorEventId,
    });

    type MarkLineDatum = { xAxis: string; event: TimelineEvent; isAnchor: boolean };
    const verticalMarkLineItem = (d: MarkLineDatum) => {
      if (d.event.layer === "global_macro_oil") {
        const vl = verticalGlobalOilLabelLayout.get(d.event.id) ?? { showLabel: false };
        const shortCaption = globalMacroOilMarkLineShortLabel(d.event);
        return {
          xAxis: d.xAxis,
          label: vl.showLabel
            ? {
                show: true,
                formatter: shortCaption,
                fontSize: 10,
                color: withAlphaHsl(mutedFg, 0.86),
                distance: 8,
                position: "middle" as const,
                rotate: 90,
                offset: [0, 0] as [number, number],
              }
            : { show: false },
          lineStyle: {
            color: withAlphaHsl(muted, 0.28),
            width: 1,
            type: "dashed" as const,
          },
        };
      }
      if (d.event.macroMarker === true) {
        const ml = macroLabelLayout.get(d.event.id) ?? { showLabel: false, staggerIndex: 0 };
        const showTopMacroLabel = ml.showLabel;
        const caption = macroMarkLineCaption(d.event);
        const row = ml.staggerIndex % MACRO_LABEL_MAX_ROWS;
        const offsetY = -row * MACRO_LABEL_ROW_HEIGHT;
        return {
          xAxis: d.xAxis,
          label: showTopMacroLabel
            ? {
                show: true,
                formatter: caption,
                fontSize: 10,
                color: mutedFg,
                distance: 4,
                position: "end" as const,
                offset: [0, offsetY] as [number, number],
                rotate: 0,
              }
            : {
                show: true,
                formatter: caption,
                fontSize: 9,
                color: withAlphaHsl(mutedFg, 0.92),
                distance: 10,
                position: "middle" as const,
                rotate: 90,
                offset: [0, 0] as [number, number],
              },
          lineStyle: {
            color: withAlphaHsl(muted, 0.28),
            width: 1,
            type: "dashed" as const,
          },
        };
      }
      const scope = getEventScope(d.event);
      const isSanctions = scope === "sanctions";
      const isWorld = scope === "world";
      const opacity = isSanctions ? SanctionsOpacity : isWorld ? WorldOpacity : IranOpacity;
      const lineColor = d.isAnchor ? mutedFg : withAlphaHsl(muted, opacity);
      const lineWidth = d.isAnchor
        ? mutedEventLines
          ? 1
          : 1.5
        : mutedEventLines
          ? isSanctions
            ? SanctionsLineWidth
            : EventLineWidth
          : isSanctions
            ? SanctionsLineWidth
            : isWorld
              ? 1
              : 1.15;
      return {
        xAxis: d.xAxis,
        label: { show: false },
        lineStyle: { color: lineColor, width: lineWidth, type: "dashed" as const },
      };
    };

    const markLineSeriesItems = markLineData.map((d) => verticalMarkLineItem(d));

    const rangeBandData: { xStart: string; xEnd: string; event: TimelineEvent }[] = [];
    const presidentialBandData: { xStart: string; xEnd: string; event: TimelineEvent }[] = [];
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
      const bandWidth = endIdx - startIdx + 1;
      const gapIndices = isPresidentialEvent(ev)
        ? Math.min(3, Math.floor(bandWidth / 10))
        : 0;
      let xStart = dates[startIdx];
      let xEnd = dates[endIdx];
      if (gapIndices > 0 && bandWidth >= 2 * gapIndices) {
        xStart = dates[startIdx + gapIndices];
        xEnd = dates[endIdx - gapIndices];
      }
      const band = { xStart, xEnd, event: ev };
      rangeBandData.push(band);
      if (isPresidentialEvent(ev)) presidentialBandData.push(band);
    }
    const regularBandData = rangeBandData.filter((r) => !isPresidentialEvent(r.event));
    const PresidentialBandOpacity = 0.04;

    const oilColor = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const comparatorColor = "hsl(195, 55%, 42%)";

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: "transparent",
      emphasis: { focus: "none" as const },
      ...(comparatorSeries && comparatorValuesForChart && hasOil
        ? {
            legend: {
              show: true,
              bottom: 4,
              left: "center",
              itemGap: 16,
              textStyle: { color: mutedFg, fontSize: 10 },
              data: [secondSeries?.label ?? "Iran (PPP)", comparatorSeries.label],
            },
          }
        : hasMultiSeries && multiSeries
          ? {
              legend: {
                show: true,
                bottom: 4,
                left: "center",
                itemGap: 16,
                textStyle: { color: mutedFg, fontSize: 10 },
                data: multiSeries.map((s) => s.label),
              },
            }
          : hasOil && secondSeries && !comparatorSeries
            ? {
                legend: {
                  show: true,
                  bottom: 4,
                  left: "center",
                  itemGap: 16,
                  textStyle: { color: mutedFg, fontSize: 10 },
                  data: hasData ? [label, secondSeries.label] : [secondSeries?.label ?? "Brent oil"],
                },
              }
            : {}),
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        confine: true,
        extraCssText: "max-width: 320px; overflow-wrap: break-word; word-wrap: break-word; white-space: normal;",
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr.find((x) => x && typeof x === "object" && "dataIndex" in x) as
            | { dataIndex: number; axisValue?: string; value?: unknown }
            | undefined;
          if (!first) return "";
          const idx = first.dataIndex;
          const axisValue = first.axisValue;
          const dateStr =
            dates[idx] ??
            (typeof axisValue === "number"
              ? new Date(axisValue).toISOString().slice(0, 10)
              : typeof axisValue === "string"
                ? axisValue
                : "");
          const hoverTime = dateStr ? new Date(dateStr).getTime() : 0;
          const dayMs = 86400000;
          const rangeBand = rangeBandData.find((r) => dateStr >= r.xStart && dateStr <= r.xEnd);
          const sanctionsBand = sanctionsPeriods.find((p) => dateStr >= p.date_start && dateStr <= p.date_end);
          const rangeEv = rangeBand?.event;
          const nearestEv = !rangeEv
            ? markLineData
                .map((m) => ({
                  ev: m.event,
                  dist: Math.abs(new Date(m.event.date!).getTime() - hoverTime),
                }))
                .filter((x) => {
                  const win = eventUsesMacroMarkLineStyle(x.ev) ? dayMs * 220 : dayMs * 7;
                  return x.dist <= win;
                })
                .sort((a, b) => a.dist - b.dist)[0]
            : null;
          const ev = rangeEv ?? nearestEv?.ev ?? markLineData.find(
            (m) => m.xAxis === axisValue || m.xAxis === dateStr
          )?.event;
          const lines: string[] = [];
          if (sanctionsBand) {
            lines.push(`<span style="font-size:10px;color:#888">Sanctions period</span>`);
            lines.push(`<span style="font-weight:600">${sanctionsBand.title}</span>`);
            lines.push(`${sanctionsBand.date_start} — ${sanctionsBand.date_end}`);
            lines.push(`Scope: ${sanctionsBand.scope ?? "oil exports"}`);
            lines.push("—");
          }
          if (ev) {
            if (eventUsesMacroMarkLineStyle(ev)) {
              const mt = ev.type === "political" || ev.type === "war" || ev.type === "sanctions" ? ev.type : "";
              const mtLabel =
                mt === "political"
                  ? "Political"
                  : mt === "war"
                    ? "War / security"
                    : mt === "sanctions"
                      ? "Sanctions"
                      : "Macro context";
              lines.push(`<span style="font-size:10px;color:#888">${mtLabel}</span>`);
              lines.push(`<span style="font-weight:600">${ev.title}</span>`);
              if (ev.date) lines.push(ev.date);
              if (ev.description) lines.push(ev.description);
            } else if (rangeBand && isPresidentialEvent(ev)) {
              lines.push(`<span style="font-size:10px;color:#888">Presidential term</span>`);
              lines.push(`<span style="font-weight:600">${ev.title}</span> ${ev.date_start} — ${ev.date_end}`);
            } else {
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
            }
            if (
              !(rangeBand && isPresidentialEvent(ev)) &&
              (!eventUsesMacroMarkLineStyle(ev) || ev.layer === "global_macro_oil")
            ) {
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
              const scopeForConfidence = ev.scope ?? (ev.layer === "world_core" || ev.layer === "world_1900" ? "world" : ev.layer === "sanctions" ? "sanctions" : "iran");
              if (ev.confidence && scopeForConfidence !== "sanctions") lines.push(`Confidence: ${ev.confidence}`);
            }
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
              const formatted =
                val != null
                  ? isGdpCompactMultiSeriesFormat(multiSeriesValueFormat)
                    ? formatGdpLevelsTooltipValue(Number(val), s.unit)
                    : `${Number(val).toLocaleString(undefined, { maximumFractionDigits: 20 })} ${s.unit}`
                  : "—";
              lines.push(`${s.label}: ${formatted}`);
            });
            if (extendedDates.includes(dateStr) && lastOfficialDateForExtension) {
              lines.push(`<span style="font-size:10px;color:#888">Estimated extension (latest official data: ${lastOfficialDateForExtension})</span>`);
            }
          } else if (hasOil) {
            const oilVal = oilValuesForChart[idx];
            const unit = secondSeries?.unit ?? "USD/barrel";
            const lbl = secondSeries?.label ?? "Brent oil";
            const isIndexed = useIndexed && indexBaseYear != null;
            const formatted =
              oilVal != null
                ? isIndexed
                  ? `${oilVal.toFixed(1)} (indexed)`
                  : unit.includes("toman")
                  ? `${(oilVal / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k ${unit}`
                  : `${oilVal} ${unit}`
                : "—";
            lines.push(`${lbl}: ${formatted}`);
            if (comparatorValuesForChart && comparatorSeries) {
              const compVal = comparatorValuesForChart[idx];
              const compFormatted =
                compVal != null
                  ? isIndexed
                    ? `${compVal.toFixed(1)} (indexed)`
                    : `${compVal}`
                  : "—";
              lines.push(`${comparatorSeries.label}: ${compFormatted}`);
            }
          }
          return lines.join("<br/>");
        },
      },
      grid: {
        left: hasMultiSeries ? "10%" : "3%",
        right:
          gridRightOverride ??
          (hasMultiSeries && multiSeries && multiSeries.some((s) => s.yAxisIndex >= 2)
            ? "26%"
            : hasOil || !hasData || hasMultiSeries
              ? "12%"
              : "4%"),
        bottom: xLabelRotate
          ? "18%"
          : (comparatorSeries && comparatorValuesForChart && hasOil) || (hasMultiSeries && multiSeries) || (hasOil && secondSeries && !comparatorSeries)
            ? "10%"
            : "3%",
        top: hasTopMacroCaptionRows ? "20%" : "10%",
        containLabel: true,
      },
      xAxis: useTimeAxis
        ? (() => {
            const spanDays = dateMax && dateMin ? (dateMax - dateMin) / 86400000 : 0;
            const isShortSpan = spanDays < 400;
            const dayMs = 86400000;
            const minIntervalMs = isShortSpan
              ? Math.max(dayMs, Math.ceil(spanDays / 6) * dayMs)
              : undefined;
            return {
              type: "time",
              min: dateMin,
              max: dateMax,
              minInterval: minIntervalMs,
              axisLine: { lineStyle: { color: borderColor } },
              axisLabel: {
                formatter: (value: number) =>
                  isShortSpan
                    ? new Date(value).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : formatChartTimeAxisYearLabel(value, axisYearMode),
                color: mutedFg,
                fontSize: 11,
              },
            };
          })()
        : (() => {
            const n = dates.length;
            const maxLabels = useSparseMultiSeriesDates ? 50 : 12;
            const useTimeLinearLabels =
              hasMultiSeries && !!timeRange && n > 12 && spanYears > 0;
            const timeLinearTickYears: number[] = useTimeLinearLabels
              ? (() => {
                  const stepFromProp =
                    categoryYearTickStep != null && categoryYearTickStep > 0
                      ? Math.floor(categoryYearTickStep)
                      : null;
                  const step =
                    stepFromProp ??
                    (() => {
                      const want = Math.min(10, Math.max(5, spanYears));
                      return Math.max(1, Math.round(spanYears / want));
                    })();
                  const out: number[] = [];
                  for (let y = firstYearNum; y <= lastYearNum; y += step) out.push(y);
                  if (out[out.length - 1] !== lastYearNum) out.push(lastYearNum);
                  return out;
                })()
              : [];
            const interval =
              useTimeLinearLabels
                ? 0
                : n <= maxLabels
                  ? 0
                  : Math.max(1, Math.floor(n / maxLabels));
            return {
              type: "category",
              data: dates,
              boundaryGap: false,
              axisLine: { lineStyle: { color: borderColor } },
              axisLabel: {
                color: mutedFg,
                fontSize: 11,
                rotate: xLabelRotate,
                interval,
                formatter: (value: string, index: number) => {
                  const yearStr = value.slice(0, 4);
                  const yearNum = parseInt(yearStr, 10);
                  if (useTimeLinearLabels) {
                    const prevYear = (dates[index - 1] ?? "").slice(0, 4);
                    if (index > 0 && prevYear === yearStr) return "";
                    if (!timeLinearTickYears.includes(yearNum)) return "";
                    return formatChartCategoryAxisYearLabel(value, axisYearMode);
                  }
                  const n2 = dates.length;
                  if (n2 > 365) {
                    if (categoryYearTickStep != null && categoryYearTickStep > 0 && !useTimeLinearLabels) {
                      const y = parseInt(yearStr, 10);
                      const yStart = parseInt((dates[0] ?? value).slice(0, 4), 10);
                      const step = Math.floor(categoryYearTickStep);
                      const rel = y - yStart;
                      const isLast = index === dates.length - 1;
                      if (rel % step !== 0 && !isLast) return "";
                    }
                    return formatChartCategoryAxisYearLabel(value, axisYearMode);
                  }
                  if (n2 <= 100 || useSparseMultiSeriesDates)
                    return formatChartCategoryAxisYearLabel(value, axisYearMode);
                  if (n2 > 60) return value.slice(0, 7);
                  return value;
                },
              },
            };
          })(),
      yAxis: hasMultiSeries && multiSeries
        ? (() => {
            const byIndex = new Map<number, ChartSeries[]>();
            for (const s of multiSeries) {
              const list = byIndex.get(s.yAxisIndex) ?? [];
              list.push(s);
              byIndex.set(s.yAxisIndex, list);
            }
            const sortedIndices = [...byIndex.keys()].sort((a, b) => a - b);
            const hasMultipleRight = multiSeries.filter((x) => x.yAxisIndex >= 1).length > 1;
            return sortedIndices.map((yAxisIndex) => {
              const seriesOnAxis = byIndex.get(yAxisIndex)!;
              const first = seriesOnAxis[0]!;
              const isLeft = yAxisIndex === 0;
              const isRight = yAxisIndex >= 1;
              const useLog = yAxisLog && isLeft;
              const rightOffset = hasMultipleRight && yAxisIndex === 2 ? 90 : 0;
              const allSameUnit = seriesOnAxis.length > 1 && seriesOnAxis.every((s) => s.unit === first.unit);
              const shortName =
                first.unit?.includes("toman")
                  ? seriesOnAxis.length > 1
                    ? "toman/USD (k)"
                    : `${first.label} (k)`
                  : first.unit === "USD/oz"
                    ? useLog
                      ? "Gold (USD/oz, log scale)"
                      : "Gold (USD/oz)"
                    : allSameUnit && first.unit
                      ? first.unit
                      : first.unit && first.label.includes(`(${first.unit})`)
                        ? first.label
                        : first.unit
                          ? `${first.label} (${first.unit})`
                          : first.label;
              const nameWithSuffix = yAxisNameSuffix ? `${shortName} ${yAxisNameSuffix}` : shortName;
              const axisTitle =
                multiSeriesYAxisNameOverrides?.[yAxisIndex] != null && multiSeriesYAxisNameOverrides[yAxisIndex] !== ""
                  ? multiSeriesYAxisNameOverrides[yAxisIndex]!
                  : nameWithSuffix;
              const isGoldLogAxis = useLog && first.unit === "USD/oz";
              const fixedRange =
                yAxisMin != null && yAxisMax != null && isLeft
                  ? { min: yAxisMin, max: yAxisMax }
                  : isGoldLogAxis
                    ? { min: 10, max: 3000 }
                    : {};
              return {
                type: (useLog ? "log" : "value") as "value" | "log",
                ...fixedRange,
                position: (isLeft ? "left" : "right") as "left" | "right",
                offset: isRight ? rightOffset : 0,
                name: axisTitle,
                nameLocation: "end" as const,
                nameTextStyle: { color: mutedFg, fontSize: 10 },
                nameGap: 12,
                axisLine: { show: false },
                splitLine: { show: isLeft, lineStyle: { color: borderColor, type: "dashed" as const } },
                axisLabel: {
                  color: mutedFg,
                  fontSize: 11,
                  ...(isGdpCompactMultiSeriesFormat(multiSeriesValueFormat) && first.unit
                    ? {
                        formatter: (v: number | string) => {
                          const n = typeof v === "number" ? v : Number(v);
                          return Number.isFinite(n) ? formatGdpLevelsAxisTick(n, first.unit) : String(v);
                        },
                      }
                    : first.unit?.includes("toman") &&
                        !first.unit.toLowerCase().includes("billion")
                      ? useLog
                        ? {
                            formatter: (v: number) =>
                              typeof v === "number" && v >= 1000
                                ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`
                                : String(v),
                          }
                        : {
                            formatter: (v: number) =>
                              typeof v === "number"
                                ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`
                                : String(v),
                          }
                      : {}),
                },
              };
            });
          })()
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
              type: (yAxisLog ? "log" : "value") as "value" | "log",
              position: "right" as const,
              name:
                useIndexed && indexBaseYear != null
                  ? `Index (base=${indexBaseYear})` + (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : "")
                  : (secondSeries?.label ?? "Brent oil") +
                    (secondSeries?.unit?.includes("toman") ? " (k toman/USD)" : secondSeries?.unit ? ` (${secondSeries.unit})` : "") +
                    (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : ""),
              nameTextStyle: { color: mutedFg, fontSize: 11 },
              nameGap: 8,
              axisLine: { show: false },
              splitLine: { show: false },
              axisLabel: {
                color: mutedFg,
                fontSize: 11,
                ...(secondSeries?.unit?.includes("toman") && !yAxisLog
                  ? {
                      formatter: (v: number) =>
                        typeof v === "number" ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k` : String(v),
                    }
                  : yAxisLog
                  ? {
                      formatter: (v: number) =>
                        typeof v === "number" && v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k` : String(v),
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
                data: useTimeAxis ? toTimeData(dates.map(() => null)) : dates.map(() => null),
                symbol: "none",
                emphasis: { focus: "none" as const },
                markLine:
                  markLineData.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        silent: false,
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: referenceLine.label ?? "" }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
                            : []),
                        ],
                      }
                    : undefined,
                markArea:
                  rangeBandData.length > 0 || sanctionsPeriods.length > 0
                    ? {
                        silent: false,
                        z: 0,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, 0.2),
                          borderWidth: 1,
                        },
                        data: [
                          ...regularBandData.map((r) =>
                            [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                          ),
                          ...presidentialBandData.map((r) =>
                            [
                              { xAxis: r.xStart, itemStyle: { color: withAlphaHsl(muted, PresidentialBandOpacity), borderColor: "transparent" } },
                              { xAxis: r.xEnd },
                            ] as [{ xAxis: string; itemStyle?: object }, { xAxis: string }]
                          ),
                          ...sanctionsPeriods
                            .map((p) => {
                              const startIdx = dates.findIndex((d) => d >= p.date_start);
                              const endIdx = dates.reduce((last, d, i) => (d <= p.date_end ? i : last), -1);
                              if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return null;
                              const xStart = dates[startIdx]!;
                              const xEnd = dates[endIdx]!;
                              return [
                                { xAxis: xStart, itemStyle: { color: withAlphaHsl(muted, SanctionsBandOpacity), borderColor: "transparent" } },
                                { xAxis: xEnd },
                              ] as [{ xAxis: string; itemStyle?: object }, { xAxis: string }];
                            })
                            .filter((x): x is [{ xAxis: string; itemStyle?: object }, { xAxis: string }] => x != null),
                        ],
                      }
                    : undefined,
              },
              ...multiSeries.map((s, i) => {
                const isGold = s.key === "gold";
                const isOil = s.key === "oil";
                const isProxy = s.key === "proxy";
                const isOfficial = s.key === "official";
                const isOpen = s.key === "open";
                const isSpread = s.key === "spread";
                const isWageNominal = s.key === "nominal";
                const isWageReal = s.key === "real";
                const isWageIndex = s.key === "index";
                const isProductionKey = s.key in productionColors;
                const isTotal = s.key === "total";
                const lineColor = s.color
                  ? s.color
                  : isProductionKey
                    ? productionColors[s.key]
                    : isGold
                      ? goldColor
                      : isOil
                        ? color
                        : isOfficial
                          ? color
                          : isOpen
                            ? chart2Color
                            : isSpread
                              ? oilColorMuted
                              : isWageNominal
                                ? color
                                : isWageReal
                                  ? chart2Color
                                  : isWageIndex
                                    ? oilColorMuted
                                    : oilColorMuted;
                const lineWidth = isGold || isOil || isProductionKey ? 1.5 : 1;
                const symbolSize = isGold ? 4 : isOil ? 3 : isProductionKey ? 3 : 2.5;
                const lineType = isTotal ? ("dashed" as const) : undefined;
                const symbol = isProductionKey
                  ? productionSymbols[s.key]
                  : isGold
                    ? "circle"
                    : isProxy || (s.yAxisIndex === 1 && !isWageIndex)
                      ? "diamond"
                      : isOfficial
                        ? "circle"
                        : isOpen
                          ? "diamond"
                          : isSpread
                            ? "triangle"
                            : isWageNominal
                              ? "circle"
                              : isWageReal
                                ? "diamond"
                                : isWageIndex
                                  ? "triangle"
                                  : "circle";
                return {
                  name: s.label,
                  type: "line" as const,
                  yAxisIndex: s.yAxisIndex,
                  data: useTimeAxis ? toTimeData(multiSeriesValues[i] ?? []) : (multiSeriesValues[i] ?? []),
                  smooth: false,
                  connectNulls: true,
                  step: (isGold ? "start" : false) as "start" | false,
                  symbol: symbol as "circle" | "diamond" | "triangle" | "roundRect",
                  symbolSize,
                  lineStyle: { color: lineColor, width: lineWidth, ...(lineType ? { type: lineType } : {}) },
                  itemStyle: { color: lineColor },
                  emphasis: {
                    focus: "none" as const,
                    lineStyle: { color: lineColor, width: lineWidth, ...(lineType ? { type: lineType } : {}) },
                    itemStyle: { color: lineColor },
                  },
                  markPoint:
                    showOilShocks && isOil && shockMarkPointData.length > 0
                      ? {
                          symbol: "circle",
                          symbolSize: 5,
                          itemStyle: { color: "rgba(180, 30, 30, 0.6)", borderWidth: 0, shadowBlur: 0 },
                          data: shockMarkPointData.map((d) => ({ name: "shock", coord: d.coord })),
                        }
                      : undefined,
                };
              }),
            ]
          : hasData
          ? [
              {
                name: label,
                type: "line" as const,
                data: useTimeAxis ? toTimeData(values) : values,
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
                  markLineData.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: referenceLine.label ?? "" }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
                            : []),
                        ],
                      }
                    : undefined,
                markPoint:
                  showOilShocks && shockMarkPointData.length > 0 && hasData
                    ? {
                        symbol: "circle",
                        symbolSize: 5,
                        itemStyle: { color: "rgba(180, 30, 30, 0.6)", borderWidth: 0, shadowBlur: 0 },
                        data: shockMarkPointData.map((d) => ({ name: "shock", coord: d.coord })),
                      }
                    : undefined,
                markArea:
                  rangeBandData.length > 0 || regimeArea
                    ? {
                        silent: true,
                        z: 0,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, 0.2),
                          borderWidth: 1,
                        },
                        data: [
                          ...regularBandData.map((r) =>
                            [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                          ),
                          ...presidentialBandData.map((r) =>
                            [
                              { xAxis: r.xStart, itemStyle: { color: withAlphaHsl(muted, PresidentialBandOpacity), borderColor: "transparent" } },
                              { xAxis: r.xEnd },
                            ] as [{ xAxis: string; itemStyle?: object }, { xAxis: string }]
                          ),
                          ...(regimeArea ? [[{ xAxis: regimeArea.xStart }, { xAxis: regimeArea.xEnd }] as [{ xAxis: string }, { xAxis: string }]] : []),
                        ],
                      }
                    : undefined,
              },
            ]
          : [
              {
                name: "events",
                type: "line" as const,
                yAxisIndex: hasOil ? 1 : 0,
                data: useTimeAxis ? toTimeData(dates.map(() => null)) : dates.map(() => null),
                symbol: "none",
                emphasis: { focus: "none" as const },
                markLine:
                  !hasOil && (markLineData.length > 0 || referenceLine)
                    ? {
                        symbol: "none",
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: referenceLine.label ?? "" }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
                            : []),
                        ],
                      }
                    : undefined,
                markArea:
                  rangeBandData.length > 0 || regimeArea
                    ? {
                        silent: true,
                        z: 0,
                        itemStyle: {
                          color: withAlphaHsl(muted, RangeBandOpacity),
                          borderColor: withAlphaHsl(muted, regimeArea ? 0.12 : 0.2),
                          borderWidth: 1,
                        },
                        data: [
                          ...regularBandData.map((r) =>
                            [{ xAxis: r.xStart }, { xAxis: r.xEnd }] as [{ xAxis: string }, { xAxis: string }]
                          ),
                          ...presidentialBandData.map((r) =>
                            [
                              { xAxis: r.xStart, itemStyle: { color: withAlphaHsl(muted, PresidentialBandOpacity), borderColor: "transparent" } },
                              { xAxis: r.xEnd },
                            ] as [{ xAxis: string; itemStyle?: object }, { xAxis: string }]
                          ),
                          ...(regimeArea
                            ? [
                                [
                                  {
                                    xAxis: regimeArea.xStart,
                                    itemStyle: { color: withAlphaHsl(muted, 0.04), borderColor: "transparent" },
                                    label: regimeArea.label ? { show: true, formatter: regimeArea.label, color: mutedFg, fontSize: 9, position: "insideTop" as const } : undefined,
                                  },
                                  { xAxis: regimeArea.xEnd },
                                ] as [{ xAxis: string; itemStyle?: object; label?: object }, { xAxis: string }],
                              ]
                            : []),
                        ],
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
                data: useTimeAxis ? toTimeData(oilValuesForChart) : oilValuesForChart,
                smooth: true,
                connectNulls: true,
                symbol: "circle",
                symbolSize: 3,
                lineStyle: {
                  color: comparatorSeries && comparatorValuesForChart ? color : oilColor,
                  width: 1.5,
                },
                itemStyle: {
                  color: comparatorSeries && comparatorValuesForChart ? color : oilColor,
                },
                emphasis: {
                  focus: "none" as const,
                  lineStyle: { color: comparatorSeries && comparatorValuesForChart ? color : oilColor },
                  itemStyle: { color: comparatorSeries && comparatorValuesForChart ? color : oilColor },
                },
                markPoint:
                  (showOilShocks && shockMarkPointData.length > 0) || (highlightLatestPoint && latestPointData)
                    ? {
                        symbol: "circle",
                        symbolSize: 5,
                        itemStyle: { color: "rgba(180, 30, 30, 0.6)", borderWidth: 0, shadowBlur: 0 },
                        data: [
                          ...(showOilShocks && shockMarkPointData.length > 0
                            ? shockMarkPointData.map((d) => ({ name: "shock", coord: d.coord }))
                            : []),
                          ...(highlightLatestPoint && latestPointData
                            ? [
                                {
                                  name: "latest",
                                  coord: latestPointData.coord,
                                  symbolSize: 4,
                                  itemStyle: {
                                    color: comparatorSeries && comparatorValuesForChart ? color : oilColor,
                                    borderColor: "#fff",
                                    borderWidth: 1,
                                  },
                                },
                              ]
                            : []),
                        ],
                      }
                    : undefined,
                markLine:
                  markLineData.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        silent: false,
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: referenceLine.label ?? "" }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
                            : []),
                        ],
                      }
                    : undefined,
              },
            ]
          : []),
        ...(comparatorSeries && comparatorValuesForChart && hasOil
          ? [
              {
                name: comparatorSeries.label,
                type: "line" as const,
                yAxisIndex: 1,
                data: useTimeAxis ? toTimeData(comparatorValuesForChart) : comparatorValuesForChart,
                smooth: true,
                connectNulls: true,
                symbol: "diamond",
                symbolSize: 2.5,
                lineStyle: { color: comparatorColor, width: 1.25 },
                itemStyle: { color: comparatorColor },
                emphasis: { focus: "none" as const, lineStyle: { color: comparatorColor }, itemStyle: { color: comparatorColor } },
              },
            ]
          : []),
      ],
    };

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (!cancelled && chartRef.current) {
        chart.setOption(option, { notMerge: true });
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
  }, [data, valueKey, label, unit, events, anchorEventId, oilPoints, secondSeries, multiSeries, multiSeriesValueFormat, multiSeriesYAxisNameOverrides, categoryYearTickStep, timeRange, mutedBands, yAxisLog, yAxisNameSuffix, mutedEventLines, referenceLine, regimeArea, useTimeRangeForDateAxis, comparatorSeries, indexComparator, sanctionsPeriods, oilShockDates, showOilShocks, gridRightOverride, xLabelRotate, extendedDates, lastOfficialDateForExtension, forceTimeRangeAxis, yAxisMin, yAxisMax, xAxisYearLabel]);

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

  return <div ref={chartRef} className={`chart-area ${chartHeight} w-full min-w-0`} />;
}

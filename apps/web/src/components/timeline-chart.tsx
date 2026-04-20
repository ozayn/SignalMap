"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";
import {
  type ChartRangeGranularity,
  inferChartRangeGranularityFromDates,
  normalizeChartRangeBound,
} from "@/lib/chart-study-range";
import { downloadEchartsRaster } from "@/lib/chart-export";
import { StudyChartControls } from "@/components/study-chart-controls";
import { timelineChartFaUi } from "@/lib/timeline-chart-fa";
import {
  CHART_Y_AXIS_LABEL_MARGIN,
  CHART_Y_AXIS_NAME_GAP,
  CHART_Y_AXIS_TICK_FONT_SIZE,
  chartYAxisNameTextStyle,
  formatYAxisNameMultiline,
} from "@/lib/chart-axis-label";
import {
  formatChartCategoryAxisYearLabel,
  formatChartTimeAxisYearLabel,
  formatChartTooltipYearLine,
  type ChartAxisYearMode,
} from "@/lib/chart-axis-year";
import {
  formatEconomicAxisTick,
  formatEconomicDisplay,
  formatGdpIndexedAxisTick,
  formatGdpIndexedTooltipValue,
  formatGdpLevelsAxisTick,
  formatGdpLevelsTooltipValue,
  formatMultiSeriesEconomicTooltipValue,
} from "@/lib/format-compact-decimal";
import { globalMacroOilMarkLineShortLabel } from "@/lib/timeline-global-macro-oil-labels";
import {
  COUNTRY_COMPARATOR_SERIES_COLORS,
  countryComparatorSeriesColor,
} from "@/lib/chart-country-series-colors";

/** GDP study: compact absolute values, indexed ratios, or nominal; `gdp_levels` kept as alias. */
function isGdpCompactMultiSeriesFormat(fmt?: string): boolean {
  return fmt === "gdp_levels" || fmt === "gdp_absolute" || fmt === "gdp_indexed";
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
  /** X-axis tick year: Gregorian (default), Iranian (Solar Hijri), or both; display only. */
  xAxisYearLabel?: ChartAxisYearMode;
  /** Per-chart date range + PNG export toolbar (study pages). */
  showChartControls?: boolean;
  /** Range picker resolution; when omitted, inferred from point spacing in the series. */
  chartRangeGranularity?: ChartRangeGranularity;
  /** Download filename stem for PNG export (sanitized); defaults to `label`. */
  exportFileStem?: string;
  /** When set with dense category axes, show a year label about every N calendar years (Gregorian year index; Jalali label still applies). */
  categoryYearTickStep?: number;
  /** Compact USD / bn-toman tooltips and y-axis ticks (GDP composition absolute-value charts). */
  multiSeriesValueFormat?: "gdp_levels" | "gdp_absolute" | "gdp_indexed";
  /** When ``multiSeriesValueFormat`` is ``gdp_indexed``, label for tooltips (e.g. Gregorian ``2015`` or Solar year). */
  indexedTooltipBaseLabel?: string;
  /** Override multi-series y-axis titles (key = ``yAxisIndex``), e.g. dual-axis reference layouts. */
  multiSeriesYAxisNameOverrides?: Partial<Record<number, string>>;
  /** FA: tooltip chrome + LTR wrapper; series names still come from props (pass Persian labels from the page). */
  chartLocale?: "en" | "fa";
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
const MIN_LABEL_GAP_YEARS = 4;

/** Minimum years between shown **vertical** global oil / macro captions (lines always draw). */
const MIN_VERTICAL_LABEL_GAP_YEARS = 5;

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

/** Annual / multi-country: match on calendar year only (points are often YYYY-01-01; axis ticks may use YYYY-07-01). */
function valueAtDateSameCalendarYear(
  points: { date: string; value: number }[],
  date: string
): number | null {
  const y = date.slice(0, 4);
  for (const p of points) {
    if (p.date.slice(0, 4) === y && Number.isFinite(p.value)) return p.value;
  }
  return null;
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
  timeRange: timeRangeProp,
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
  showChartControls = true,
  chartRangeGranularity: chartRangeGranularityProp,
  exportFileStem,
  multiSeriesValueFormat,
  indexedTooltipBaseLabel,
  multiSeriesYAxisNameOverrides,
  chartLocale,
}: TimelineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [xLabelRotate, setXLabelRotate] = useState(0);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");

  const rangeBounds = useMemo((): [string, string] | undefined => {
    if (timeRangeProp?.[0] && timeRangeProp[1]) {
      return [
        normalizeChartRangeBound(timeRangeProp[0], false),
        normalizeChartRangeBound(timeRangeProp[1], true),
      ];
    }
    const collected: string[] = [];
    for (const p of data) collected.push(p.date.slice(0, 10));
    for (const p of oilPoints) collected.push(p.date.slice(0, 10));
    if (secondSeries) for (const p of secondSeries.points) collected.push(p.date.slice(0, 10));
    if (multiSeries) for (const s of multiSeries) for (const p of s.points) collected.push(p.date.slice(0, 10));
    if (comparatorSeries) for (const p of comparatorSeries.points) collected.push(p.date.slice(0, 10));
    if (collected.length === 0) return undefined;
    collected.sort();
    return [collected[0]!, collected[collected.length - 1]!];
  }, [timeRangeProp, data, oilPoints, secondSeries, multiSeries, comparatorSeries]);

  const chartRange = useMemo((): [string, string] | undefined => {
    if (!showChartControls) return rangeBounds;
    if (!rangeBounds) return undefined;
    let [a, b] = rangeBounds;
    if (clipStart) {
      const c = clipStart.slice(0, 10);
      if (c > a) a = c;
    }
    if (clipEnd) {
      const c = clipEnd.slice(0, 10);
      if (c < b) b = c;
    }
    if (a > b) {
      return [b, a];
    }
    return [a, b];
  }, [showChartControls, rangeBounds, clipStart, clipEnd]);

  const inferredChartRangeGranularity = useMemo((): ChartRangeGranularity => {
    const samples: string[] = [];
    for (const p of data) samples.push(p.date);
    for (const p of oilPoints) samples.push(p.date);
    if (secondSeries) for (const p of secondSeries.points) samples.push(p.date);
    if (multiSeries) for (const s of multiSeries) for (const p of s.points) samples.push(p.date);
    if (comparatorSeries) for (const p of comparatorSeries.points) samples.push(p.date);
    return inferChartRangeGranularityFromDates(samples);
  }, [data, oilPoints, secondSeries, multiSeries, comparatorSeries]);

  const rangeInputGranularity = chartRangeGranularityProp ?? inferredChartRangeGranularity;

  useEffect(() => {
    setClipStart("");
    setClipEnd("");
  }, [rangeBounds?.[0], rangeBounds?.[1]]);

  const handleExportPng = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const backgroundColor = cssHsl("--background", "hsl(0, 0%, 100%)");
    const stem = exportFileStem ?? label;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          chart.resize();
          downloadEchartsRaster(chart, "png", stem, backgroundColor);
        } catch {
          // Instance may be disposed mid-frame
        }
      });
    });
  }, [exportFileStem, label]);

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
      us: COUNTRY_COMPARATOR_SERIES_COLORS.us,
      saudi: "hsl(142, 55%, 38%)",
      russia: "hsl(0, 60%, 50%)",
      iran: COUNTRY_COMPARATOR_SERIES_COLORS.iran,
      total: "hsl(0, 0%, 55%)",
    };
    const productionSymbols: Record<string, "circle" | "diamond" | "triangle" | "roundRect"> = {
      us: "circle",
      saudi: "diamond",
      russia: "triangle",
      iran: "roundRect",
      total: "circle",
    };

    const timeRange = chartRange ?? timeRangeProp;
    const rangeLo =
      timeRange?.[0] != null && String(timeRange[0]).trim() !== ""
        ? normalizeChartRangeBound(timeRange[0], false).slice(0, 10)
        : "";
    const rangeHi =
      timeRange?.[1] != null && String(timeRange[1]).trim() !== ""
        ? normalizeChartRangeBound(timeRange[1], true).slice(0, 10)
        : "";

    const oilPointsSource = secondSeries?.points ?? oilPoints;
    const oilPointsResolved =
      rangeLo && rangeHi
        ? oilPointsSource.filter((p) => {
            const d = p.date.slice(0, 10);
            return d >= rangeLo && d <= rangeHi;
          })
        : oilPointsSource;

    const hasData = data.length > 0;
    const dataResolved =
      hasData && rangeLo && rangeHi
        ? data.filter((d) => {
            const ds = d.date.slice(0, 10);
            return ds >= rangeLo && ds <= rangeHi;
          })
        : data;

    const ui = timelineChartFaUi(chartLocale);
    const yAxisNameStyle = chartYAxisNameTextStyle(mutedFg);
    const yAxisTickLabelBase = {
      color: mutedFg,
      fontSize: CHART_Y_AXIS_TICK_FONT_SIZE,
      margin: CHART_Y_AXIS_LABEL_MARGIN,
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

    const hasOil = oilPointsResolved.length > 0;
    const hasMultiSeries = multiSeries != null && multiSeries.length > 0;
    const multiSeriesCount = hasMultiSeries ? multiSeries!.length : 0;
    /** Many country/series names: scrollable legend + extra bottom margin to reduce overlap. */
    const legendUseScroll = hasMultiSeries && multiSeriesCount >= 4;
    const legendTextFontSize = legendUseScroll ? 12 : 11;
    const comparatorResolved = comparatorSeries
      ? {
          ...comparatorSeries,
          points:
            rangeLo && rangeHi
              ? comparatorSeries.points.filter((p) => {
                  const d = p.date.slice(0, 10);
                  return d >= rangeLo && d <= rangeHi;
                })
              : comparatorSeries.points,
        }
      : null;
    const useTimeRangeForAxis = (mutedBands || hasMultiSeries) && timeRange && timeRange[0] && timeRange[1];
    const hasFallback = !hasData && (hasOil || hasMultiSeries || (timeRangeProp && events.length > 0));
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
      hasMultiSeries &&
      allMultiSeriesDates.length > 0 &&
      (allMultiSeriesDates.length <= 50 || chartRangeGranularityProp === "year") &&
      timeRange;
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
      ? dataResolved.map((d) => d.date)
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
      const [, rangeEnd] = timeRange;
      const lastYear = dates[dates.length - 1]!.slice(0, 4);
      if (lastYear < rangeEnd.slice(0, 4)) dates = [...dates.filter((d) => d < rangeEnd), rangeEnd].sort();
    }
    const values = hasData ? dataResolved.map((d) => d[valueKey] as number) : [];

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
    const comparatorByDate = comparatorResolved
      ? new Map(comparatorResolved.points.map((p) => [p.date, p.value]))
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

    const useIndexed = indexComparator && comparatorResolved && comparatorValues && hasOil;
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

    const valueFn = useYearlyMultiSeries
      ? valueAtDateSameCalendarYear
      : mutedBands || (hasMultiSeries && useUnionDates) || (hasMultiSeries && timeRange)
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
                    ? valueFn(dataResolved, dateStr)
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
                fontSize: 12,
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
                fontSize: 12,
                color: mutedFg,
                distance: 4,
                position: "end" as const,
                offset: [0, offsetY] as [number, number],
                rotate: 0,
              }
            : {
                show: false,
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
      ...(showChartControls
        ? {
            title: {
              text: label,
              left: "center",
              top: 2,
              textStyle: { fontSize: 13, color: mutedFg, fontWeight: 600 },
            },
          }
        : {}),
      emphasis: { focus: "none" as const },
      ...(comparatorResolved && comparatorValuesForChart && hasOil
        ? {
            legend: {
              show: true,
              type: "plain",
              bottom: 4,
              left: "center",
              itemGap: 16,
              textStyle: { color: mutedFg, fontSize: legendTextFontSize },
              data: [secondSeries?.label ?? "Iran (PPP)", comparatorResolved.label],
            },
          }
        : hasMultiSeries && multiSeries
          ? {
              legend: {
                show: true,
                type: legendUseScroll ? ("scroll" as const) : ("plain" as const),
                bottom: 2,
                left: "center",
                width: "88%",
                itemGap: legendUseScroll ? 20 : 16,
                textStyle: { color: mutedFg, fontSize: legendTextFontSize },
                pageTextStyle: { color: mutedFg, fontSize: 11 },
                pageIconSize: legendUseScroll ? 12 : 10,
                data: multiSeries.map((s) => s.label),
              },
            }
          : hasOil && secondSeries && !comparatorResolved
            ? {
                legend: {
                  show: true,
                  type: "plain",
                  bottom: 4,
                  left: "center",
                  itemGap: 16,
                  textStyle: { color: mutedFg, fontSize: legendTextFontSize },
                  data: hasData ? [label, secondSeries.label] : [secondSeries?.label ?? "Brent oil"],
                },
              }
            : {}),
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        confine: true,
        extraCssText: "max-width: 380px; overflow-wrap: break-word; word-wrap: break-word; white-space: normal; font-size: 13px;",
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
            lines.push(`<span style="font-size:10px;color:#888">${ui.sanctionsPeriod}</span>`);
            lines.push(`<span style="font-weight:600">${sanctionsBand.title}</span>`);
            lines.push(`${sanctionsBand.date_start} — ${sanctionsBand.date_end}`);
            lines.push(`${chartLocale === "fa" ? "دامنه" : "Scope"}: ${sanctionsBand.scope ?? ui.scopeOilExports}`);
            lines.push("—");
          }
          if (ev) {
            if (eventUsesMacroMarkLineStyle(ev)) {
              const mt = ev.type === "political" || ev.type === "war" || ev.type === "sanctions" ? ev.type : "";
              const mtLabel =
                mt === "political"
                  ? ui.political
                  : mt === "war"
                    ? ui.warSecurity
                    : mt === "sanctions"
                      ? ui.sanctions
                      : ui.macroContext;
              lines.push(`<span style="font-size:10px;color:#888">${mtLabel}</span>`);
              lines.push(`<span style="font-weight:600">${ev.title}</span>`);
              if (ev.date) lines.push(ev.date);
              if (ev.description) lines.push(ev.description);
            } else if (rangeBand && isPresidentialEvent(ev)) {
              lines.push(`<span style="font-size:10px;color:#888">${ui.presidentialTerm}</span>`);
              lines.push(`<span style="font-weight:600">${ev.title}</span> ${ev.date_start} — ${ev.date_end}`);
            } else {
              const scope = getEventScope(ev);
              const scopeLabel =
                scope === "sanctions" ? ui.scopeSanctions : scope === "world" ? ui.scopeWorld : ui.scopeIran;
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
                        const label = urlSources.length > 1 ? ui.sourceN(i) : ui.source;
                        return `<a href="${url}" target="_blank" rel="noopener" style="color:#6b9dc7;font-size:11px">${label}</a>`;
                      })
                      .join(" • ")
                  );
                }
                if (textSources.length) {
                  parts.push(`${ui.sourcesPrefix}: ${textSources.join(", ")}`);
                }
                lines.push(parts.join(" • "));
              }
              const scopeForConfidence = ev.scope ?? (ev.layer === "world_core" || ev.layer === "world_1900" ? "world" : ev.layer === "sanctions" ? "sanctions" : "iran");
              if (ev.confidence && scopeForConfidence !== "sanctions")
                lines.push(`${ui.confidence}: ${ev.confidence}`);
            }
            lines.push("—");
          }
          lines.push(
            formatChartTooltipYearLine(dateStr, axisYearMode, chartLocale === "fa" ? "fa" : "en")
          );
          const pt = hasData && idx < dataResolved.length ? dataResolved[idx] : null;
          if (pt) {
            const val = pt[valueKey];
            const num = typeof val === "number" ? val : val != null ? Number(val) : NaN;
            const valDisp =
              val == null || (typeof val !== "number" && (typeof val !== "string" || val === ""))
                ? "—"
                : Number.isFinite(num)
                  ? `${formatMultiSeriesEconomicTooltipValue(num, unit ?? "")}${unit ? ` ${unit}` : ""}`
                  : String(val);
            lines.push(`${label}: ${valDisp}`);
            if (pt.confidence != null) {
              lines.push(`${ui.confidence}: ${(pt.confidence * 100).toFixed(0)}%`);
            }
          }
          if (hasMultiSeries && multiSeries && multiSeriesValues) {
            multiSeries.forEach((s, i) => {
              const val = multiSeriesValues[i]?.[idx];
              const formatted =
                val != null
                  ? isGdpCompactMultiSeriesFormat(multiSeriesValueFormat)
                    ? multiSeriesValueFormat === "gdp_indexed" && indexedTooltipBaseLabel
                      ? formatGdpIndexedTooltipValue(Number(val), indexedTooltipBaseLabel)
                      : formatGdpLevelsTooltipValue(Number(val), s.unit)
                    : (() => {
                        const core = formatMultiSeriesEconomicTooltipValue(Number(val), s.unit);
                        const u = s.unit ?? "";
                        if (u.includes("%")) return u.trim().startsWith("%") ? `${core}${u}` : `${core} ${u}`;
                        return `${core} ${u}`;
                      })()
                  : "—";
              lines.push(`${s.label}: ${formatted}`);
            });
            if (extendedDates.includes(dateStr) && lastOfficialDateForExtension) {
              lines.push(
                `<span style="font-size:10px;color:#888">${ui.estimatedExtension(lastOfficialDateForExtension)}</span>`
              );
            }
          } else if (hasOil) {
            const oilVal = oilValuesForChart[idx];
            const unit = secondSeries?.unit ?? "USD/barrel";
            const lbl = secondSeries?.label ?? "Brent oil";
            const isIndexed = useIndexed && indexBaseYear != null;
            const formatted =
              oilVal != null
                ? isIndexed
                  ? `${oilVal.toFixed(1)} (${ui.indexed})`
                  : unit.includes("toman")
                    ? `${formatEconomicDisplay(Math.round((oilVal / 1000) * 10) / 10, { maximumFractionDigits: 1, minimumFractionDigits: 0 })}k ${unit}`
                    : `${formatMultiSeriesEconomicTooltipValue(oilVal, unit)} ${unit}`
                : "—";
            lines.push(`${lbl}: ${formatted}`);
            if (comparatorValuesForChart && comparatorResolved) {
              const compVal = comparatorValuesForChart[idx];
              const compFormatted =
                compVal != null
                  ? isIndexed
                    ? `${compVal.toFixed(1)} (${ui.indexed})`
                    : `${formatMultiSeriesEconomicTooltipValue(Number(compVal), secondSeries?.unit ?? "")}`
                  : "—";
              lines.push(`${comparatorResolved.label}: ${compFormatted}`);
            }
          }
          return lines.join("<br/>");
        },
      },
      grid: {
        left: hasMultiSeries ? "12%" : "3%",
        right:
          gridRightOverride ??
          (hasMultiSeries && multiSeries && multiSeries.some((s) => s.yAxisIndex >= 2)
            ? "28%"
            : hasOil || !hasData || hasMultiSeries
              ? "14%"
              : "4%"),
        bottom: xLabelRotate
          ? "18%"
          : (comparatorResolved && comparatorValuesForChart && hasOil) || (hasMultiSeries && multiSeries) || (hasOil && secondSeries && !comparatorResolved)
            ? legendUseScroll
              ? "17%"
              : "12%"
            : "3%",
        top: hasTopMacroCaptionRows ? (showChartControls ? "24%" : "20%") : showChartControls ? "16%" : "10%",
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
                fontSize: 12,
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
                fontSize: 12,
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
                  : multiSeriesValueFormat === "gdp_indexed" && yAxisMin != null
                    ? { min: yAxisMin }
                    : isGoldLogAxis
                      ? { min: 10, max: 3000 }
                      : {};
              return {
                type: (useLog ? "log" : "value") as "value" | "log",
                ...fixedRange,
                position: (isLeft ? "left" : "right") as "left" | "right",
                offset: isRight ? rightOffset : 0,
                name: formatYAxisNameMultiline(axisTitle),
                nameLocation: "end" as const,
                nameTextStyle: yAxisNameStyle,
                nameGap: CHART_Y_AXIS_NAME_GAP,
                axisLine: { show: false },
                splitLine: { show: isLeft, lineStyle: { color: borderColor, type: "dashed" as const } },
                axisLabel: {
                  ...yAxisTickLabelBase,
                  ...(isGdpCompactMultiSeriesFormat(multiSeriesValueFormat) &&
                  (first.unit || multiSeriesValueFormat === "gdp_indexed")
                    ? {
                        formatter: (v: number | string) => {
                          const n = typeof v === "number" ? v : Number(v);
                          if (!Number.isFinite(n)) return String(v);
                          if (multiSeriesValueFormat === "gdp_indexed") return formatGdpIndexedAxisTick(n);
                          return formatGdpLevelsAxisTick(n, first.unit);
                        },
                      }
                    : first.unit?.includes("%") &&
                        !isGdpCompactMultiSeriesFormat(multiSeriesValueFormat)
                      ? {
                          formatter: (v: number | string) => {
                            const n = typeof v === "number" ? v : Number(v);
                            if (!Number.isFinite(n)) return String(v);
                            const r = Math.round(n * 10) / 10;
                            return Math.abs(r - Math.round(r)) < 1e-6 ? `${Math.round(r)}%` : `${r.toFixed(1)}%`;
                          },
                        }
                      : first.unit?.includes("toman") &&
                          !first.unit.toLowerCase().includes("billion")
                        ? useLog
                          ? {
                              formatter: (v: number) =>
                                typeof v === "number" && v >= 1000
                                  ? `${formatEconomicDisplay(Math.round(v / 1000), { maximumFractionDigits: 0, minimumFractionDigits: 0 })}k`
                                  : String(v),
                            }
                          : {
                              formatter: (v: number) =>
                                typeof v === "number"
                                  ? `${formatEconomicDisplay(Math.round(v / 1000), { maximumFractionDigits: 0, minimumFractionDigits: 0 })}k`
                                  : String(v),
                            }
                        : {
                            formatter: (v: number | string) => {
                              const n = typeof v === "number" ? v : Number(v);
                              return Number.isFinite(n) ? formatEconomicAxisTick(n) : String(v);
                            },
                          }),
                },
              };
            });
          })()
        : hasOil || !hasData
        ? [
            {
              type: "value" as const,
              position: "left" as const,
              name: formatYAxisNameMultiline(
                (hasData ? label : secondSeries?.label ?? "Brent oil") + (unit ? ` (${unit})` : "")
              ),
              nameLocation: "end" as const,
              nameTextStyle: yAxisNameStyle,
              nameGap: CHART_Y_AXIS_NAME_GAP,
              axisLine: { show: false },
              splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
              axisLabel: {
                ...yAxisTickLabelBase,
                formatter: (v: number | string) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return Number.isFinite(n) ? formatEconomicAxisTick(n) : String(v);
                },
              },
              show: hasData,
            },
            {
              type: (yAxisLog ? "log" : "value") as "value" | "log",
              position: "right" as const,
              name: formatYAxisNameMultiline(
                useIndexed && indexBaseYear != null
                  ? `Index (base=${indexBaseYear})` + (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : "")
                  : (secondSeries?.label ?? "Brent oil") +
                      (secondSeries?.unit?.includes("toman") ? " (k toman/USD)" : secondSeries?.unit ? ` (${secondSeries.unit})` : "") +
                      (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : "")
              ),
              nameLocation: "end" as const,
              nameTextStyle: yAxisNameStyle,
              nameGap: CHART_Y_AXIS_NAME_GAP,
              axisLine: { show: false },
              splitLine: { show: false },
              axisLabel: {
                ...yAxisTickLabelBase,
                ...(secondSeries?.unit?.includes("toman") && !yAxisLog
                  ? {
                      formatter: (v: number) =>
                        typeof v === "number"
                          ? `${formatEconomicDisplay(Math.round(v / 1000), { maximumFractionDigits: 0, minimumFractionDigits: 0 })}k`
                          : String(v),
                    }
                  : yAxisLog
                    ? {
                        formatter: (v: number) =>
                          typeof v === "number" && v >= 1000
                            ? `${formatEconomicDisplay(Math.round(v / 1000), { maximumFractionDigits: 0, minimumFractionDigits: 0 })}k`
                            : typeof v === "number"
                              ? formatEconomicAxisTick(v)
                              : String(v),
                      }
                    : {
                        formatter: (v: number) => (typeof v === "number" ? formatEconomicAxisTick(v) : String(v)),
                      }),
              },
            },
          ]
        : {
            type: "value",
            name: formatYAxisNameMultiline(label),
            nameLocation: "end" as const,
            nameTextStyle: yAxisNameStyle,
            nameGap: CHART_Y_AXIS_NAME_GAP,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
            axisLabel: {
              ...yAxisTickLabelBase,
              formatter: (v: number | string) => {
                const n = typeof v === "number" ? v : Number(v);
                return Number.isFinite(n) ? formatEconomicAxisTick(n) : String(v);
              },
            },
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
                const comparatorCountryColor = countryComparatorSeriesColor(s.key);
                const lineColor = s.color
                  ? s.color
                  : comparatorCountryColor != null
                    ? comparatorCountryColor
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
                  color: comparatorResolved && comparatorValuesForChart ? color : oilColor,
                  width: 1.5,
                },
                itemStyle: {
                  color: comparatorResolved && comparatorValuesForChart ? color : oilColor,
                },
                emphasis: {
                  focus: "none" as const,
                  lineStyle: { color: comparatorResolved && comparatorValuesForChart ? color : oilColor },
                  itemStyle: { color: comparatorResolved && comparatorValuesForChart ? color : oilColor },
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
                                    color: comparatorResolved && comparatorValuesForChart ? color : oilColor,
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
        ...(comparatorResolved && comparatorValuesForChart && hasOil
          ? [
              {
                name: comparatorResolved.label,
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
  }, [
    data,
    valueKey,
    label,
    unit,
    events,
    anchorEventId,
    oilPoints,
    secondSeries,
    multiSeries,
    multiSeriesValueFormat,
    indexedTooltipBaseLabel,
    multiSeriesYAxisNameOverrides,
    categoryYearTickStep,
    timeRangeProp,
    chartRange,
    chartRangeGranularityProp,
    showChartControls,
    mutedBands,
    yAxisLog,
    yAxisNameSuffix,
    mutedEventLines,
    referenceLine,
    regimeArea,
    useTimeRangeForDateAxis,
    comparatorSeries,
    indexComparator,
    sanctionsPeriods,
    oilShockDates,
    showOilShocks,
    gridRightOverride,
    xLabelRotate,
    extendedDates,
    lastOfficialDateForExtension,
    forceTimeRangeAxis,
    forceTimeAxis,
    highlightLatestPoint,
    yAxisMin,
    yAxisMax,
    xAxisYearLabel,
    chartLocale,
  ]);

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

  const showToolbar = showChartControls && !!rangeBounds;
  const chartLocaleResolved = chartLocale ?? "en";

  const inner = (
    <div className="min-w-0 space-y-2">
      {showToolbar ? (
        <StudyChartControls
          minDate={rangeBounds[0]}
          maxDate={rangeBounds[1]}
          startValue={clipStart}
          endValue={clipEnd}
          onStartChange={setClipStart}
          onEndChange={setClipEnd}
          onExportPng={handleExportPng}
          granularity={rangeInputGranularity}
        />
      ) : null}
      <div ref={chartRef} className={`chart-area ${chartHeight} w-full min-w-0`} />
    </div>
  );

  if (chartLocaleResolved === "fa") {
    return (
      <div className="min-w-0" dir="ltr" lang="en">
        {inner}
      </div>
    );
  }

  return inner;
}

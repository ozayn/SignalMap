"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as echarts from "echarts";
import { cssHsl, withAlphaHsl } from "@/lib/utils";
import {
  type ChartRangeGranularity,
  normalizeChartRangeBound,
} from "@/lib/chart-study-range";
import {
  buildEventOverlay,
  findTimeSeriesEventCategoryIndex,
  findTimeSeriesEventRangeCategoryIndices,
  resolveTimeSeriesEventAlignToCalendarYearBucket,
} from "@/lib/time-series-event-overlay";
import {
  downloadEchartsRaster,
  slugifyChartFilename,
  type DownloadEchartsRasterOptions,
} from "@/lib/chart-export";
import { buildStudyChartExportFilenameStem } from "@/lib/chart-export-filename";
import { useStudyChartExportFilenameContext } from "@/components/study-chart-export-filename-context";
import { buildPresentationExportTitle, formatStudyExportSourceLine } from "@/lib/chart-export-presentation";
import { StudyChartControls } from "@/components/study-chart-controls";
import { timelineChartFaUi } from "@/lib/timeline-chart-fa";
import {
  CHART_Y_AXIS_LABEL_MARGIN,
  CHART_Y_AXIS_NAME_GAP,
  CHART_Y_AXIS_TICK_FONT_SIZE,
  chartYAxisNameTextStyle,
  formatYAxisNameMultiline,
} from "@/lib/chart-axis-label";
import { nicePercentShareAxisRange } from "@/lib/chart-axis-nice";
import {
  formatChartCategoryAxisYearLabel,
  formatChartTimeAxisYearLabel,
  formatChartTooltipYearLine,
  getChartAxisYearDisplayParts,
  type ChartAxisYearMode,
} from "@/lib/chart-axis-year";
import {
  formatChartTooltipNumber,
  formatEconomicAxisTick,
  formatEconomicDisplay,
  formatGdpIndexedAxisTick,
  formatGdpIndexedTooltipValue,
  formatGdpLevelsAxisTick,
  formatGdpLevelsTooltipValue,
  formatMultiSeriesEconomicTooltipValue,
} from "@/lib/format-compact-decimal";
import { globalMacroOilMarkLineShortLabel } from "@/lib/timeline-global-macro-oil-labels";
import { type ComparatorLineSymbol, countryComparatorSeriesStyle } from "@/lib/chart-country-series-styles";
import {
  isOilProductionVolumeKey,
  resolveTimelineMultiSeriesColors,
} from "@/lib/signalmap-chart-colors";
import { localizeChartNumericDisplayString, localizeChartNumericDisplayStringSafe } from "@/lib/chart-numerals-fa";
import {
  CHART_LINE_SYMBOL_ITEM_OPACITY,
  CHART_LINE_SYMBOL_SIZE,
  CHART_LINE_SYMBOL_SIZE_COMPACT,
  CHART_LINE_SYMBOL_SIZE_MINI,
} from "@/lib/chart-series-markers";
import {
  STUDY_CHART_LEGEND_FONT_PX,
  STUDY_CHART_SOURCE_WRAP_CLASS,
  STUDY_CHART_STACK_GAP_CLASS,
  STUDY_CHART_TITLE_WRAP_CLASS,
} from "@/lib/chart-study-typography";

const MULTI_SERIES_FALLBACK_LEGEND_ICONS: Array<"circle" | "diamond" | "triangle" | "rect"> = [
  "circle",
  "diamond",
  "triangle",
  "rect",
];

/** Toman/USD (or FA «تومان/دلار») — used for log-axis min + non-positive sanitization. */
function isTomanFxUnit(unit: string | undefined): boolean {
  if (!unit) return false;
  if (/toman/i.test(unit)) return true;
  return unit.includes("تومان");
}

type LegendEndShape = ComparatorLineSymbol;

/**
 * Legend entry icon: short line segment + small end marker (same geometry as series symbol),
 * instead of a large filled-only shape. Coordinates ~0–22 × 0–12; ECharts scales to ``itemWidth`` / ``itemHeight``.
 */
function multiSeriesLegendLineMarkerPathD(shape: LegendEndShape): string {
  const line = "M0.3,5.45L12.8,5.45L12.8,6.65L0.3,6.65Z";
  let glyph = "";
  switch (shape) {
    case "circle":
      glyph = "M16.2,6m-2.35,0a2.35,2.35,0,1,1,4.71,0a2.35,2.35,0,1,1,-4.71,0";
      break;
    case "rect":
      glyph = "M14.35,3.85H18.75V8.15H14.35Z";
      break;
    case "diamond":
      glyph = "M16.5,3.55L19.65,6L16.5,8.45L13.35,6Z";
      break;
    case "triangle":
      glyph = "M16.5,3.65L19.85,8.35H13.15Z";
      break;
    case "roundRect":
      glyph = "M14.1,4.1H18.9A1.05,1.05,0,0,1,19.95,5.15V6.85A1.05,1.05,0,0,1,18.9,7.9H14.1A1.05,1.05,0,0,1,13.05,6.85V5.15A1.05,1.05,0,0,1,14.1,4.1Z";
      break;
    case "arrow":
      // Small right-pointing chevron (same visual weight as other end glyphs).
      glyph = "M13.35,4.15L18.85,6L13.35,7.85V6.72L16.55,6L13.35,5.28Z";
      break;
    default:
      glyph = "M16.2,6m-2.35,0a2.35,2.35,0,1,1,4.71,0a2.35,2.35,0,1,1,-4.71,0";
  }
  return `${line}${glyph}`;
}

function multiSeriesLegendLineMarkerPath(shape: LegendEndShape): string {
  return `path://${multiSeriesLegendLineMarkerPathD(shape)}`;
}

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
  /** ECharts line symbol for this series (legend + line). */
  symbol?: LegendEndShape;
  symbolSize?: number;
};

export type ChartSeries = {
  key: string;
  label: string;
  yAxisIndex: 0 | 1 | 2;
  unit: string;
  points: { date: string; value: number }[];
  /** Optional line/symbol color (CSS color string). */
  color?: string;
  /** ECharts line symbol; overrides key-based defaults when set. */
  symbol?: LegendEndShape;
  symbolSize?: number;
  /** Line width in px (multi-series). When unset, chart picks default widths. */
  lineWidth?: number;
  /** When false, hides point markers along the line (line-only). */
  showSymbol?: boolean;
  /** ECharts ``lineStyle.type`` for multi-series (e.g. dashed exports vs solid imports). */
  linePattern?: "solid" | "dashed" | "dotted";
  /**
   * With ``multiSeriesLegendLayout="grouped"``: row label (e.g. country) and column header (e.g. Imports)
   * for a table-style legend above the chart.
   */
  legendGroup?: string;
  legendMetric?: string;
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
  /**
   * Brent / global oil price chart: narrative-first layout (major vertical markers by default,
   * staggered rotated labels, thicker price line, larger axis type).
   */
  oilPublicationLayout?: boolean;
  /** With ``oilPublicationLayout``: ``story`` = only ``global_macro_oil`` (+ anchor) verticals; ``data`` = all point events. */
  oilEventDensity?: "story" | "data";
  /** Single-series line styling (e.g. companion daily return chart). */
  chartLineRole?: "primary" | "secondary";
  /** Horizontal reference line (value on y-axis). */
  referenceLine?: { value: number; label?: string };
  /** Lightly shaded band for a descriptive period (e.g. approximate structural break). */
  regimeArea?: { xStart: string; xEnd: string; label?: string };
  /** Use timeRange for date axis when band overlays (e.g. presidential terms) need full range. Use for dense/short-range data (e.g. FX). */
  useTimeRangeForDateAxis?: boolean;
  /** Comparator series on same axis as secondSeries (e.g. Turkey PPP). Thinner, muted. */
  comparatorSeries?: {
    label: string;
    points: { date: string; value: number }[];
    symbol?: LegendEndShape;
    symbolSize?: number;
  };
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
  /**
   * If `showChartControls` is false and the chart has range bounds, still show Export PNG only (no range pickers here).
   * Set to false to hide export.
   * @default true
   */
  showPngExportWhenRangeHidden?: boolean;
  /** Range picker resolution; when omitted, inferred from point spacing in the series. */
  chartRangeGranularity?: ChartRangeGranularity;
  /** Download filename stem for PNG export (sanitized); defaults to `label`. */
  exportFileStem?: string;
  /** Full source line appended below the chart in PNG export only (e.g. `Source: World Bank`). */
  exportSourceFooter?: string;
  /** Overrides auto-generated presentation title (export only). */
  exportPresentationTitle?: string;
  /** Study / page heading for auto title: `Heading — metric (years)`. */
  exportPresentationStudyHeading?: string;
  /** When set with dense category axes, show a year label about every N calendar years (Gregorian year index; Jalali label still applies). */
  categoryYearTickStep?: number;
  /** Compact USD / bn-toman tooltips and y-axis ticks (GDP composition absolute-value charts). */
  multiSeriesValueFormat?: "gdp_levels" | "gdp_absolute" | "gdp_indexed";
  /** When ``multiSeriesValueFormat`` is ``gdp_indexed``, label for tooltips (e.g. Gregorian ``2015`` or Solar year). */
  indexedTooltipBaseLabel?: string;
  /** Override multi-series y-axis titles (key = ``yAxisIndex``), e.g. dual-axis reference layouts. */
  multiSeriesYAxisNameOverrides?: Partial<Record<number, string>>;
  /**
   * When ``grouped`` and every series defines ``legendGroup`` + ``legendMetric``, the default ECharts legend
   * is hidden and a compact legend is rendered (toggle still drives the chart).
   */
  multiSeriesLegendLayout?: "default" | "grouped";
  /**
   * With ``multiSeriesLegendLayout="grouped"``: ``grid`` = country × metric cells; ``country`` = one toggle per
   * ``legendGroup`` (all metrics in that group on/off together) plus an optional line-style key from metrics.
   */
  multiSeriesLegendGroupedVariant?: "grid" | "country";
  /** FA: tooltip chrome + LTR wrapper; series names still come from props (pass Persian labels from the page). */
  chartLocale?: "en" | "fa";
};

type GroupedLegendCell = {
  label: string;
  legendGroup: string;
  legendMetric: string;
  lineColor: string;
  shape: LegendEndShape;
};

type GroupedLegendCountryRow = {
  legendGroup: string;
  lineColor: string;
  seriesLabels: string[];
};

type GroupedLegendModel =
  | { variant: "grid"; columnOrder: string[]; rowOrder: string[]; cells: GroupedLegendCell[] }
  | { variant: "country"; countries: GroupedLegendCountryRow[]; lineStyleKey: { solidLabel: string; dashedLabel: string } | null };

function buildCountryGroupedExportSubtitle(args: {
  model: Extract<GroupedLegendModel, { variant: "country" }>;
  selected: Record<string, boolean> | null;
  chartLocale: "en" | "fa";
}): string | undefined {
  const { model, selected, chartLocale } = args;
  const isGroupOn = (labels: string[]) =>
    labels.length > 0 && labels.every((name) => selected == null || selected[name] !== false);
  const on = model.countries.filter((c) => isGroupOn(c.seriesLabels));
  const names = on.map((c) => c.legendGroup).join(chartLocale === "fa" ? "، " : ", ");
  const key = model.lineStyleKey;
  const linePart = key
    ? chartLocale === "fa"
      ? `${key.solidLabel}: خط پیوسته؛ ${key.dashedLabel}: خط منقطع`
      : `${key.solidLabel}: solid; ${key.dashedLabel}: dashed`
    : "";
  const countryPart =
    names.length > 0 ? (chartLocale === "fa" ? `کشورها: ${names}` : `Countries: ${names}`) : "";
  const parts = [countryPart, linePart].filter(Boolean);
  return parts.length > 0 ? parts.join(chartLocale === "fa" ? " — " : " — ") : undefined;
}

function ColoredLineSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg viewBox="0 0 44 12" className="h-3 w-11 shrink-0" aria-hidden>
      <line
        x1="2"
        y1="6"
        x2="42"
        y2="6"
        stroke={color}
        strokeWidth={2.35}
        strokeLinecap="round"
        {...(dashed ? { strokeDasharray: "5 4" } : {})}
      />
    </svg>
  );
}

/** One centered row: neutral solid / dashed swatches + import / export labels only. */
function GroupedMinimalLineStyleKey({
  solidLabel,
  dashedLabel,
  chartLocale,
  dir,
}: {
  solidLabel: string;
  dashedLabel: string;
  chartLocale: "en" | "fa";
  dir: "ltr" | "rtl";
}) {
  return (
    <div className="w-full border-t border-border/60 pt-2 text-foreground" dir={dir}>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <ColoredLineSwatch color="currentColor" />
          <span className="text-foreground/90">{localizeChartNumericDisplayString(solidLabel, chartLocale)}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ColoredLineSwatch color="currentColor" dashed />
          <span className="text-foreground/90">{localizeChartNumericDisplayString(dashedLabel, chartLocale)}</span>
        </span>
      </div>
    </div>
  );
}

function GroupedMultiSeriesCountryLegendBar({
  countries,
  selected,
  onToggleCountry,
  dir,
}: {
  countries: GroupedLegendCountryRow[];
  selected: Record<string, boolean> | null;
  onToggleCountry: (seriesLabels: string[]) => void;
  dir: "ltr" | "rtl";
}) {
  const isGroupOn = (labels: string[]) =>
    labels.length > 0 && labels.every((name) => selected == null || selected[name] !== false);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4" dir={dir}>
      {countries.map((c) => {
        const on = isGroupOn(c.seriesLabels);
        return (
          <button
            key={c.legendGroup}
            type="button"
            className={`inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs transition hover:bg-muted/70 sm:text-sm ${
              on ? "text-foreground opacity-100" : "text-muted-foreground opacity-50"
            }`}
            aria-pressed={on}
            aria-label={c.legendGroup}
            onClick={() => onToggleCountry(c.seriesLabels)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.lineColor }} aria-hidden />
            <span className="whitespace-nowrap font-medium">{c.legendGroup}</span>
          </button>
        );
      })}
    </div>
  );
}

function GroupedMultiSeriesLegendTable({
  rowOrder,
  columnOrder,
  cells,
  selected,
  onToggleSeries,
  dir,
}: {
  rowOrder: string[];
  columnOrder: string[];
  cells: GroupedLegendCell[];
  selected: Record<string, boolean> | null;
  onToggleSeries: (seriesName: string) => void;
  dir: "ltr" | "rtl";
}) {
  const map = new Map<string, GroupedLegendCell>();
  for (const c of cells) {
    map.set(`${c.legendGroup}\t${c.legendMetric}`, c);
  }

  const isOn = (name: string) => selected == null || selected[name] !== false;

  const toggle = (name: string) => {
    onToggleSeries(name);
  };

  return (
    <div className="rounded-md border border-border bg-muted/25 px-2 py-2 sm:px-3 text-xs sm:text-sm" dir={dir}>
      <table className="w-full border-collapse text-muted-foreground">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[1%] whitespace-nowrap py-1 pe-2 text-start font-normal text-foreground/80"
            />
            {columnOrder.map((col) => (
              <th key={col} scope="col" className="px-1 py-1 text-center font-medium text-foreground/90">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowOrder.map((row) => (
            <tr key={row}>
              <th scope="row" className="whitespace-nowrap py-1 pe-2 text-start font-medium text-foreground">
                {row}
              </th>
              {columnOrder.map((col) => {
                const cell = map.get(`${row}\t${col}`);
                if (!cell) {
                  return (
                    <td key={col} className="px-1 py-0.5 text-center text-muted-foreground/35">
                      <span aria-hidden>—</span>
                    </td>
                  );
                }
                const on = isOn(cell.label);
                return (
                  <td key={col} className="px-1 py-0.5 text-center">
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-sm p-1 transition hover:bg-muted/70 ${
                        on ? "opacity-100" : "opacity-45"
                      }`}
                      aria-pressed={on}
                      aria-label={cell.label}
                      onClick={() => toggle(cell.label)}
                    >
                      <svg viewBox="0 0 22 12" className="h-[14px] w-[30px] shrink-0" aria-hidden>
                        <path d={multiSeriesLegendLineMarkerPathD(cell.shape)} fill={cell.lineColor} />
                      </svg>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Minimum Gregorian years between shown Iran macro **top** captions (lines always draw). */
const MIN_LABEL_GAP_YEARS = 4;

/** Minimum years between shown **vertical** global oil / macro captions (lines always draw). */
const MIN_VERTICAL_LABEL_GAP_YEARS = 5;

/** Publication oil chart: fewer vertical captions, further apart. */
const PUBLICATION_VERTICAL_OIL_LABEL_GAP_YEARS = 11;

/** Horizontal pixel offset between rotated vertical oil labels (stagger). */
const VERTICAL_OIL_LABEL_STAGGER_PX = 18;

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

type VerticalOilLabelLayout = { showLabel: boolean; staggerIndex: number };

/**
 * Global oil markLines: at most one vertical caption per ``minGapYears``
 * (anchor always gets a label). ``staggerIndex`` spreads labels horizontally when rotated 90°.
 */
function buildVerticalGlobalOilLabelLayout(args: {
  globalOilMarkData: { event: TimelineEvent }[];
  anchorEventId?: string;
  minGapYears?: number;
}): Map<string, VerticalOilLabelLayout> {
  const { globalOilMarkData, anchorEventId, minGapYears } = args;
  const gap = minGapYears ?? MIN_VERTICAL_LABEL_GAP_YEARS;
  const layout = new Map<string, VerticalOilLabelLayout>();
  if (globalOilMarkData.length === 0) return layout;

  for (const d of globalOilMarkData) {
    layout.set(d.event.id, { showLabel: false, staggerIndex: 0 });
  }

  const sorted = [...globalOilMarkData].sort((a, b) => {
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
    const show = isAnchor || y - lastLabeledYear >= gap;
    if (show) {
      layout.set(d.event.id, { showLabel: true, staggerIndex: stagger % 6 });
      stagger += 1;
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

/** Single readable line for tooltips (publication oil / macro events). */
function eventTooltipOneLiner(ev: TimelineEvent): string {
  const raw = (ev.description ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return ev.title.trim();
  const sentence = raw.split(/(?<=[.!?])\s/)[0] ?? raw;
  const one = sentence.trim();
  if (one.length <= 160) return one;
  return `${one.slice(0, 157)}…`;
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
  oilPublicationLayout = false,
  oilEventDensity = "story",
  chartLineRole = "primary",
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
  showPngExportWhenRangeHidden = true,
  chartRangeGranularity: chartRangeGranularityProp,
  exportFileStem,
  exportSourceFooter,
  exportPresentationTitle,
  exportPresentationStudyHeading,
  multiSeriesValueFormat,
  indexedTooltipBaseLabel,
  multiSeriesYAxisNameOverrides,
  multiSeriesLegendLayout = "default",
  multiSeriesLegendGroupedVariant = "grid",
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
  }, [rangeBounds, clipStart, clipEnd]);

  /** Study PNG export: filename range segment and shared toolbar always use calendar years (data may be daily). */
  const studyExportRangeGranularity: ChartRangeGranularity = "year";

  /** Stable identity for grouped series so we reset selection when labels/keys change, not on array ref churn. */
  const groupedLegendSourceKey = useMemo(() => {
    if (multiSeriesLegendLayout !== "grouped" || !multiSeries?.length) return "";
    if (!multiSeries.every((s) => Boolean(s.legendGroup && s.legendMetric))) return "";
    return `${multiSeriesLegendGroupedVariant}\u0000${multiSeries.map((s) => `${s.key}|${s.label}`).join("\u0001")}`;
  }, [multiSeries, multiSeriesLegendLayout, multiSeriesLegendGroupedVariant]);

  const groupedLegendModel = useMemo((): GroupedLegendModel | null => {
    if (!groupedLegendSourceKey || !multiSeries || multiSeries.length === 0) return null;
    const mutedFg = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const chartTheme = {
      chartPrimary: cssHsl("--chart-primary", "hsl(238, 84%, 67%)"),
      chart2: cssHsl("--chart-2", "hsl(142, 76%, 36%)"),
      gold: "hsl(42, 85%, 50%)",
      oilColorMuted: withAlphaHsl(
        cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)"),
        0.7
      ),
      mutedFg,
    };
    const resolvedLineColors = resolveTimelineMultiSeriesColors(
      multiSeries.map((s) => ({ key: s.key, color: s.color, yAxisIndex: s.yAxisIndex })),
      chartTheme
    );

    if (multiSeriesLegendGroupedVariant === "country") {
      const byGroup = new Map<string, string[]>();
      for (const s of multiSeries) {
        const g = s.legendGroup!;
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(s.label);
      }
      const countries: GroupedLegendCountryRow[] = [];
      const seen = new Set<string>();
      for (const [i, s] of multiSeries.entries()) {
        const g = s.legendGroup!;
        if (seen.has(g)) continue;
        seen.add(g);
        const seriesLabels = byGroup.get(g) ?? [s.label];
        const cmp = countryComparatorSeriesStyle(s.key);
        const lineColor = resolvedLineColors[i]! ?? s.color ?? cmp?.color ?? mutedFg;
        countries.push({ legendGroup: g, lineColor, seriesLabels });
      }
      const dashed = multiSeries.find((x) => x.linePattern === "dashed");
      const solid = multiSeries.find((x) => x.linePattern !== "dashed" && x.linePattern !== "dotted");
      const lineStyleKey =
        dashed?.legendMetric && solid?.legendMetric && dashed.legendMetric !== solid.legendMetric
          ? { solidLabel: solid.legendMetric, dashedLabel: dashed.legendMetric }
          : null;
      return { variant: "country", countries, lineStyleKey };
    }

    const columnOrder: string[] = [];
    const rowOrder: string[] = [];
    for (const s of multiSeries) {
      const m = s.legendMetric!;
      const g = s.legendGroup!;
      if (!columnOrder.includes(m)) columnOrder.push(m);
      if (!rowOrder.includes(g)) rowOrder.push(g);
    }
    const cells: GroupedLegendCell[] = multiSeries.map((s, i) => {
      const shape = s.symbol ?? MULTI_SERIES_FALLBACK_LEGEND_ICONS[i % MULTI_SERIES_FALLBACK_LEGEND_ICONS.length]!;
      const cmp = countryComparatorSeriesStyle(s.key);
      const lineColor = resolvedLineColors[i]! ?? s.color ?? cmp?.color ?? mutedFg;
      return {
        label: s.label,
        legendGroup: s.legendGroup!,
        legendMetric: s.legendMetric!,
        lineColor,
        shape,
      };
    });
    return { variant: "grid", columnOrder, rowOrder, cells };
  }, [groupedLegendSourceKey, multiSeries, multiSeriesLegendGroupedVariant]);

  const [groupedLegendSelected, setGroupedLegendSelected] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!groupedLegendSourceKey || !multiSeries?.length) {
      setGroupedLegendSelected(null);
      return;
    }
    setGroupedLegendSelected(Object.fromEntries(multiSeries.map((s) => [s.label, true])));
  }, [groupedLegendSourceKey]);

  const handleGroupedLegendToggle = useCallback((name: string) => {
    setGroupedLegendSelected((prev) => {
      const ms = multiSeries ?? [];
      const base: Record<string, boolean> = prev ?? Object.fromEntries(ms.map((s) => [s.label, true]));
      const visible = base[name] !== false;
      return { ...base, [name]: !visible };
    });
  }, [multiSeries]);

  const handleGroupedCountryToggle = useCallback((seriesLabels: string[]) => {
    if (seriesLabels.length === 0) return;
    setGroupedLegendSelected((prev) => {
      const ms = multiSeries ?? [];
      const base: Record<string, boolean> = prev ?? Object.fromEntries(ms.map((s) => [s.label, true]));
      const allOn = seriesLabels.every((name) => base[name] !== false);
      const target = !allOn;
      const next = { ...base };
      for (const name of seriesLabels) {
        next[name] = target;
      }
      return next;
    });
  }, [multiSeries]);

  const exportFilenameCtx = useStudyChartExportFilenameContext();

  useEffect(() => {
    setClipStart("");
    setClipEnd("");
  }, [rangeBounds?.[0], rangeBounds?.[1]]);

  const handleExportPng = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const backgroundColor = cssHsl("--background", "hsl(0, 0%, 100%)");
    const yearAxisForFile = xAxisYearLabel ?? "gregorian";
    const stem =
      exportFilenameCtx &&
      rangeBounds?.[0] &&
      rangeBounds[1] &&
      chartRange?.[0] &&
      chartRange[1]
        ? buildStudyChartExportFilenameStem({
            studySlug: exportFilenameCtx.studySlug,
            chartFileStem: exportFileStem,
            locale: exportFilenameCtx.locale,
            yearAxisMode: yearAxisForFile,
            selectedStart: chartRange[0],
            selectedEnd: chartRange[1],
            defaultStart: rangeBounds[0],
            defaultEnd: rangeBounds[1],
            rangeGranularity: studyExportRangeGranularity,
          })
        : slugifyChartFilename(exportFileStem ?? label);
    const footerColor = cssHsl("--muted-foreground", "hsl(240, 3.8%, 46.1%)");
    const titleColor = cssHsl("--foreground", "hsl(240, 10%, 3.9%)");
    const resolvedTitle =
      exportPresentationTitle?.trim() ??
      buildPresentationExportTitle({
        studyHeading: exportPresentationStudyHeading,
        metricLabel: label,
        timeRange: chartRange,
        chartLocale: chartLocale ?? "en",
        yearAxisMode: xAxisYearLabel ?? "gregorian",
      });
    const isCountryGroupOn = (labels: string[]) =>
      labels.length > 0 && labels.every((name) => groupedLegendSelected == null || groupedLegendSelected[name] !== false);

    const exportPresentationCountryKey =
      groupedLegendModel?.variant === "country"
        ? groupedLegendModel.countries
            .filter((c) => isCountryGroupOn(c.seriesLabels))
            .map((c) => ({ label: c.legendGroup, color: c.lineColor }))
        : undefined;

    const exportPresentationLineStyleKey =
      groupedLegendModel?.variant === "country" && groupedLegendModel.lineStyleKey
        ? groupedLegendModel.lineStyleKey
        : undefined;

    const useExportAuxLegend =
      (exportPresentationCountryKey?.length ?? 0) > 0 && exportPresentationLineStyleKey != null;

    const exportPresentationSubtitle =
      groupedLegendModel?.variant === "country" && !useExportAuxLegend
        ? buildCountryGroupedExportSubtitle({
            model: groupedLegendModel,
            selected: groupedLegendSelected,
            chartLocale: chartLocale ?? "en",
          })
        : undefined;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const exportOpts: DownloadEchartsRasterOptions = {
            exportSourceFooter: exportSourceFooter?.trim(),
            exportSourceFooterColor: footerColor,
            exportPresentationTitle: resolvedTitle,
            exportPresentationSubtitle,
            ...(useExportAuxLegend
              ? {
                  exportPresentationCountryKey: exportPresentationCountryKey,
                  exportPresentationLineStyleKey: exportPresentationLineStyleKey,
                }
              : {}),
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
    exportPresentationTitle,
    exportSourceFooter,
    label,
    rangeBounds,
    xAxisYearLabel,
    groupedLegendModel,
    groupedLegendSelected,
  ]);

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
    const productionSymbols: Record<string, "circle" | "diamond" | "triangle" | "roundRect"> = {
      us: "circle",
      saudi: "diamond",
      russia: "triangle",
      iran: "roundRect",
      total: "circle",
    };

    /** Line end marker for multi-series: explicit `s.symbol` wins; then comparator keys, production, FX/wage keys, fallback by index. */
    const endShapeForMultiSeriesSeries = (s: ChartSeries, index: number): LegendEndShape => {
      if (s.symbol) return s.symbol;
      const cmp = countryComparatorSeriesStyle(s.key);
      if (cmp) return cmp.symbol;
      if (s.key in productionSymbols) {
        return (productionSymbols[s.key] ?? "circle") as LegendEndShape;
      }
      const isGold = s.key === "gold";
      const isOil = s.key === "oil";
      const isOfficial = s.key === "official";
      const isOpen = s.key === "open";
      const isSpread = s.key === "spread";
      const isProxy = s.key === "proxy";
      const isWageNominal = s.key === "nominal";
      const isWageReal = s.key === "real";
      const isWageIndex = s.key === "index";
      const isFx = s.key === "fx";
      if (isGold) return "circle";
      if (isOil) return "triangle";
      if (isOfficial) return "circle";
      if (isOpen) return "diamond";
      if (isSpread) return "triangle";
      if (isFx) return "diamond";
      if (isWageNominal) return "circle";
      if (isWageReal) return "diamond";
      if (isWageIndex) return "triangle";
      if (isProxy) return "diamond";
      if (s.yAxisIndex === 1 && !isWageIndex) return "diamond";
      return MULTI_SERIES_FALLBACK_LEGEND_ICONS[index % MULTI_SERIES_FALLBACK_LEGEND_ICONS.length]!;
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
    let yAxisTickLabelBase = {
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
    const multiSeriesLineColors =
      hasMultiSeries && multiSeries
        ? resolveTimelineMultiSeriesColors(
            multiSeries.map((s) => ({ key: s.key, color: s.color, yAxisIndex: s.yAxisIndex })),
            {
              chartPrimary: color,
              chart2: chart2Color,
              gold: goldColor,
              oilColorMuted,
              mutedFg: mutedFg,
            }
          )
        : null;
    const multiSeriesCount = hasMultiSeries ? multiSeries!.length : 0;
    const useGroupedMultiSeriesLegend = groupedLegendModel != null;
    const legendTextFontSize = STUDY_CHART_LEGEND_FONT_PX;
    /** Tighter gap so plain legends wrap onto multiple rows instead of one overcrowded line. */
    const multiSeriesLegendItemGap = 10;
    /** Extra grid space when many series may wrap to several legend rows (plain + width legend). */
    const multiSeriesLegendBottomPct = hasMultiSeries
      ? useGroupedMultiSeriesLegend
        ? "11%"
        : `${Math.min(28, Math.round(12 + Math.ceil(multiSeriesCount / 3) * 3.5))}%`
      : "11%";
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
    const isClassicOilChart = Boolean(
      hasOil && secondSeries && !hasData && !hasMultiSeries && !comparatorResolved
    );
    if (oilPublicationLayout && isClassicOilChart) {
      yAxisTickLabelBase = { ...yAxisTickLabelBase, fontSize: CHART_Y_AXIS_TICK_FONT_SIZE + 1 };
    }
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
    const alignToCalendarYearBucket = resolveTimeSeriesEventAlignToCalendarYearBucket({
      chartRangeGranularity: chartRangeGranularityProp,
      useYearlyMultiSeries: Boolean(useYearlyMultiSeries),
    });
    const yearlyDates =
      useYearlyMultiSeries && timeRange
        ? (() => {
            const years = [...new Set(allMultiSeriesDates.map((d) => d.slice(0, 4)))].sort();
            // Mid-year anchor for category axes; calendar-year start when using a time axis (true year distance).
            return years.map((y) => (forceTimeAxis ? `${y}-01-01` : `${y}-07-01`));
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
    const chartNumeralLocale = chartLocale ?? "en";
    const axisYearGregColor = cssHsl("--foreground", "hsl(240, 10%, 3.9%)");
    const axisYearJalaliColor = mutedFg;
    const axisLabelBothRich = {
      gy: {
        color: axisYearGregColor,
        fontSize: 13,
        lineHeight: 16,
        align: "center" as const,
        padding: [0, 0, 2, 0],
      },
      jy: {
        color: axisYearJalaliColor,
        fontSize: 11,
        lineHeight: 13,
        align: "center" as const,
      },
    };
    const tooltipYearLineColors = {
      gregorianColor: axisYearGregColor,
      jalaliColor: axisYearJalaliColor,
      labelColor: mutedFg,
    };
    const formatCategoryAxisYearTick = (value: string) => {
      if (axisYearMode !== "both")
        return formatChartCategoryAxisYearLabel(value, axisYearMode, chartNumeralLocale);
      const { gregorian, jalali } = getChartAxisYearDisplayParts(value);
      if (!gregorian) return value;
      return jalali
        ? `{gy|${localizeChartNumericDisplayString(gregorian, chartNumeralLocale)}}\n{jy|${localizeChartNumericDisplayString(jalali, chartNumeralLocale)}}`
        : localizeChartNumericDisplayString(gregorian, chartNumeralLocale);
    };
    const isShortSpanTimeAxis = useTimeAxis && spanDays < 400;
    const dualYearStackedAxisActive =
      axisYearMode === "both" && (!useTimeAxis || !isShortSpanTimeAxis);
    const bumpGridBottomForDualYear = (bottomPct: string) => {
      if (!dualYearStackedAxisActive) return bottomPct;
      const m = bottomPct.match(/^([\d.]+)%$/);
      if (!m) return bottomPct;
      return `${Math.min(38, parseFloat(m[1]) + 3)}%`;
    };

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
              const idx = findTimeSeriesEventCategoryIndex(dates, d, false);
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

    const { pointMarkers: eventOverlayPoints } = buildEventOverlay({
      events: pointEvents,
      dates,
      minDate: minDate!,
      maxDate: maxDate!,
      alignToCalendarYearBucket,
    });
    const markLineData: { xAxis: string; event: TimelineEvent; isAnchor: boolean }[] = eventOverlayPoints.map((p) => ({
      xAxis: p.xAxis,
      event: p.event,
      isAnchor: anchorEventId === p.event.id,
    }));

    const markLineDataForRender =
      oilPublicationLayout && isClassicOilChart && oilEventDensity === "story"
        ? markLineData.filter((d) => d.event.layer === "global_macro_oil" || d.isAnchor)
        : markLineData;

    const iranMacroMarkLineData = markLineDataForRender.filter((d) => d.event.macroMarker === true);
    const globalOilMarkLineData = markLineDataForRender.filter((d) => d.event.layer === "global_macro_oil");
    const hasTopMacroCaptionRows = iranMacroMarkLineData.length > 0;
    const macroLabelLayout = buildMacroLabelLayout({
      macroMarkData: iranMacroMarkLineData,
      anchorEventId,
    });
    const verticalGlobalOilLabelLayout = buildVerticalGlobalOilLabelLayout({
      globalOilMarkData: globalOilMarkLineData,
      anchorEventId,
      minGapYears:
        oilPublicationLayout && isClassicOilChart
          ? PUBLICATION_VERTICAL_OIL_LABEL_GAP_YEARS
          : undefined,
    });

    type MarkLineDatum = { xAxis: string; event: TimelineEvent; isAnchor: boolean };
    const verticalMarkLineItem = (d: MarkLineDatum) => {
      if (d.event.layer === "global_macro_oil") {
        const vl = verticalGlobalOilLabelLayout.get(d.event.id) ?? { showLabel: false, staggerIndex: 0 };
        const shortCaption = globalMacroOilMarkLineShortLabel(d.event);
        const pubOil = oilPublicationLayout && isClassicOilChart;
        const labelFontSize = pubOil ? 14 : 13;
        const staggerOffsetX = pubOil ? (vl.staggerIndex - 2.5) * VERTICAL_OIL_LABEL_STAGGER_PX : 0;
        return {
          xAxis: d.xAxis,
          label: vl.showLabel
            ? {
                show: true,
                formatter: localizeChartNumericDisplayString(shortCaption, chartNumeralLocale),
                fontSize: labelFontSize,
                fontWeight: pubOil ? 600 : 400,
                color: pubOil ? withAlphaHsl(mutedFg, 0.95) : withAlphaHsl(mutedFg, 0.86),
                distance: pubOil ? 10 : 8,
                position: "middle" as const,
                rotate: 90,
                offset: [staggerOffsetX, 0] as [number, number],
              }
            : { show: false },
          lineStyle: {
            color: pubOil ? withAlphaHsl(mutedFg, 0.38) : withAlphaHsl(muted, 0.28),
            width: pubOil ? 1.15 : 1,
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
                formatter: localizeChartNumericDisplayString(caption, chartNumeralLocale),
                fontSize: 13,
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

    const markLineSeriesItems = markLineDataForRender.map((d) => verticalMarkLineItem(d));

    const rangeBandData: { xStart: string; xEnd: string; event: TimelineEvent }[] = [];
    const presidentialBandData: { xStart: string; xEnd: string; event: TimelineEvent }[] = [];
    for (const ev of rangeEvents) {
      const ds = ev.date_start!;
      const de = ev.date_end!;
      if (de < minDate! || ds > maxDate!) continue;
      const rangeIdx = findTimeSeriesEventRangeCategoryIndices(dates, ds, de, alignToCalendarYearBucket);
      if (rangeIdx == null) continue;
      const { startIdx, endIdx } = rangeIdx;
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

    const multiSeriesLegendData =
      hasMultiSeries && multiSeries && multiSeriesLineColors
        ? multiSeries.map((s, i) => {
            const shape = endShapeForMultiSeriesSeries(s, i);
            const lineColor = multiSeriesLineColors[i] ?? mutedFg;
            return {
              name: s.label,
              icon: multiSeriesLegendLineMarkerPath(shape),
              itemStyle: { color: lineColor },
            };
          })
        : [];

    const dualAxisOilFxOverlay = Boolean(hasData && secondSeries);
    const indexedComparatorOil = Boolean(comparatorResolved && comparatorValuesForChart && hasOil);
    const oilOverlayLineSymbol: LegendEndShape =
      secondSeries?.symbol ?? (indexedComparatorOil ? "circle" : dualAxisOilFxOverlay ? "triangle" : "circle");
    const oilOverlayLineSymbolSize =
      secondSeries?.symbolSize ??
      (indexedComparatorOil
        ? CHART_LINE_SYMBOL_SIZE
        : dualAxisOilFxOverlay
          ? CHART_LINE_SYMBOL_SIZE_COMPACT
          : CHART_LINE_SYMBOL_SIZE_MINI);
    const comparatorLineSymbol: LegendEndShape = comparatorSeries?.symbol ?? "diamond";
    const comparatorLineSymbolSize = comparatorSeries?.symbolSize ?? CHART_LINE_SYMBOL_SIZE;

    const pubOilPrimary = oilPublicationLayout && isClassicOilChart;
    const oilPrimaryLineColor = pubOilPrimary
      ? color
      : comparatorResolved && comparatorValuesForChart
        ? color
        : oilColor;
    const oilPrimaryLineWidth = pubOilPrimary ? 2.75 : 1.5;
    const oilPrimarySymbolSize = pubOilPrimary ? CHART_LINE_SYMBOL_SIZE_COMPACT : oilOverlayLineSymbolSize;

    const xAxisTickFont = pubOilPrimary ? CHART_Y_AXIS_TICK_FONT_SIZE + 1 : CHART_Y_AXIS_TICK_FONT_SIZE;
    /** Title is rendered in React above the canvas; keep grid tight to the plot (extra top when macro captions). */
    const gridTopPct = pubOilPrimary
      ? hasTopMacroCaptionRows
        ? showChartControls
          ? "23%"
          : "19%"
        : showChartControls
          ? "16%"
          : "11%"
      : hasTopMacroCaptionRows
        ? showChartControls
          ? "19%"
          : "16%"
        : showChartControls
          ? "13%"
          : "8%";

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: "transparent",
      emphasis: { focus: "none" as const },
      ...(comparatorResolved && comparatorValuesForChart && hasOil
        ? {
            legend: {
              show: true,
              type: "plain",
              selectedMode: true,
              bottom: 2,
              left: "center",
              width: "90%",
              itemGap: 12,
              itemWidth: 28,
              itemHeight: 11,
              textStyle: { color: mutedFg, fontSize: legendTextFontSize },
              data: [
                {
                  name: secondSeries?.label ?? "Iran (PPP)",
                  icon: multiSeriesLegendLineMarkerPath(secondSeries?.symbol ?? "circle"),
                  itemStyle: { color },
                },
                {
                  name: comparatorResolved.label,
                  icon: multiSeriesLegendLineMarkerPath(comparatorSeries?.symbol ?? "diamond"),
                  itemStyle: { color: comparatorColor },
                },
              ],
            },
          }
        : hasMultiSeries && multiSeries
          ? {
              legend: useGroupedMultiSeriesLegend
                ? {
                    show: false,
                    selectedMode: true,
                    data: multiSeries.map((s) => s.label),
                    selected:
                      groupedLegendSelected ??
                      Object.fromEntries(multiSeries.map((s) => [s.label, true])),
                  }
                : {
                    show: true,
                    type: "plain",
                    selectedMode: true,
                    bottom: 1,
                    left: "center",
                    width: "92%",
                    orient: "horizontal",
                    itemWidth: 28,
                    itemHeight: 11,
                    itemGap: multiSeriesLegendItemGap,
                    textStyle: { color: mutedFg, fontSize: legendTextFontSize },
                    data: multiSeriesLegendData,
                  },
            }
          : hasOil && secondSeries && !comparatorResolved
            ? {
                legend: {
                  show: true,
                  type: "plain",
                  selectedMode: true,
                  bottom: 2,
                  left: "center",
                  width: "90%",
                  itemGap: 12,
                  itemWidth: 28,
                  itemHeight: 11,
                  textStyle: { color: mutedFg, fontSize: legendTextFontSize },
                  data: hasData
                    ? [
                        {
                          name: label,
                          icon: multiSeriesLegendLineMarkerPath("circle"),
                          itemStyle: { color },
                        },
                        {
                          name: secondSeries.label,
                          icon: multiSeriesLegendLineMarkerPath(secondSeries.symbol ?? "triangle"),
                          itemStyle: { color: oilColor },
                        },
                      ]
                    : [
                        {
                          name: secondSeries?.label ?? "Brent oil",
                          icon: multiSeriesLegendLineMarkerPath(secondSeries?.symbol ?? "triangle"),
                          itemStyle: { color: oilColor },
                        },
                      ],
                },
              }
            : {}),
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        confine: true,
        extraCssText: "max-width: 380px; overflow-wrap: break-word; word-wrap: break-word; white-space: normal; font-size: 14px;",
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
            ? markLineDataForRender
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
          const ev = rangeEv ?? nearestEv?.ev ?? markLineDataForRender.find(
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
              const usePubOilTooltip = oilPublicationLayout && isClassicOilChart;
              if (usePubOilTooltip && ev.layer === "global_macro_oil") {
                const dateLine = ev.date ?? ev.date_start ?? "";
                lines.push(`<span style="font-weight:600;font-size:14px">${ev.title}</span>`);
                lines.push(`<span style="font-size:12px;color:#888">${dateLine}</span>`);
                lines.push(
                  `<span style="font-size:13px;line-height:1.35">${localizeChartNumericDisplayStringSafe(
                    eventTooltipOneLiner(ev),
                    chartNumeralLocale
                  )}</span>`
                );
              } else {
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
              }
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
              (!eventUsesMacroMarkLineStyle(ev) || ev.layer === "global_macro_oil") &&
              !(oilPublicationLayout && isClassicOilChart && ev.layer === "global_macro_oil")
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
            formatChartTooltipYearLine(
              dateStr,
              axisYearMode,
              chartLocale === "fa" ? "fa" : "en",
              tooltipYearLineColors,
              chartNumeralLocale
            )
          );
          const pt = hasData && idx < dataResolved.length ? dataResolved[idx] : null;
          if (pt) {
            const val = pt[valueKey];
            const num = typeof val === "number" ? val : val != null ? Number(val) : NaN;
            const valDisp =
              val == null || (typeof val !== "number" && (typeof val !== "string" || val === ""))
                ? "—"
                : Number.isFinite(num)
                  ? `${formatMultiSeriesEconomicTooltipValue(num, unit ?? "", chartNumeralLocale)}${unit ? ` ${unit}` : ""}`
                  : String(val);
            lines.push(`${label}: ${valDisp}`);
            if (pt.confidence != null) {
              lines.push(
                localizeChartNumericDisplayString(
                  `${ui.confidence}: ${(pt.confidence * 100).toFixed(0)}%`,
                  chartNumeralLocale
                )
              );
            }
          }
          if (hasMultiSeries && multiSeries && multiSeriesValues) {
            multiSeries.forEach((s, i) => {
              const val = multiSeriesValues[i]?.[idx];
              const formatted =
                val != null
                  ? isGdpCompactMultiSeriesFormat(multiSeriesValueFormat)
                    ? multiSeriesValueFormat === "gdp_indexed" && indexedTooltipBaseLabel
                      ? formatGdpIndexedTooltipValue(Number(val), indexedTooltipBaseLabel, chartNumeralLocale)
                      : formatGdpLevelsTooltipValue(Number(val), s.unit, chartNumeralLocale)
                    : (() => {
                        const core = formatMultiSeriesEconomicTooltipValue(Number(val), s.unit, chartNumeralLocale);
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
                  ? localizeChartNumericDisplayString(`${oilVal.toFixed(1)} (${ui.indexed})`, chartNumeralLocale)
                  : unit.includes("toman")
                    ? localizeChartNumericDisplayString(
                        `${formatChartTooltipNumber(oilVal, chartNumeralLocale)} ${unit}`,
                        chartNumeralLocale
                      )
                    : `${formatMultiSeriesEconomicTooltipValue(oilVal, unit, chartNumeralLocale)} ${unit}`
                : "—";
            lines.push(`${lbl}: ${formatted}`);
            if (comparatorValuesForChart && comparatorResolved) {
              const compVal = comparatorValuesForChart[idx];
              const compFormatted =
                compVal != null
                  ? isIndexed
                    ? localizeChartNumericDisplayString(`${compVal.toFixed(1)} (${ui.indexed})`, chartNumeralLocale)
                    : `${formatMultiSeriesEconomicTooltipValue(Number(compVal), secondSeries?.unit ?? "", chartNumeralLocale)}`
                  : "—";
              lines.push(`${comparatorResolved.label}: ${compFormatted}`);
            }
          }
          return localizeChartNumericDisplayStringSafe(lines.join("<br/>"), chartNumeralLocale);
        },
      },
      grid: {
        left: hasMultiSeries ? "15%" : "5%",
        right:
          gridRightOverride ??
          (hasMultiSeries && multiSeries && multiSeries.some((s) => s.yAxisIndex >= 2)
            ? "30%"
            : hasOil || !hasData || hasMultiSeries
              ? "16%"
              : "6%"),
        bottom: bumpGridBottomForDualYear(
          xLabelRotate
            ? "18%"
            : hasMultiSeries && multiSeries
              ? multiSeriesLegendBottomPct
              : (comparatorResolved && comparatorValuesForChart && hasOil) || (hasOil && secondSeries && !comparatorResolved)
                ? "13%"
                : "3%"
        ),
        top: gridTopPct,
        containLabel: true,
      },
      xAxis: useTimeAxis
        ? (() => {
            const spanDays = dateMax && dateMin ? (dateMax - dateMin) / 86400000 : 0;
            const isShortSpan = spanDays < 400;
            const dayMs = 86400000;
            /** ~one Gregorian year: prevents multiple time ticks in the same year with a year-only label (USD→Toman, long spans). */
            const approxYearMs = 365 * dayMs;
            const minIntervalMs = isShortSpan
              ? Math.max(dayMs, Math.ceil(spanDays / 6) * dayMs)
              : approxYearMs;
            return {
              type: "time",
              min: dateMin,
              max: dateMax,
              minInterval: minIntervalMs,
              axisLine: { lineStyle: { color: borderColor } },
              axisLabel: {
                hideOverlap: true,
                formatter: (value: number) =>
                  isShortSpan
                    ? new Date(value).toLocaleDateString(chartNumeralLocale === "fa" ? "fa-IR" : undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : axisYearMode === "both"
                      ? (() => {
                          const iso = new Date(value).toISOString().slice(0, 10);
                          const { gregorian, jalali } = getChartAxisYearDisplayParts(iso);
                          return jalali
                            ? `{gy|${localizeChartNumericDisplayString(gregorian, chartNumeralLocale)}}\n{jy|${localizeChartNumericDisplayString(jalali, chartNumeralLocale)}}`
                            : localizeChartNumericDisplayString(gregorian, chartNumeralLocale);
                        })()
                      : formatChartTimeAxisYearLabel(value, axisYearMode, chartNumeralLocale),
                ...(axisYearMode === "both" && !isShortSpan ? { rich: axisLabelBothRich } : {}),
                color: mutedFg,
                fontSize: xAxisTickFont,
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
                fontSize: xAxisTickFont,
                rotate: xLabelRotate,
                interval,
                ...(axisYearMode === "both" ? { rich: axisLabelBothRich } : {}),
                formatter: (value: string, index: number) => {
                  const yearStr = value.slice(0, 4);
                  const yearNum = parseInt(yearStr, 10);
                  if (useTimeLinearLabels) {
                    const prevYear = (dates[index - 1] ?? "").slice(0, 4);
                    if (index > 0 && prevYear === yearStr) return "";
                    if (!timeLinearTickYears.includes(yearNum)) return "";
                    return formatCategoryAxisYearTick(value);
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
                    return formatCategoryAxisYearTick(value);
                  }
                  if (n2 <= 100 || useSparseMultiSeriesDates) return formatCategoryAxisYearTick(value);
                  if (n2 > 60)
                    return localizeChartNumericDisplayString(value.slice(0, 7), chartNumeralLocale);
                  return localizeChartNumericDisplayString(value, chartNumeralLocale);
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
                    ? "Toman/USD"
                    : `${first.label} (toman/USD)`
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
              const tomanOrRateLogAxis = useLog && isLeft && isTomanFxUnit(first.unit);
              const tomanLogAxisMin =
                tomanOrRateLogAxis && !isGoldLogAxis && multiSeriesValues
                  ? (() => {
                      const nums: number[] = [];
                      for (const s of seriesOnAxis) {
                        const si = multiSeries.indexOf(s);
                        for (const v of multiSeriesValues[si] ?? []) {
                          if (typeof v === "number" && Number.isFinite(v) && v > 0) nums.push(v);
                        }
                      }
                      if (nums.length === 0) return undefined;
                      return Math.max(Math.min(...nums) * 0.01, 1e-9);
                    })()
                  : undefined;
              const fixedRange =
                yAxisMin != null && yAxisMax != null && isLeft
                  ? { min: yAxisMin, max: yAxisMax }
                  : multiSeriesValueFormat === "gdp_indexed" && yAxisMin != null
                    ? { min: yAxisMin }
                    : isGoldLogAxis
                      ? { min: 10, max: 3000 }
                      : tomanLogAxisMin != null
                        ? { min: tomanLogAxisMin }
                        : {};
              const pctEligible =
                !useLog &&
                Object.keys(fixedRange).length === 0 &&
                yAxisMin == null &&
                yAxisMax == null &&
                !isGoldLogAxis &&
                !isGdpCompactMultiSeriesFormat(multiSeriesValueFormat) &&
                seriesOnAxis.every((s) => s.unit === "%");
              let pctNice: ReturnType<typeof nicePercentShareAxisRange> = null;
              if (pctEligible && multiSeriesValues) {
                const nums: number[] = [];
                for (const s of seriesOnAxis) {
                  const si = multiSeries.indexOf(s);
                  if (si < 0) continue;
                  for (const v of multiSeriesValues[si] ?? []) {
                    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
                  }
                }
                pctNice = nicePercentShareAxisRange(nums);
              }
              return {
                type: (useLog ? "log" : "value") as "value" | "log",
                ...(useLog ? { logBase: 10 } : {}),
                ...fixedRange,
                ...(pctNice ? { min: pctNice.min, max: pctNice.max, interval: pctNice.interval } : {}),
                position: (isLeft ? "left" : "right") as "left" | "right",
                offset: isRight ? rightOffset : 0,
                name: formatYAxisNameMultiline(localizeChartNumericDisplayString(axisTitle, chartNumeralLocale)),
                nameLocation: "middle" as const,
                nameRotate: isLeft ? 90 : -90,
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
                          if (multiSeriesValueFormat === "gdp_indexed") return formatGdpIndexedAxisTick(n, chartNumeralLocale);
                          return formatGdpLevelsAxisTick(n, first.unit, chartNumeralLocale);
                        },
                      }
                    : first.unit?.includes("%") &&
                        !isGdpCompactMultiSeriesFormat(multiSeriesValueFormat)
                      ? {
                          formatter: (v: number | string) => {
                            const n = typeof v === "number" ? v : Number(v);
                            if (!Number.isFinite(n)) return String(v);
                            const nearInt = Math.abs(n - Math.round(n)) < 0.06;
                            return localizeChartNumericDisplayString(
                              nearInt ? `${Math.round(n)}%` : `${(Math.round(n * 10) / 10).toFixed(1)}%`,
                              chartNumeralLocale
                            );
                          },
                        }
                      : {
                            formatter: (v: number | string) => {
                              const n = typeof v === "number" ? v : Number(v);
                              return Number.isFinite(n) ? formatEconomicAxisTick(n, chartNumeralLocale) : String(v);
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
                localizeChartNumericDisplayString(
                  (hasData ? label : secondSeries?.label ?? "Brent oil") + (unit ? ` (${unit})` : ""),
                  chartNumeralLocale
                )
              ),
              nameLocation: "middle" as const,
              nameRotate: 90,
              nameTextStyle: yAxisNameStyle,
              nameGap: CHART_Y_AXIS_NAME_GAP,
              axisLine: { show: false },
              splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
              axisLabel: {
                ...yAxisTickLabelBase,
                formatter: (v: number | string) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return Number.isFinite(n) ? formatEconomicAxisTick(n, chartNumeralLocale) : String(v);
                },
              },
              show: hasData,
            },
            {
              type: (yAxisLog ? "log" : "value") as "value" | "log",
              ...(yAxisLog ? { logBase: 10 } : {}),
              position: "right" as const,
              name: formatYAxisNameMultiline(
                localizeChartNumericDisplayString(
                  useIndexed && indexBaseYear != null
                    ? `Index (base=${indexBaseYear})` + (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : "")
                    : (secondSeries?.label ?? "Brent oil") +
                        (secondSeries?.unit?.includes("toman") ? " (toman/USD)" : secondSeries?.unit ? ` (${secondSeries.unit})` : "") +
                        (yAxisNameSuffix ? ` ${yAxisNameSuffix}` : ""),
                  chartNumeralLocale
                )
              ),
              nameLocation: "middle" as const,
              nameRotate: -90,
              nameTextStyle: yAxisNameStyle,
              nameGap: CHART_Y_AXIS_NAME_GAP,
              axisLine: { show: false },
              splitLine: { show: false },
              axisLabel: {
                ...yAxisTickLabelBase,
                formatter: (v: number) =>
                  typeof v === "number" ? formatEconomicAxisTick(v, chartNumeralLocale) : String(v),
              },
            },
          ]
        : {
            type: "value",
            name: formatYAxisNameMultiline(localizeChartNumericDisplayString(label, chartNumeralLocale)),
            nameLocation: "middle" as const,
            nameRotate: 90,
            nameTextStyle: yAxisNameStyle,
            nameGap: CHART_Y_AXIS_NAME_GAP,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
            axisLabel: {
              ...yAxisTickLabelBase,
              formatter: (v: number | string) => {
                const n = typeof v === "number" ? v : Number(v);
                return Number.isFinite(n) ? formatEconomicAxisTick(n, chartNumeralLocale) : String(v);
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
                  markLineDataForRender.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        silent: false,
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: localizeChartNumericDisplayString(referenceLine.label ?? "", chartNumeralLocale) }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
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
                              const r = findTimeSeriesEventRangeCategoryIndices(
                                dates,
                                p.date_start,
                                p.date_end,
                                alignToCalendarYearBucket
                              );
                              if (r == null) return null;
                              const { startIdx, endIdx } = r;
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
                const isOfficial = s.key === "official";
                const isOpen = s.key === "open";
                const isSpread = s.key === "spread";
                const isWageNominal = s.key === "nominal";
                const isWageReal = s.key === "real";
                const isWageIndex = s.key === "index";
                const isProductionKey = isOilProductionVolumeKey(s.key);
                const isTotal = s.key === "total";
                const lineColor = multiSeriesLineColors?.[i] ?? mutedFg;
                const defaultLineWidth =
                  isGold || isOil || isProductionKey ? 1.5 : hasMultiSeries && !isGold && !isOil && !isProductionKey ? 1.35 : 1;
                const lineWidth = s.lineWidth ?? defaultLineWidth;
                const patternLineType =
                  s.linePattern === "dashed"
                    ? ("dashed" as const)
                    : s.linePattern === "dotted"
                      ? ("dotted" as const)
                      : undefined;
                const lineType = isTotal ? ("dashed" as const) : patternLineType;
                const seriesShape = endShapeForMultiSeriesSeries(s, i);
                const symbolSize =
                  s.symbolSize ??
                  (isGold || isOil || isProductionKey
                    ? CHART_LINE_SYMBOL_SIZE_COMPACT
                    : CHART_LINE_SYMBOL_SIZE);
                const showSymbol = s.showSymbol !== false;
                const rawSeriesVals = multiSeriesValues[i] ?? [];
                const tomanLogSanitize = yAxisLog && s.yAxisIndex === 0 && isTomanFxUnit(s.unit);
                const valuesForEcharts = tomanLogSanitize
                  ? rawSeriesVals.map((v) => (v != null && typeof v === "number" && v > 0 ? v : null))
                  : rawSeriesVals;
                return {
                  name: s.label,
                  type: "line" as const,
                  yAxisIndex: s.yAxisIndex,
                  data: useTimeAxis ? toTimeData(valuesForEcharts) : valuesForEcharts,
                  smooth: false,
                  connectNulls: true,
                  step: (isGold ? "start" : false) as "start" | false,
                  symbol: seriesShape,
                  showSymbol,
                  symbolSize,
                  lineStyle: { color: lineColor, width: lineWidth, opacity: 1, ...(lineType ? { type: lineType } : {}) },
                  itemStyle: { color: lineColor, opacity: CHART_LINE_SYMBOL_ITEM_OPACITY },
                  emphasis: {
                    focus: "none" as const,
                    scale: false,
                    lineStyle: { color: lineColor, width: lineWidth, opacity: 1, ...(lineType ? { type: lineType } : {}) },
                    itemStyle: { color: lineColor, opacity: 1 },
                  },
                  markPoint:
                    showOilShocks && isOil && shockMarkPointData.length > 0
                      ? {
                          symbol: "circle",
                          symbolSize: CHART_LINE_SYMBOL_SIZE_COMPACT,
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
                symbolSize: chartLineRole === "secondary" ? CHART_LINE_SYMBOL_SIZE_MINI : CHART_LINE_SYMBOL_SIZE_COMPACT,
                lineStyle:
                  chartLineRole === "secondary"
                    ? {
                        color: withAlphaHsl(color, 0.55),
                        width: 1.35,
                        opacity: 1,
                        type: "dashed" as const,
                      }
                    : { color, width: 2, opacity: 1 },
                itemStyle: {
                  color: chartLineRole === "secondary" ? withAlphaHsl(color, 0.55) : color,
                  opacity: CHART_LINE_SYMBOL_ITEM_OPACITY,
                },
                ...(chartLineRole === "secondary"
                  ? {}
                  : {
                      areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                          { offset: 0, color: withAlphaHsl(color, 0.25) },
                          { offset: 1, color: withAlphaHsl(color, 0.03) },
                        ]),
                      },
                    }),
                emphasis: {
                  focus: "none" as const,
                  itemStyle: { opacity: 1 },
                  ...(chartLineRole === "secondary"
                    ? {}
                    : {
                        areaStyle: {
                          opacity: 1,
                          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: withAlphaHsl(color, 0.25) },
                            { offset: 1, color: withAlphaHsl(color, 0.03) },
                          ]),
                        },
                      }),
                },
                markLine:
                  markLineDataForRender.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: localizeChartNumericDisplayString(referenceLine.label ?? "", chartNumeralLocale) }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
                            : []),
                        ],
                      }
                    : undefined,
                markPoint:
                  showOilShocks && shockMarkPointData.length > 0 && hasData
                    ? {
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE_COMPACT,
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
                  !hasOil && (markLineDataForRender.length > 0 || referenceLine)
                    ? {
                        symbol: "none",
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: localizeChartNumericDisplayString(referenceLine.label ?? "", chartNumeralLocale) }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
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
                                    label: regimeArea.label
                                      ? {
                                          show: true,
                                          formatter: localizeChartNumericDisplayString(regimeArea.label, chartNumeralLocale),
                                          color: mutedFg,
                                          fontSize: 9,
                                          position: "insideTop" as const,
                                        }
                                      : undefined,
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
                symbol: oilOverlayLineSymbol,
                symbolSize: oilPrimarySymbolSize,
                lineStyle: {
                  color: oilPrimaryLineColor,
                  width: oilPrimaryLineWidth,
                  opacity: 1,
                  type: "solid" as const,
                },
                itemStyle: {
                  color: oilPrimaryLineColor,
                  opacity: CHART_LINE_SYMBOL_ITEM_OPACITY,
                },
                emphasis: {
                  focus: "none" as const,
                  lineStyle: { color: oilPrimaryLineColor, width: oilPrimaryLineWidth, opacity: 1 },
                  itemStyle: { color: oilPrimaryLineColor, opacity: 1 },
                },
                markPoint:
                  (showOilShocks && shockMarkPointData.length > 0) || (highlightLatestPoint && latestPointData)
                    ? {
                        symbol: "circle",
                        symbolSize: CHART_LINE_SYMBOL_SIZE_COMPACT,
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
                                  symbolSize: CHART_LINE_SYMBOL_SIZE_COMPACT,
                                  itemStyle: {
                                    color: oilPrimaryLineColor,
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
                  markLineDataForRender.length > 0 || referenceLine
                    ? {
                        symbol: "none",
                        silent: false,
                        data: [
                          ...markLineSeriesItems,
                          ...(referenceLine
                            ? [{ yAxis: referenceLine.value, label: { show: !!referenceLine.label, formatter: localizeChartNumericDisplayString(referenceLine.label ?? "", chartNumeralLocale) }, lineStyle: { color: withAlphaHsl(muted, 0.55), width: 1.5, type: "solid" as const } }]
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
                symbol: comparatorLineSymbol,
                symbolSize: comparatorLineSymbolSize,
                lineStyle: { color: comparatorColor, width: 1.25, opacity: 1 },
                itemStyle: { color: comparatorColor, opacity: CHART_LINE_SYMBOL_ITEM_OPACITY },
                emphasis: {
                  focus: "none" as const,
                  lineStyle: { color: comparatorColor, opacity: 1 },
                  itemStyle: { color: comparatorColor, opacity: 1 },
                },
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
    oilPublicationLayout,
    oilEventDensity,
    chartLineRole,
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
    groupedLegendModel,
    groupedLegendSelected,
    multiSeriesLegendGroupedVariant,
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

  const showFullRangeToolbar = showChartControls && !!rangeBounds;
  const showExportOnlyToolbar = !showChartControls && showPngExportWhenRangeHidden && !!rangeBounds;
  const chartLocaleResolved = chartLocale ?? "en";

  const studyTitleText = label.trim()
    ? localizeChartNumericDisplayString(label.trim(), chartLocaleResolved)
    : "";
  const sourceLine = formatStudyExportSourceLine(exportSourceFooter, chartLocaleResolved);

  const inner = (
    <div className={`min-w-0 flex flex-col ${STUDY_CHART_STACK_GAP_CLASS}`}>
      {showFullRangeToolbar ? (
        <StudyChartControls
          minDate={rangeBounds[0]!}
          maxDate={rangeBounds[1]!}
          startValue={clipStart}
          endValue={clipEnd}
          onStartChange={setClipStart}
          onEndChange={setClipEnd}
          onExportPng={handleExportPng}
          mode="full"
        />
      ) : showExportOnlyToolbar ? (
        <StudyChartControls
          minDate={rangeBounds[0]!}
          maxDate={rangeBounds[1]!}
          startValue={clipStart}
          endValue={clipEnd}
          onStartChange={setClipStart}
          onEndChange={setClipEnd}
          onExportPng={handleExportPng}
          mode="exportOnly"
        />
      ) : null}
      {studyTitleText ? (
        <p className={STUDY_CHART_TITLE_WRAP_CLASS} dir={chartLocaleResolved === "fa" ? "rtl" : "ltr"}>
          {studyTitleText}
        </p>
      ) : null}
      {groupedLegendModel?.variant === "grid" ? (
        <GroupedMultiSeriesLegendTable
          rowOrder={groupedLegendModel.rowOrder}
          columnOrder={groupedLegendModel.columnOrder}
          cells={groupedLegendModel.cells}
          selected={groupedLegendSelected}
          onToggleSeries={handleGroupedLegendToggle}
          dir={chartLocaleResolved === "fa" ? "rtl" : "ltr"}
        />
      ) : groupedLegendModel?.variant === "country" ? (
        <div className="min-w-0 rounded-md border border-border bg-muted/25 px-2 py-2 sm:px-3">
          <GroupedMultiSeriesCountryLegendBar
            countries={groupedLegendModel.countries}
            selected={groupedLegendSelected}
            onToggleCountry={handleGroupedCountryToggle}
            dir={chartLocaleResolved === "fa" ? "rtl" : "ltr"}
          />
          {groupedLegendModel.lineStyleKey ? (
            <GroupedMinimalLineStyleKey
              solidLabel={groupedLegendModel.lineStyleKey.solidLabel}
              dashedLabel={groupedLegendModel.lineStyleKey.dashedLabel}
              chartLocale={chartLocaleResolved}
              dir={chartLocaleResolved === "fa" ? "rtl" : "ltr"}
            />
          ) : null}
        </div>
      ) : null}
      <div ref={chartRef} className={`chart-area ${chartHeight} w-full min-w-0`} />
      {sourceLine ? (
        <p className={STUDY_CHART_SOURCE_WRAP_CLASS} dir="ltr">
          {localizeChartNumericDisplayStringSafe(sourceLine, chartLocaleResolved === "fa" ? "fa" : "en")}
        </p>
      ) : null}
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

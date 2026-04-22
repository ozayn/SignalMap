/**
 * Human-readable compact display for chart axes, tooltips, and exports.
 * - Values with |v| < 1_000: plain numbers (no K/M/B), minimal decimals.
 * - |v| ≥ 1_000: K, M, B, T (FA uses same Latin suffixes for consistency).
 * - At most one fractional digit; integers never show a trailing .0 (e.g. 2B not 2.0B).
 */

import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";

const DISPLAY_LOCALE = "en-US";

export type ChartFormatLocale = "en" | "fa";

/**
 * Economic chart display numbers: grouped thousands, no scientific notation (display only).
 * Used when compact suffixes are not wanted (e.g. small magnitudes, some tables).
 * Examples: 1_500_000 → "1,500,000"; 20_000_000 → "20,000,000".
 */
export function formatEconomicDisplay(
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number; chartLocale?: ChartFormatLocale }
): string {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 0;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  const raw = value.toLocaleString(DISPLAY_LOCALE, {
    useGrouping: true,
    maximumFractionDigits,
    minimumFractionDigits,
  });
  return localizeChartNumericDisplayString(raw, options?.chartLocale);
}

const COMPACT_TIERS = [
  { min: 1e12, div: 1e12, suffix: "T" as const },
  { min: 1e9, div: 1e9, suffix: "B" as const },
  { min: 1e6, div: 1e6, suffix: "M" as const },
  { min: 1e3, div: 1e3, suffix: "K" as const },
] as const;

/** |v| < 1_000: no K/M/B; clean presentation (axis/tooltip), preserves sign. */
function formatShortPlain(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  const a = Math.abs(value);
  const r = a >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  if (Number.isInteger(r) || Math.abs(r - Math.round(r)) < 1e-6) {
    return String(Math.round(r));
  }
  const t = a >= 10 ? r.toFixed(1) : r.toFixed(2);
  return String(Number.parseFloat(t));
}

/**
 * Strips a single trailing “.0” (and “.00”) for compact output.
 */
function trimOneDecimal(n: string): string {
  if (n.endsWith(".0")) return n.slice(0, -2);
  if (n.endsWith(".00")) return n.slice(0, -3);
  if (/\.[1-9]0$/.test(n)) return n.replace(/0$/, "");
  return n;
}

export type FormatCompactOptions = { axisTicks?: boolean; chartLocale?: ChartFormatLocale };

/**
 * Compact metric for charts: 1.2B, 45K, etc. Does **not** apply K/M/B when |v| < 1_000.
 * Pass `axisTicks: true` to prefer the same style on axis labels (strips 2.0 → 2 for integers).
 */
export function formatCompactDecimal(value: number, options?: FormatCompactOptions): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  const loc = (s: string) => localizeChartNumericDisplayString(s, options?.chartLocale);
  if (v < 1_000) {
    return loc(formatShortPlain(value));
  }
  for (const { min, div, suffix } of COMPACT_TIERS) {
    if (v >= min) {
      const scaled = v / div;
      let s = scaled.toFixed(1);
      s = trimOneDecimal(s);
      return loc(sign + s + suffix);
    }
  }
  return loc(formatShortPlain(value));
}

/** Y-axis and shared tick formatting (compact for |v| ≥ 1_000). */
export function formatChartAxisNumber(value: number, chartLocale?: ChartFormatLocale): string {
  return formatCompactDecimal(value, { axisTicks: true, chartLocale });
}

/** Tooltips: same rules as `formatChartAxisNumber` (export uses the same ECharts option). */
export function formatChartTooltipNumber(value: number, chartLocale?: ChartFormatLocale): string {
  return formatCompactDecimal(value, { axisTicks: true, chartLocale });
}

/** Levels chart values are already in billions of tomans (API). */
function isBillionTomanUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  return u.includes("billion") && u.includes("toman");
}

/** GDP / consumption / investment levels in raw US$ (WDI): show integer billions + ``B`` when |value| ≥ 1e9. */
function isGdpMacroAbsoluteUsdUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  if (u.includes("%")) return false;
  if (isBillionTomanUnit(unit)) return false;
  return u.includes("us$") || u.includes("usd") || u.includes("constant") || u.includes("current");
}

/**
 * Macro US$ levels in raw US$ (WDI). Uses same K/M/B rules as other charts (not “billions only”).
 */
export function formatGdpMacroBillionsDisplay(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "—";
  return formatCompactDecimal(value, { axisTicks: true, chartLocale });
}

/** Tooltip value fragment for GDP absolute-value charts (levels + nominal; no series label). */
export function formatGdpLevelsTooltipValue(value: number, unit: string, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "—";
  const loc = (s: string) => localizeChartNumericDisplayString(s, chartLocale);
  if (isBillionTomanUnit(unit)) {
    return loc(
      `${formatEconomicDisplay(value, { maximumFractionDigits: 2, minimumFractionDigits: 0, chartLocale })} bn tomans (approx.)`
    );
  }
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 100) / 100;
    return loc(`${formatEconomicDisplay(rounded, { maximumFractionDigits: 2, minimumFractionDigits: 0, chartLocale })} ${unit}`);
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    const core = formatGdpMacroBillionsDisplay(value, chartLocale);
    if (u.includes("constant") && u.includes("2015")) {
      return loc(`${core} USD (2015)`);
    }
    if (u.includes("current") && u.includes("us$")) {
      return loc(`${core} USD`);
    }
    return loc(`${core} ${unit}`);
  }
  return loc(`${formatChartTooltipNumber(value, chartLocale)} ${unit}`);
}

/** Y-axis tick labels for GDP absolute-value charts (linear or log). */
export function formatGdpLevelsAxisTick(value: number, unit: string, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  if (isBillionTomanUnit(unit)) {
    return formatEconomicDisplay(value, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
      minimumFractionDigits: 0,
      chartLocale,
    });
  }
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 10) / 10;
    return formatEconomicDisplay(rounded, { maximumFractionDigits: 1, minimumFractionDigits: 0, chartLocale });
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    return formatGdpMacroBillionsDisplay(value, chartLocale);
  }
  return formatChartAxisNumber(value, chartLocale);
}

/**
 * Tooltip / secondary formatting for generic multi-series economic values (non-GDP-compact paths).
 */
export function formatMultiSeriesEconomicTooltipValue(
  value: number,
  unit: string,
  chartLocale?: ChartFormatLocale
): string {
  if (!Number.isFinite(value)) return "—";
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 100) / 100;
    return formatEconomicDisplay(rounded, { maximumFractionDigits: 2, minimumFractionDigits: 0, chartLocale });
  }
  return formatChartTooltipNumber(value, chartLocale);
}

/** Y-axis tick for indexed GDP levels (ratio vs base year; display only). */
export function formatGdpIndexedAxisTick(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  const r = Math.round(value * 10) / 10;
  const raw = Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(1);
  return localizeChartNumericDisplayString(raw, chartLocale);
}

/** Tooltip line for indexed GDP levels, e.g. ``2.4× vs 2015`` or ``2.4× vs 1354`` (display only). */
export function formatGdpIndexedTooltipValue(
  value: number,
  baseLabel: string,
  chartLocale?: ChartFormatLocale
): string {
  if (!Number.isFinite(value)) return "—";
  const r = Math.round(value * 10) / 10;
  const body = Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(1);
  return localizeChartNumericDisplayString(`${body}× vs ${baseLabel}`, chartLocale);
}

/** Default y-axis tick for linear economic scales (display only). */
export function formatEconomicAxisTick(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  return formatChartAxisNumber(value, chartLocale);
}

/**
 * Back-compat re-exports and chart helpers. Core logic: `format-number-compact`.
 */

import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";
import {
  formatNumberCompact,
  unitSuggestsValuesAreInBillionsOfMajorUnit,
  unitSuggestsValuesInBillionsOfToman,
} from "./format-number-compact";

const DISPLAY_LOCALE = "en-US";

export type ChartFormatLocale = "en" | "fa";

/**
 * Grouped thousands (1,500,000). Kept for tables/notes; charts prefer `formatNumberCompact` / `formatCompactDecimal`.
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

export type FormatCompactOptions = { axisTicks?: boolean; chartLocale?: ChartFormatLocale };

/**
 * @deprecated Use `formatNumberCompact` for new code. Y-axis: k/M/B/T (EN) or Farsi words (FA).
 */
export function formatCompactDecimal(value: number, options?: FormatCompactOptions): string {
  if (!Number.isFinite(value)) return "—";
  return formatNumberCompact(value, {
    locale: options?.chartLocale ?? "en",
    mode: "axis",
    valueScale: "absolute",
    compactTiers: true,
  });
}

/** Y-axis: compact; EN uses k, M, B, T. */
export function formatChartAxisNumber(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "—";
  return formatNumberCompact(value, {
    locale: chartLocale ?? "en",
    mode: "axis",
    valueScale: "absolute",
    compactTiers: true,
  });
}

/** Tooltips: expanded English words / Farsi words (e.g. “1.2 million”, not “1.2M”); no “USD” unless a caller adds a unit. */
export function formatChartTooltipNumber(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "—";
  return formatNumberCompact(value, {
    locale: chartLocale ?? "en",
    mode: "tooltip",
    valueScale: "absolute",
    currency: "none",
    compactTiers: true,
    decimals: 1,
  });
}

function isBillionTomanUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  return u.includes("billion") && u.includes("toman");
}

/** WDI / national-accounts $ levels, oil revenue in billions, etc. — not per-barrel or FX toman/USD. */
function isGdpMacroAbsoluteUsdUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  if (u.includes("%")) return false;
  if (isBillionTomanUnit(unit)) return false;
  if (
    u.includes("bbl") ||
    u.includes("barrel") ||
    u.includes("per barrel") ||
    /بشکه/.test(unit) ||
    /تومان\s*\/\s*(usd|us\$|دلار|rial)/.test(u) ||
    (u.includes("toman/") && (u.includes("usd") || u.includes("dollar") || u.includes("دلار")))
  ) {
    return false;
  }
  return u.includes("us$") || u.includes("usd") || u.includes("constant") || u.includes("current") || /دلار/.test(unit);
}

/**
 * WDI or stylized “levels”: raw international dollars, or when `unit` names “billion” for the numeric column, plain mantissa on the axis.
 */
/**
 * When the axis / series `unit` names “billion (USD/…)” but the dataset is still in **raw**
 * international units (e.g. `1.5e11` for $150B), `valueScale: "billions"` must receive the mantissa in billions.
 * World Bank and oil-economy APIs often return raw dollars; WDI absolute levels are sometimes raw scale too.
 */
function toBillionsMantissaIfRawMajorUnit(value: number, inBillions: boolean): number {
  if (!inBillions) return value;
  const a = Math.abs(value);
  /** Raw $ totals are typically ≥ 1e6; “already billions” store values like 0.5–5e3. */
  if (a < 1e6) return value;
  return value / 1e9;
}

export function formatGdpMacroBillionsDisplay(
  value: number,
  chartLocale?: ChartFormatLocale,
  unit?: string
): string {
  if (!Number.isFinite(value)) return "—";
  const inBillions =
    unit != null &&
    (unitSuggestsValuesAreInBillionsOfMajorUnit(unit) || unitSuggestsValuesInBillionsOfToman(unit));
  const v = toBillionsMantissaIfRawMajorUnit(value, inBillions);
  if (inBillions) {
    return formatNumberCompact(v, { locale: chartLocale ?? "en", mode: "axis", valueScale: "billions" });
  }
  return formatNumberCompact(v, { locale: chartLocale ?? "en", mode: "axis", valueScale: "absolute" });
}

/**
 * ECharts `getOption()` may omit `axisLabel.formatter` in export. Reconstruct compact ticks from the
 * y-axis `name` (mirrors `ChartSeries.unit` + title hints used in `TimelineChart`).
 */
export function formatYAxisTickPresentationExportFallback(
  value: number,
  axisName: string,
  chartLocale: ChartFormatLocale = "en"
): string {
  if (!Number.isFinite(value)) return "";
  const n = axisName.trim();
  if (!n) {
    return formatChartAxisNumber(value, chartLocale);
  }
  const low = n.toLowerCase();
  if (/\b(oz|ounce|\/oz)\b|bbl|barrel|per barrel|بشکه|دلار\/بشکه|\/بشکه|gold/i.test(n)) {
    return formatChartAxisNumber(value, chartLocale);
  }
  if (/toman\/?(usd|us\$)|\busd\/?[\/]\s*rial|نرخ.*(دلار|فروش)|\b(fx|irr)\b/i.test(low) && /toman|دلار|تومان|rial/i.test(n)) {
    return formatChartAxisNumber(value, chartLocale);
  }
  if (
    (/\bindex\b|شاخص|base\s*=\s*|\(\s*100|=\s*100\b|پایه\s*=/i.test(n) && !/billion|میلیارد|revenue|income|وارد|gdp|brent|toman\//i.test(low)) ||
    /\bindex \(base/i.test(low)
  ) {
    return formatGdpIndexedAxisTick(value, chartLocale);
  }
  return formatGdpLevelsAxisTick(value, n, chartLocale);
}

/** GDP / macro / oil multi-series: single tooltip line, no `1.2B` + “billion” duplication. */
export function formatGdpLevelsTooltipValue(value: number, unit: string, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "—";
  const loc = (s: string) => localizeChartNumericDisplayString(s, chartLocale);
  const u = unit.toLowerCase();
  if (isBillionTomanUnit(unit)) {
    const v = toBillionsMantissaIfRawMajorUnit(value, true);
    return loc(
      formatNumberCompact(v, {
        locale: chartLocale ?? "en",
        mode: "tooltip",
        valueScale: "billions",
        currency: "toman",
        decimals: 1,
      })
    );
  }
  if (u.includes("%")) {
    const rounded = Math.round(value * 100) / 100;
    return loc(
      `${formatEconomicDisplay(rounded, { maximumFractionDigits: 2, minimumFractionDigits: 0, chartLocale })} ${unit}`
    );
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    const inUSD =
      unitSuggestsValuesAreInBillionsOfMajorUnit(unit) ||
      (!u.includes("toman") && (u.includes("usd") || u.includes("us$") || u.includes("dollar") || u.includes("دلار")));
    if (!inUSD) {
      return loc(`${formatChartTooltipNumber(value, chartLocale)} ${unit}`);
    }
    const inBillions = unitSuggestsValuesAreInBillionsOfMajorUnit(unit);
    const valScale: "absolute" | "billions" = inBillions ? "billions" : "absolute";
    const v = valScale === "billions" ? toBillionsMantissaIfRawMajorUnit(value, true) : value;
    const core = formatNumberCompact(v, {
      locale: chartLocale ?? "en",
      mode: "tooltip",
      valueScale: valScale,
      currency: "USD",
      decimals: 1,
    });
    if (u.includes("constant") && (u.includes("2015") || u.includes("kd"))) {
      return loc(`${core} (constant 2015 US$)`);
    }
    if (u.includes("current") && (u.includes("us$") || u.includes("cd") || u === "current us$" || u.includes("current us"))) {
      return loc(`${core} (current US$)`);
    }
    if (u.includes("constant") && u.match(/20\d{2}/) && inBillions) {
      const y = unit.match(/(20\d{2})/);
      if (y) return loc(`${core} (constant ${y[1]} US$)`);
    }
    return loc(core);
  }
  const t = formatChartTooltipNumber(value, chartLocale);
  return loc(unit.trim() ? `${t} ${unit}` : t);
}

export function formatGdpLevelsAxisTick(value: number, unit: string, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  if (isBillionTomanUnit(unit)) {
    return formatGdpMacroBillionsDisplay(value, chartLocale, unit);
  }
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 10) / 10;
    return formatEconomicDisplay(rounded, { maximumFractionDigits: 1, minimumFractionDigits: 0, chartLocale });
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    return formatGdpMacroBillionsDisplay(value, chartLocale, unit);
  }
  return formatChartAxisNumber(value, chartLocale);
}

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
  if (u.includes("billion") && (u.includes("usd") || u.includes("toman") || u.includes("دلار") || u.includes("تومان"))) {
    return formatGdpLevelsTooltipValue(value, unit, chartLocale);
  }
  if (u.includes("usd") && (u.includes("billion") || u.includes("constant") || u.includes("current"))) {
    return formatGdpLevelsTooltipValue(value, unit, chartLocale);
  }
  return formatChartTooltipNumber(value, chartLocale);
}

export function formatGdpIndexedAxisTick(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  const r = Math.round(value * 10) / 10;
  const raw = Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(1);
  return localizeChartNumericDisplayString(raw, chartLocale);
}

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

export function formatEconomicAxisTick(value: number, chartLocale?: ChartFormatLocale): string {
  if (!Number.isFinite(value)) return "";
  return formatChartAxisNumber(value, chartLocale);
}

/**
 * Single entry point for values that carry a `seriesUnit` (same strings as `ChartSeries.unit`):
 * routes through GDP/macro heuristics when appropriate, else plain compact formatting.
 * Use for study UI lines that echo chart scales.
 */
export function formatValueWithUnits(
  value: number,
  options: { locale: "en" | "fa"; context: "axis" | "tooltip"; seriesUnit: string; decimals?: number }
): string {
  if (!Number.isFinite(value)) return "—";
  const { locale, context, seriesUnit, decimals = 1 } = options;
  if (context === "axis") {
    const t = formatGdpLevelsAxisTick(value, seriesUnit, locale);
    return t || "—";
  }
  return formatGdpLevelsTooltipValue(value, seriesUnit, locale);
}

// Re-export for `import { formatNumberCompact } from "@/lib/format-compact-decimal"` in callers
export { formatNumberCompact, unitSuggestsValuesAreInBillionsOfMajorUnit } from "./format-number-compact";

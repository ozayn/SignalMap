/**
 * Human-readable compact decimals for large counts (display only).
 * Uses K / M / B / T with one decimal, e.g. 207_330_025_746 → "207.3B".
 */

const DISPLAY_LOCALE = "en-US";

/**
 * Economic chart display numbers: grouped thousands, no scientific notation (display only).
 * Examples: 1_500_000 → "1,500,000"; 20_000_000 → "20,000,000".
 */
export function formatEconomicDisplay(
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 0;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  return value.toLocaleString(DISPLAY_LOCALE, {
    useGrouping: true,
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

const TIERS = [
  { min: 1e12, div: 1e12, suffix: "T" },
  { min: 1e9, div: 1e9, suffix: "B" },
  { min: 1e6, div: 1e6, suffix: "M" },
  { min: 1e3, div: 1e3, suffix: "K" },
] as const;

export function formatCompactDecimal(
  value: number,
  options?: { axisTicks?: boolean }
): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v < 1000) {
    const body = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return sign + body;
  }
  for (const { min, div, suffix } of TIERS) {
    if (v >= min) {
      const scaled = v / div;
      let n = scaled.toFixed(1);
      if (options?.axisTicks && n.endsWith(".0")) n = n.slice(0, -2);
      return sign + n + suffix;
    }
  }
  return sign + v.toFixed(1);
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

/** Display-only: nearest integer billions + ``B`` for large macro US$; grouped below 1e9. */
export function formatGdpMacroBillionsDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) {
    return `${sign}${Math.round(abs / 1e9)}B`;
  }
  return sign + formatEconomicDisplay(Math.round(value), { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/** Tooltip value fragment for GDP absolute-value charts (levels + nominal; no series label). */
export function formatGdpLevelsTooltipValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  if (isBillionTomanUnit(unit)) {
    return `${formatEconomicDisplay(value, { maximumFractionDigits: 2, minimumFractionDigits: 0 })} bn tomans (approx.)`;
  }
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 100) / 100;
    return `${formatEconomicDisplay(rounded, { maximumFractionDigits: 2, minimumFractionDigits: 0 })} ${unit}`;
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    const core = formatGdpMacroBillionsDisplay(value);
    if (u.includes("constant") && u.includes("2015")) {
      return `${core} USD (2015)`;
    }
    if (u.includes("current") && u.includes("us$")) {
      return `${core} USD`;
    }
    return `${core} ${unit}`;
  }
  const rounded = Math.round(value);
  return `${formatEconomicDisplay(rounded, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} ${unit}`;
}

/** Y-axis tick labels for GDP absolute-value charts (linear or log). */
export function formatGdpLevelsAxisTick(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "";
  if (isBillionTomanUnit(unit)) {
    return formatEconomicDisplay(value, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
      minimumFractionDigits: 0,
    });
  }
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 10) / 10;
    return formatEconomicDisplay(rounded, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  }
  if (isGdpMacroAbsoluteUsdUnit(unit)) {
    return formatGdpMacroBillionsDisplay(value);
  }
  return formatEconomicDisplay(Math.round(value), { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/**
 * Tooltip / secondary formatting for generic multi-series economic values (non-GDP-compact paths).
 */
export function formatMultiSeriesEconomicTooltipValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  const u = unit.toLowerCase();
  if (u.includes("%")) {
    const rounded = Math.round(value * 100) / 100;
    return formatEconomicDisplay(rounded, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return formatEconomicDisplay(Math.round(value), { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  }
  const rounded2 = Math.round(value * 100) / 100;
  const maxFrac = Number.isInteger(rounded2) ? 0 : 2;
  return formatEconomicDisplay(rounded2, { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 });
}

/** Default y-axis tick for linear economic scales (display only). */
export function formatEconomicAxisTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return formatEconomicDisplay(Math.round(value), { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  }
  const r = Math.round(value * 100) / 100;
  return formatEconomicDisplay(r, { maximumFractionDigits: Number.isInteger(r) ? 0 : 2, minimumFractionDigits: 0 });
}

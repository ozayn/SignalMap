/**
 * Human-readable compact decimals for large counts (display only).
 * Uses K / M / B / T with one decimal, e.g. 207_330_025_746 → "207.3B".
 */

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

/** Tooltip value fragment for GDP absolute-value charts (levels + nominal; no series label). */
export function formatGdpLevelsTooltipValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  if (isBillionTomanUnit(unit)) {
    return `${value.toFixed(1)} bn tomans (approx.)`;
  }
  const u = unit.toLowerCase();
  if (u.includes("constant") && u.includes("2015")) {
    return `${formatCompactDecimal(value)} USD (2015)`;
  }
  if (u.includes("current") && u.includes("us$")) {
    return `${formatCompactDecimal(value)} USD`;
  }
  return `${formatCompactDecimal(value)} ${unit}`;
}

/** Y-axis tick labels for GDP absolute-value charts (linear or log). */
export function formatGdpLevelsAxisTick(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "";
  if (isBillionTomanUnit(unit)) {
    return value >= 100 ? value.toFixed(0) : value.toFixed(1);
  }
  return formatCompactDecimal(value, { axisTicks: true });
}

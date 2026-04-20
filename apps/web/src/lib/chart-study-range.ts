/** Normalize study chart bounds to `YYYY-MM-DD` for range logic and `<input type="date">`. */
export function normalizeChartRangeBound(s: string, end: boolean): string {
  const t = s.trim();
  if (t.length === 4 && /^\d{4}$/.test(t)) {
    return end ? `${t}-12-31` : `${t}-01-01`;
  }
  if (/^\d{4}-\d{2}$/.test(t)) {
    const [y, m] = t.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return t.length >= 10 ? t.slice(0, 10) : t;
    if (!end) return `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
  return t.length >= 10 ? t.slice(0, 10) : t;
}

export function clampDateToBounds(date: string, min: string, max: string): string {
  const d = date.slice(0, 10);
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

/** How coarse chart range pickers should be for a study series. */
export type ChartRangeGranularity = "year" | "month" | "day";

/** First day of calendar month from `YYYY-MM` (from `<input type="month">`). */
export function monthInputToStartDay(ym: string): string {
  return normalizeChartRangeBound(ym.trim(), false).slice(0, 10);
}

/** Last day of calendar month from `YYYY-MM`. */
export function monthInputToEndDay(ym: string): string {
  return normalizeChartRangeBound(ym.trim(), true).slice(0, 10);
}

/** `YYYY-MM` bounds for `<input type="month" min/max>`. */
export function toMonthInputMinMax(isoMin: string, isoMax: string): { min: string; max: string } {
  return { min: isoMin.slice(0, 7), max: isoMax.slice(0, 7) };
}

/** `YYYY` bounds for year number inputs. */
export function toYearInputMinMax(isoMin: string, isoMax: string): { min: number; max: number } {
  return {
    min: parseInt(isoMin.slice(0, 4), 10),
    max: parseInt(isoMax.slice(0, 4), 10),
  };
}

/**
 * Infer picker granularity from the smallest positive gap between consecutive sample dates.
 * Yearly (~365d) → year; monthly/quarterly → month; dense → day.
 */
export function inferChartRangeGranularityFromDates(dateStrings: string[]): ChartRangeGranularity {
  const days = dateStrings
    .map((d) => d.slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const uniq = [...new Set(days)];
  if (uniq.length < 2) return "day";
  let minGap = Infinity;
  for (let i = 1; i < uniq.length; i++) {
    const gap = (Date.parse(uniq[i]!) - Date.parse(uniq[i - 1]!)) / 86400000;
    if (gap > 0 && gap < minGap) minGap = gap;
  }
  if (!Number.isFinite(minGap)) return "day";
  if (minGap >= 300) return "year";
  if (minGap >= 20) return "month";
  return "day";
}

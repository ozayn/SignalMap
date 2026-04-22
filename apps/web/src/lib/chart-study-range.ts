/** Normalize study export range bounds to `YYYY-MM-DD` (calendar-year mode uses `YYYY-01-01` / `YYYY-12-31`). */
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

/**
 * How export filenames disambiguate the range segment (`2018-2024` vs `20180115-20191220`).
 * Study range pickers use **year** only; month/day are kept for pathological raw ISO spans.
 */
export type ChartRangeGranularity = "year" | "month" | "day";

/** `YYYY` bounds for year number inputs. */
export function toYearInputMinMax(isoMin: string, isoMax: string): { min: number; max: number } {
  return {
    min: parseInt(isoMin.slice(0, 4), 10),
    max: parseInt(isoMax.slice(0, 4), 10),
  };
}

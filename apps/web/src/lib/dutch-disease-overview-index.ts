/**
 * Client-side indexed overlay for the Dutch disease diagnostics study.
 * Each series is re-based to 100 in a common calendar year so different units (% of GDP vs toman/USD) are comparable as patterns only.
 */

import { indexSeriesAtBaseYear, yearFromIsoDate, type GdpLevelPoint } from "@/lib/gdp-levels-indexed";

export type DutchOverviewSeriesInput = {
  key: string;
  points: GdpLevelPoint[];
};

/** One value per calendar year: mean of all observations in that year (for FX daily → annual). */
export function annualMeanPointsByGregorianYear(points: GdpLevelPoint[]): GdpLevelPoint[] {
  const sums = new Map<number, { sum: number; n: number }>();
  for (const p of points) {
    const y = yearFromIsoDate(p.date);
    if (!Number.isFinite(y)) continue;
    const v = p.value;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const prev = sums.get(y) ?? { sum: 0, n: 0 };
    prev.sum += v;
    prev.n += 1;
    sums.set(y, prev);
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, { sum, n }]) => ({ date: `${y}-01-01`, value: n > 0 ? sum / n : Number.NaN }))
    .filter((p) => Number.isFinite(p.value));
}

function yearValueMap(points: GdpLevelPoint[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of points) {
    const y = yearFromIsoDate(p.date);
    const v = p.value;
    if (!Number.isFinite(y) || typeof v !== "number" || !Number.isFinite(v) || v === 0) continue;
    if (!m.has(y)) m.set(y, v);
  }
  return m;
}

/**
 * Earliest calendar year (preferring ``preferredYear`` when valid) where every non-empty series has a finite, non-zero value.
 */
export function resolveCommonIndexBaseYear(series: DutchOverviewSeriesInput[], preferredYear = 2000): number | null {
  const maps = series.filter((s) => s.points.length > 0).map((s) => yearValueMap(s.points));
  if (maps.length === 0) return null;
  const years = new Set<number>();
  for (const mp of maps) for (const y of mp.keys()) years.add(y);
  const sorted = [...years].sort((a, b) => a - b);
  const tryFirst = sorted.includes(preferredYear) ? [preferredYear, ...sorted.filter((y) => y !== preferredYear)] : sorted;
  for (const y of tryFirst) {
    if (maps.every((mp) => {
      const v = mp.get(y);
      return v != null && v !== 0 && Number.isFinite(v);
    }))
      return y;
  }
  return null;
}

/** index = 100 × (value / value in base year); non-finite values become NaN (gaps). */
export function indexSeriesTo100(points: GdpLevelPoint[], baseYear: number): GdpLevelPoint[] {
  return indexSeriesAtBaseYear(points, baseYear).map((p) => ({
    ...p,
    value: Number.isFinite(p.value) ? 100 * p.value : Number.NaN,
  }));
}

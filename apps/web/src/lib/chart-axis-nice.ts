/**
 * “Nice” ticks for share / percent-style value axes (0–100-ish) so ECharts does not end on 49.6%.
 */

export function pickNiceYStepForPercentLike(hi: number): number {
  if (!Number.isFinite(hi) || hi <= 0) return 10;
  if (hi <= 25) return 5;
  if (hi <= 100) return 10;
  if (hi <= 200) return 20;
  if (hi <= 400) return 50;
  const pow = 10 ** Math.floor(Math.log10(hi));
  const n = hi / pow;
  if (n <= 1.2) return pow;
  if (n <= 2.5) return 2 * pow;
  if (n <= 6) return 5 * pow;
  return 10 * pow;
}

/** From data extrema: integer multiple step for max; min 0 when all values are non-negative. */
export function nicePercentShareAxisRange(values: number[]): { min: number; max: number; interval: number } | null {
  let hi = -Infinity;
  let lo = Infinity;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
  }
  if (!Number.isFinite(hi) || hi < 0) return null;
  const step = pickNiceYStepForPercentLike(hi);
  const max = Math.ceil(hi / step) * step;
  const min = lo >= 0 ? 0 : Math.floor(lo / step) * step;
  return { min, max, interval: step };
}

export function axisNameLooksPercentShare(name: unknown): boolean {
  return typeof name === "string" && /%|٪/.test(name);
}

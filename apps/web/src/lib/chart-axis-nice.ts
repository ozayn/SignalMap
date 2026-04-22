/**
 * Slide-export Y-axis: expand slightly past data, then min/max/interval on clean 1–2–5×10^n steps
 * (targets ~4–6 tick *labels*) so ECharts does not end on 6.23, 117.4, etc.
 * Example: `[1.9, 6.23]` (after data→pad) → about `[1, 7]` with `interval: 1`;
 * `[42, 117]` → about `[40, 120]` with `interval: 20`.
 */
export function computeNiceAxisBounds(
  min: number,
  max: number,
  opts: { maxTicks?: number; padFraction?: number } = {}
): { min: number; max: number; interval: number } {
  /** How many Y tick *labels* at most (≈4–6 for slides). */
  const maxLabelCount = Math.min(6, Math.max(3, opts.maxTicks ?? 6));
  const padF = typeof opts.padFraction === "number" && opts.padFraction >= 0 ? opts.padFraction : 0.05;

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, interval: 1 };
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  if (Object.is(min, max)) {
    const d = Math.max(Math.abs(min) * 0.06, 1e-6);
    min -= d;
    max += d;
  }
  const span0 = max - min;
  const p = Math.max(span0 * padF, (Math.abs(min) + Math.abs(max)) * 0.5 * 1e-6);
  let lo = min - p;
  let hi = max + p;
  if (hi <= lo) {
    const e = 1e-3 * (Math.abs(min) + 1);
    lo = min - e;
    hi = max + e;
  }
  const rawSpan = hi - lo;
  const rough = rawSpan / Math.max(1, maxLabelCount - 1);
  let step = pickNiceMagnitudeStep(rough);
  let nMin = floorToStep(lo, step);
  let nMax = ceilToStep(hi, step);
  for (let i = 0; i < 10; i++) {
    if (nMax < nMin) nMax = nMin + step;
    const nDivs = (nMax - nMin) / step;
    /** nDivs = segment count; labels = nDivs + 1 on a uniform interval scale. */
    if (nDivs + 1e-9 <= maxLabelCount) {
      return { min: nMin, max: nMax, interval: step };
    }
    step = nextLargerNiceStep(step);
    nMin = floorToStep(lo, step);
    nMax = ceilToStep(hi, step);
  }
  if (nMax < nMin) nMax = nMin + step;
  return { min: nMin, max: nMax, interval: step };
}

function floorToStep(v: number, step: number): number {
  return Math.floor(v / step + 1e-9) * step;
}

function ceilToStep(v: number, step: number): number {
  return Math.ceil(v / step - 1e-9) * step;
}

/** A “nice” step: 1, 2, 5, 10, … times 10^n, ≥ `rough` when possible. */
function pickNiceMagnitudeStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) {
    return 1;
  }
  const p10 = 10 ** Math.floor(Math.log10(rough));
  const f = rough / p10;
  if (f <= 1) return 1 * p10;
  if (f <= 2) return 2 * p10;
  if (f <= 5) return 5 * p10;
  return 10 * p10;
}

function nextLargerNiceStep(s: number): number {
  if (!Number.isFinite(s) || s <= 0) {
    return 1;
  }
  const p10 = 10 ** Math.floor(Math.log10(s) + 1e-9);
  const c = s / p10;
  if (c < 1) return 1 * p10;
  if (c < 2) return 2 * p10;
  if (c < 2.1) {
    return 2 * p10;
  }
  if (c < 5) {
    return 5 * p10;
  }
  if (c < 10) {
    return 10 * p10;
  }
  return 20 * p10;
}

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

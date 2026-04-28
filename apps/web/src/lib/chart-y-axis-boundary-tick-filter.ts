/**
 * Hides y-axis tick labels that sit on padded min/max extents but are not "clean"
 * (e.g. log mantissa off 1–2–5×10^n, linear ticks off the declared interval, or
 * compact EN labels like 285.7k / 4.07). Interior ticks keep the normal formatter.
 */

export type YAxisBoundaryTickCtx = {
  axisType: "value" | "log";
  min: number | null;
  max: number | null;
  interval?: number | null;
};

/** Log-scale ticks we keep at axis extremes: 1, 2, 5 × 10^n (and exact 10×10^n). */
export function isCleanLog125DecadeTick(v: number): boolean {
  if (!(v > 0) || !Number.isFinite(v)) return false;
  const logv = Math.log10(v);
  const decade = Math.floor(logv + 1e-12);
  const mant = v / 10 ** decade;
  const targets = [1, 2, 5, 10];
  return targets.some((t) => Math.abs(mant - t) / Math.max(t, 1) < 0.02);
}

function linearAxisSpan(min: number | null, max: number | null, v: number): number {
  if (min != null && max != null && Number.isFinite(min) && Number.isFinite(max)) {
    return Math.max(Math.abs(max - min), 1e-12);
  }
  if (min != null && Number.isFinite(min)) {
    return Math.max(Math.abs(min), Math.abs(v), 1e-12);
  }
  if (max != null && Number.isFinite(max)) {
    return Math.max(Math.abs(max), Math.abs(v), 1e-12);
  }
  return 1;
}

/** Linear distance tolerance at axis ends (ticks are often slightly inside numeric min/max). */
function linearBoundaryEpsilon(v: number, min: number | null, max: number | null): number {
  const span = linearAxisSpan(min, max, v);
  return Math.max(1e-12, span * 4e-4, Math.abs(v) * 2e-6, 1e-9 * (Math.abs(v) + 1));
}

/**
 * Log axes: "near min/max" in log₁₀ space so a top tick like 2.86e5 is caught when
 * axis max is ~3e5 or ~2.9e5 (linear epsilon would miss by thousands).
 */
function isNearLogAxisExtent(v: number, min: number | null, max: number | null): boolean {
  if (!(v > 0) || !Number.isFinite(v)) return false;
  const logV = Math.log10(v);
  if (min != null && min > 0 && Number.isFinite(min)) {
    const logMin = Math.log10(min);
    const logSpan =
      max != null && max > 0 && Number.isFinite(max)
        ? Math.max(Math.log10(max) - logMin, 1e-10)
        : Math.max(logV - logMin, 0.15);
    const band = Math.max(0.075, Math.min(0.32, logSpan * 0.065));
    if (logV - logMin <= band) return true;
  }
  if (max != null && max > 0 && Number.isFinite(max)) {
    const logMax = Math.log10(max);
    const logSpan =
      min != null && min > 0 && Number.isFinite(min)
        ? Math.max(logMax - Math.log10(min), 1e-10)
        : Math.max(logMax - logV, 0.15);
    const band = Math.max(0.075, Math.min(0.32, logSpan * 0.065));
    if (logMax - logV <= band) return true;
  }
  return false;
}

function isNearAxisExtent(
  v: number,
  min: number | null,
  max: number | null,
  axisType: "value" | "log"
): boolean {
  if (axisType === "log") {
    return isNearLogAxisExtent(v, min, max);
  }
  const eps = linearBoundaryEpsilon(v, min, max);
  if (min != null && Number.isFinite(min) && Math.abs(v - min) <= eps) return true;
  if (max != null && Number.isFinite(max) && Math.abs(v - max) <= eps) return true;
  return false;
}

function isOnUniformLinearGrid(v: number, gridMin: number, interval: number): boolean {
  if (!(interval > 0) || !Number.isFinite(v) || !Number.isFinite(gridMin)) return false;
  const k = (v - gridMin) / interval;
  return Math.abs(k - Math.round(k)) < 1e-5;
}

/** EN compact / plain axis strings that look like padded-extent artifacts (boundary only). */
export function formattedYAxisBoundaryLooksUgly(formatted: string, rawValue: number): boolean {
  const t = formatted.trim();
  if (!t) return true;
  if (/[%٪]/.test(t)) return false;
  if (/[\u0600-\u06FF۰-۹]/.test(t)) return false;
  if (/[kMBT]$/i.test(t) && /\.\d/.test(t)) return true;
  if (!/[kMBT]$/i.test(t) && Math.abs(rawValue) >= 1 && /^-?\d+\.\d{2,}$/.test(t)) return true;
  return false;
}

export function shouldHideYAxisBoundaryTickLabel(
  rawValue: number,
  formatted: string,
  ctx: YAxisBoundaryTickCtx
): boolean {
  const { axisType, min, max, interval } = ctx;
  if (!Number.isFinite(rawValue)) return false;
  if (min == null && max == null) return false;
  if (!isNearAxisExtent(rawValue, min, max, axisType)) return false;

  if (axisType === "log" && !isCleanLog125DecadeTick(rawValue)) return true;

  if (axisType === "value" && interval != null && interval > 0 && min != null && Number.isFinite(min)) {
    if (!isOnUniformLinearGrid(rawValue, min, interval)) return true;
  }

  if (formattedYAxisBoundaryLooksUgly(formatted, rawValue)) return true;
  return false;
}

export function wrapYAxisTickFormatterForBoundaryArtifacts(
  inner: (v: number | string) => string,
  ctx: YAxisBoundaryTickCtx | null
): (v: number | string) => string {
  if (!ctx || (ctx.min == null && ctx.max == null)) return inner;
  return (value: number | string) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return inner(value);
    const formatted = inner(value);
    if (shouldHideYAxisBoundaryTickLabel(n, formatted, ctx)) return "";
    return formatted;
  };
}

function coerceFiniteAxisNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * After axis min/max/interval are merged (e.g. export data-fit), wrap each value/log
 * y-axis `axisLabel.formatter` so padded-extent ticks return an empty label when ugly.
 */
export function buildYAxisBoundaryTickFormatterPatch(opt: Record<string, unknown>): Record<string, unknown> | null {
  const yRaw = opt.yAxis;
  const list = Array.isArray(yRaw) ? yRaw : yRaw != null ? [yRaw] : [];
  const out: Record<string, unknown>[] = [];
  let any = false;

  for (const raw of list) {
    const ax = raw as Record<string, unknown>;
    const typ = ax.type === "log" ? "log" : ax.type === "value" ? "value" : null;
    if (!typ) {
      out.push({});
      continue;
    }
    const al = (ax.axisLabel ?? {}) as Record<string, unknown>;
    const inner = al.formatter;
    if (typeof inner !== "function") {
      out.push({});
      continue;
    }
    const min = coerceFiniteAxisNumber(ax.min);
    const max = coerceFiniteAxisNumber(ax.max);
    if (min == null && max == null) {
      out.push({});
      continue;
    }
    const interval = coerceFiniteAxisNumber(ax.interval);
    const ctx: YAxisBoundaryTickCtx = {
      axisType: typ,
      min,
      max,
      interval: interval ?? null,
    };
    const wrapped = wrapYAxisTickFormatterForBoundaryArtifacts(inner as (v: number | string) => string, ctx);
    out.push({ axisLabel: { formatter: wrapped } });
    any = true;
  }

  if (!any) return null;
  return { yAxis: out.length === 1 ? out[0]! : out };
}

/** Same padding ratios as `buildExportDataFitAxisPatch` (log branch). */
const EXPORT_LOG_PAD_FRACTION = 0.05;
const EXPORT_Y_PAD_FRACTION = 0.05;
const EXPORT_Y_MIN_SPAN_RATIO = 0.06;

export function paddedLogAxisExtentFromData(lo: number, hi: number): { min: number; max: number } | null {
  if (!(lo > 0) || !(hi > 0) || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (hi < lo) [lo, hi] = [hi, lo];
  const logLo = Math.log(lo);
  const logHi = Math.log(hi);
  let logSpan = logHi - logLo;
  if (logSpan <= 0 || !Number.isFinite(logSpan)) logSpan = EXPORT_Y_MIN_SPAN_RATIO;
  const logPad = Math.max(logSpan * EXPORT_LOG_PAD_FRACTION, 1e-6);
  let nymin = Math.exp(logLo - logPad);
  let nymax = Math.exp(logHi + logPad);
  if (nymin <= 0 || !Number.isFinite(nymin)) nymin = lo * 0.92;
  if (nymax <= nymin || !Number.isFinite(nymax)) nymax = hi * 1.08;
  return { min: nymin, max: nymax };
}

export function paddedLinearAxisExtentFromData(lo: number, hi: number): { min: number; max: number } | null {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (hi < lo) [lo, hi] = [hi, lo];
  const span = hi - lo;
  if (span <= 0 || !Number.isFinite(span)) {
    const mid = lo;
    const absPad = Math.max(Math.abs(mid) * EXPORT_Y_MIN_SPAN_RATIO, 1e-12);
    return { min: mid - absPad, max: mid + absPad };
  }
  const pad = span * EXPORT_Y_PAD_FRACTION;
  let nymin = lo - pad;
  let nymax = hi + pad;
  const minSpan = Math.max(span * EXPORT_Y_MIN_SPAN_RATIO, 1e-12);
  if (nymax - nymin < minSpan) {
    const mid = (lo + hi) / 2;
    nymin = mid - minSpan / 2;
    nymax = mid + minSpan / 2;
  }
  return { min: nymin, max: nymax };
}

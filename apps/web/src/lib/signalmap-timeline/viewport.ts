/**
 * Parse YYYY-MM-DD to UTC midnight ms. Use a leading minus before the year for BCE
 * (e.g. `-550-01-15` for 550 BCE); CE years use four digits as usual.
 */
export function parseYmdToUtcMs(ymd: string): number {
  const t = ymd.trim();
  const bce = t.match(/^-(\d{1,4})-(\d{2})-(\d{2})$/);
  if (bce) {
    return Date.UTC(-Number(bce[1]), Number(bce[2]) - 1, Number(bce[3]));
  }
  const p = t.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    return Date.parse(ymd);
  }
  const [y, m, d] = p.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function eventEndMs(ymd: string, dateEnd?: string | null): number {
  if (dateEnd) return parseYmdToUtcMs(dateEnd);
  return parseYmdToUtcMs(ymd);
}

export function zoomAroundCenter(
  startMs: number,
  endMs: number,
  centerMs: number,
  factor: number,
  domainStart: number,
  domainEnd: number
): { startMs: number; endMs: number } {
  const w = (endMs - startMs) * factor;
  const d = domainEnd - domainStart;
  if (w >= d) {
    return { startMs: domainStart, endMs: domainEnd };
  }
  let a = centerMs - w / 2;
  let b = centerMs + w / 2;
  if (a < domainStart) {
    a = domainStart;
    b = domainStart + w;
  }
  if (b > domainEnd) {
    b = domainEnd;
    a = domainEnd - w;
  }
  return { startMs: a, endMs: b };
}

export type AxisTick = { tMs: number; label: string; minor: boolean };

const DAY = 86_400_000;
/** ~mean Gregorian year in ms (1 Jan step spacing in the visible window) */
const MS_PER_YEAR = 365.2425 * DAY;

function yearTickMsAtJan1(y: number): number {
  return Date.UTC(y, 0, 1);
}

/**
 * Generate 1 Jan UTC ticks in [startMs, endMs] on a step-year grid.
 * `firstGridYear = ceil(startYear / step) * step` then +step. Panning only changes the
 * visible [startMs,endMs]; all ticks stay on 1 Jan of clean year multiples.
 */
function yearTicksInView(
  startMs: number,
  endMs: number,
  step: number
): { tMs: number; label: string }[] {
  const out: { tMs: number; label: string }[] = [];
  if (endMs <= startMs || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return out;

  const yStart = new Date(startMs).getUTCFullYear();
  let y = Math.ceil(yStart / step) * step;
  const yGuardMax = 4000;
  let guard = 0;
  while (guard < 5000) {
    guard += 1;
    if (y > yGuardMax) break;
    const t = yearTickMsAtJan1(y);
    if (t > endMs) break;
    if (t >= startMs) {
      out.push({ tMs: t, label: String(y) });
    }
    y += step;
  }
  return out;
}

function minConsecutiveTickGapPx(
  ticks: { tMs: number }[],
  viewStart: number,
  viewEnd: number,
  w: number
): number {
  if (ticks.length < 2) return Number.POSITIVE_INFINITY;
  const s = viewEnd - viewStart;
  if (s <= 0) return 0;
  let m = Number.POSITIVE_INFINITY;
  for (let i = 1; i < ticks.length; i++) {
    const dt = ticks[i]!.tMs - ticks[i - 1]!.tMs;
    const px = (dt / s) * w;
    m = Math.min(m, px);
  }
  return m;
}

function subsampleTicks(
  ticks: { tMs: number; label: string }[],
  maxCount: number
): { tMs: number; label: string }[] {
  if (ticks.length <= maxCount) return ticks;
  const n = ticks.length;
  const every = Math.max(1, Math.ceil(n / maxCount));
  return ticks.filter((_, i) => i % every === 0);
}

type ZoomTier = "full" | "medium" | "strong";

function pickZoomTier(
  viewPortion: number,
  spanViewMs: number
): ZoomTier {
  const spanY = spanViewMs / MS_PER_YEAR;
  if (spanY < 18) return "strong";
  if (viewPortion >= 0.35) return "full";
  if (viewPortion >= 0.05) return "medium";
  if (spanY < 50) return "strong";
  return "strong";
}

/**
 * **Finest first:** try small year steps before large ones so we get as many labels as width allows.
 * Tier only trims the upper end for very long spans (avoid 100y grid when the window is < ~40y).
 * Order is always 1,2,5,10,20,50,100; `takeIfOk` picks the first (densest) that does not overlap.
 */
function yearAxisStepsToTry(
  tier: ZoomTier,
  spanY: number
): number[] {
  if (spanY < 1.2) {
    return [1];
  }
  const all = [1, 2, 5, 10, 20, 50, 100] as const;
  let maxStep = 100;
  if (spanY < 3) {
    maxStep = 5;
  } else if (tier === "strong") {
    maxStep = 20;
  } else if (tier === "medium") {
    maxStep = 100;
  } else {
    /** Full/wide: still try 1y…, but cap coarseness for huge spans. */
    maxStep = spanY < 30 ? 20 : spanY < 80 ? 100 : 100;
  }
  return all.filter((s) => s <= maxStep);
}

export type BuildYearAxisOptions = {
  /**
   * (viewEnd - viewStart) / (domainEnd - domainStart). 1 = full domain, small = zoomed in.
 * Drives which step tier is used; pan changes start/end, not the domain, so the tier is stable
 * until zoom, while Jan 1 alignment is preserved.
 */
  viewPortion: number;
  domainStartMs: number;
  domainEndMs: number;
  minLabelPx?: number;
  /** Slightly more labels on wide band timelines when unset (42 vs 56). */
  minLabelPxFloor?: number;
  /** Cap on tick count; defaults scale with width. */
  maxLabelCount?: number;
};

/**
 * **Zoom-tiered, Jan-1–aligned axis.** Steps are only clean calendar multiples (1,2,5,10,20,50,100y).
 * **No collision:** at most `min(maxLabelCount, floor(width / minLabelPx))` labels; minimum gap
 * between consecutive label centers ≥ 0.88 * minLabelPx. **Density:** picks the **smallest** step
 * (e.g. 5y before 20y) that still satisfies those constraints, so wide views get ~10y instead of 100y.
 * Recomputes whenever the visible window, zoom, or `contentWidthPx` changes.
 */
export function buildYearAxisTicks(
  startMs: number,
  endMs: number,
  contentWidthPx: number,
  opts: BuildYearAxisOptions
): AxisTick[] {
  const out: AxisTick[] = [];
  if (endMs <= startMs || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return out;
  }
  const floor = opts.minLabelPxFloor ?? 42;
  const minLabelPx = Math.max(32, Math.min(76, opts.minLabelPx ?? floor));
  const w = Math.max(1, contentWidthPx);
  const spanView = endMs - startMs;
  const spanY = Math.max(1e-6, spanView / MS_PER_YEAR);
  const maxCap = opts.maxLabelCount ?? 36;
  const maxFitting = Math.max(2, Math.min(maxCap, Math.floor(w / minLabelPx)));
  const gapMin = minLabelPx * 0.88;

  const { viewPortion } = opts;
  const tier = pickZoomTier(
    viewPortion,
    spanView
  );
  const order = yearAxisStepsToTry(tier, spanY);

  const takeIfOk = (ticks: { tMs: number; label: string }[]): boolean => {
    if (ticks.length === 0) {
      return false;
    }
    if (ticks.length > maxFitting) {
      return false;
    }
    const gap = minConsecutiveTickGapPx(ticks, startMs, endMs, w);
    if (ticks.length >= 2 && gap < gapMin) {
      return false;
    }
    return true;
  };

  let chosen: { tMs: number; label: string }[] = [];

  /** Finer year grids first: prefer 5y/10y over 50y when the screen can fit the labels. */
  for (const step of order) {
    const ticks = yearTicksInView(startMs, endMs, step);
    if (takeIfOk(ticks)) {
      chosen = ticks;
      break;
    }
  }

  if (chosen.length === 0) {
    for (const step of [1, 2, 5, 10, 20, 50, 100] as const) {
      const ticks = yearTicksInView(startMs, endMs, step);
      if (takeIfOk(ticks)) {
        chosen = ticks;
        break;
      }
    }
  }
  if (chosen.length > maxFitting) {
    chosen = subsampleTicks(chosen, maxFitting);
  }
  for (const t of chosen) {
    out.push({ tMs: t.tMs, label: t.label, minor: false });
  }
  if (out.length === 0) {
    const mid = (startMs + endMs) / 2;
    out.push({ tMs: mid, label: String(new Date(mid).getUTCFullYear()), minor: false });
  }
  return out;
}

export function ymdLabel(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

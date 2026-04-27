/** Parse YYYY-MM-DD to UTC midnight ms (calendar placement on timeline). */
export function parseYmdToUtcMs(ymd: string): number {
  const p = ymd.slice(0, 10);
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
 * Tries candidate steps; returns first set that fits count and minimum pixel gap (no collisions).
 * - `full` (broad / low zoom): decade, half-century, or century (10, 20, 50, 100). Order coarse→fine
 *   so 50y / 20y / 10y are preferred.
 * - `medium`: 10y, 5y, then 20y for awkward spans.
 * - `strong` (narrow / high zoom): 1y, 2y, 5y (order fine→coarse) for yearly at strong zoom.
 */
function candidateSteps(tier: ZoomTier, spanY: number): number[] {
  if (spanY < 3) {
    return [1, 2, 5];
  }
  switch (tier) {
    case "full":
      if (spanY < 30) {
        return [20, 10, 5, 2, 1];
      }
      return [100, 50, 20, 10];
    case "medium":
      return [10, 5, 20];
    case "strong":
      return [1, 2, 5, 10];
    default:
      return [1, 2, 5, 10];
  }
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
};

/**
 * **Zoom-tiered, Jan-1–aligned axis.** Steps are only clean calendar multiples (1,2,5,10,20,50,100y).
 * **No collision:** at most `floor(width / minLabelPx)` labels and minimum consecutive tick gap
 * in pixels ≥ 0.85 * minLabelPx. Pan keeps alignment because ticks are 1 Jan on integer grids.
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
  const minLabelPx = Math.max(36, Math.min(80, opts.minLabelPx ?? 56));
  const w = Math.max(1, contentWidthPx);
  const spanView = endMs - startMs;
  const spanY = Math.max(1e-6, spanView / MS_PER_YEAR);
  const maxFitting = Math.max(2, Math.min(28, Math.floor(w / minLabelPx)));
  const gapMin = minLabelPx * 0.9;

  const { viewPortion } = opts;
  const tier = pickZoomTier(
    viewPortion,
    spanView
  );
  const order = candidateSteps(tier, spanY);

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

  for (const step of order) {
    const ticks = yearTicksInView(startMs, endMs, step);
    if (takeIfOk(ticks)) {
      chosen = ticks;
      break;
    }
  }

  if (chosen.length === 0) {
    for (const step of [100, 50, 20, 10, 5, 2, 1] as const) {
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

import { getBandEventEndMs, getBandEventStartMs } from "./bounds";
import type { BandTimelinePeriodEvent } from "./types";

/**
 * X position in viewport → time (ms) along the current view. Clamped to [0,1] in track.
 */
export function clientXToTimeOnTrack(
  clientX: number,
  rect: DOMRect,
  viewStart: number,
  viewEnd: number
): number {
  const w = viewEnd - viewStart;
  if (rect.width <= 0) return (viewStart + viewEnd) / 2;
  const f = (clientX - rect.left) / rect.width;
  return viewStart + Math.max(0, Math.min(1, f)) * w;
}

/**
 * “Near” a point: horizontal slop, expressed in time for the current view width.
 */
export function timeSlopForPixels(
  slopPx: number,
  trackWidthPx: number,
  viewStart: number,
  viewEnd: number
): number {
  const w = viewEnd - viewStart;
  if (trackWidthPx < 1) return 0;
  return (slopPx / trackWidthPx) * w;
}

/**
 * For hit-testing **period bands only** (the transparent layer under point markers):
 * return every visible period in this lane that contains time `t`.
 * Points/clusters are handled with higher z-index + stopPropagation, not this helper.
 */
export function periodsContainingTime(
  periods: readonly BandTimelinePeriodEvent[],
  t: number
): BandTimelinePeriodEvent[] {
  const inRange: BandTimelinePeriodEvent[] = [];
  for (const e of periods) {
    const a0 = getBandEventStartMs(e);
    const a1 = getBandEventEndMs(e);
    if (t >= a0 && t <= a1) {
      inRange.push(e);
    }
  }
  return inRange;
}

function spanWidthMs(p: BandTimelinePeriodEvent): number {
  return getBandEventEndMs(p) - getBandEventStartMs(p);
}

/**
 * Shorter (narrower) intervals are more specific; prefer for click and hover when bands overlap in time.
 */
export function narrowestPeriod(
  periods: readonly BandTimelinePeriodEvent[]
): BandTimelinePeriodEvent | null {
  if (periods.length === 0) return null;
  if (periods.length === 1) return periods[0] ?? null;
  return [...periods].sort((a, b) => spanWidthMs(a) - spanWidthMs(b))[0] ?? null;
}

/**
 * Wider (longer) first for **DOM paint order** so narrower bands stack above longer ones
 * in the same lane when using simple stacking.
 */
export function sortPeriodsWideToNarrow(
  periods: readonly BandTimelinePeriodEvent[]
): BandTimelinePeriodEvent[] {
  return [...periods].sort(
    (a, b) =>
      getBandEventEndMs(b) - getBandEventStartMs(b) - (getBandEventEndMs(a) - getBandEventStartMs(a))
  );
}

export type BandLaneLayerHitResult =
  | { kind: "empty" }
  | { kind: "single"; e: BandTimelinePeriodEvent }
  | { kind: "overlap"; all: BandTimelinePeriodEvent[]; focus: BandTimelinePeriodEvent };

/**
 * Resolve which band/period the hit layer is over (not used when pointer is over a
 * point or cluster: those are higher z and stopPropagation).
 */
export function resolveBandLaneLayerHit(periodsContaining: BandTimelinePeriodEvent[]): BandLaneLayerHitResult {
  if (periodsContaining.length === 0) {
    return { kind: "empty" };
  }
  if (periodsContaining.length === 1) {
    const e = periodsContaining[0]!;
    return { kind: "single", e };
  }
  const focus = narrowestPeriod(periodsContaining) ?? periodsContaining[0]!;
  return { kind: "overlap", all: periodsContaining, focus };
}

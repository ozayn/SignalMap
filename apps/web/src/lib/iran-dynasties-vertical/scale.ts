import type { IranVerticalDynasty } from "./types";

/**
 * Map a calendar year to a Y offset in pixels. Present (larger `year` / more recent) is at the top (0).
 * `tMax` = top of track (e.g. current year), `tMin` = bottom (oldest year in view).
 */
export function yearToOffsetFromTop(
  year: number,
  tMin: number,
  tMax: number,
  trackHeightPx: number
): number {
  const span = Math.max(1, tMax - tMin);
  return ((tMax - year) / span) * trackHeightPx;
}

/**
 * Top (from track top) and height for a dynasty band: `end_year` is the more recent boundary
 * (closer to tMax), `start_year` the older (closer to tMin).
 */
export function bandRectFromYears(
  startYear: number,
  endYear: number,
  tMin: number,
  tMax: number,
  trackHeightPx: number
): { top: number; height: number } {
  const yNewer = yearToOffsetFromTop(endYear, tMin, tMax, trackHeightPx);
  const yOlder = yearToOffsetFromTop(startYear, tMin, tMax, trackHeightPx);
  return { top: yNewer, height: Math.max(0, yOlder - yNewer) };
}

/**
 * Global domain: from the oldest `start_year` in the set to the present (inclusive top).
 */
export function getVerticalTimelineDomain(
  items: readonly IranVerticalDynasty[],
  presentYear: number
): { tMin: number; tMax: number } {
  let tMin = Infinity;
  for (const d of items) {
    tMin = Math.min(tMin, d.start_year, d.end_year);
  }
  if (!Number.isFinite(tMin)) {
    return { tMin: -1000, tMax: presentYear };
  }
  return { tMin, tMax: presentYear };
}

export function totalSpanYears(tMin: number, tMax: number): number {
  return tMax - tMin;
}

/**
 * Map a year to an X offset from the left. Oldest `tMin` = 0; present / `tMax` = `trackWidthPx` (LTR, past → future).
 */
export function yearToOffsetFromLeft(
  year: number,
  tMin: number,
  tMax: number,
  trackWidthPx: number
): number {
  const span = Math.max(1, tMax - tMin);
  return ((year - tMin) / span) * trackWidthPx;
}

/**
 * `left` and `width` in px for a horizontal band. Newer (larger) year is the right edge.
 */
export function bandRectFromYearsHorizontal(
  startYear: number,
  endYear: number,
  tMin: number,
  tMax: number,
  trackWidthPx: number
): { left: number; width: number } {
  const xStart = yearToOffsetFromLeft(startYear, tMin, tMax, trackWidthPx);
  const xEnd = yearToOffsetFromLeft(endYear, tMin, tMax, trackWidthPx);
  return { left: xStart, width: Math.max(0, xEnd - xStart) };
}

/**
 * True if `d` is a strictly shorter span that lies inside another polity
 * (e.g. Sāmānid inside the early caliphal / Iranian-Islamic schematic band).
 */
export function isStrictlyNestedInAnother(
  d: IranVerticalDynasty,
  all: readonly IranVerticalDynasty[]
): boolean {
  for (const p of all) {
    if (p.id === d.id) continue;
    if (d.start_year < p.start_year || d.end_year > p.end_year) continue;
    if (d.start_year === p.start_year && d.end_year === p.end_year) continue;
    if (d.end_year - d.start_year >= p.end_year - p.start_year) continue;
    return true;
  }
  return false;
}

/**
 * True if some other polity is a strict time-subspan of `d` (nested on top in the same strip);
 * the parent’s in-band label would sit under the child, so the strip should not show a centered name.
 */
export function hasStrictSubspanChild(
  d: IranVerticalDynasty,
  all: readonly IranVerticalDynasty[]
): boolean {
  const dSpan = d.end_year - d.start_year;
  for (const c of all) {
    if (c.id === d.id) continue;
    if (c.start_year < d.start_year || c.end_year > d.end_year) continue;
    if (c.end_year - c.start_year < dSpan) return true;
  }
  return false;
}

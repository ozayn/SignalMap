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

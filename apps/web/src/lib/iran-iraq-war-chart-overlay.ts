/**
 * Iran–Iraq War contextual band for Iran economy macro charts (Gregorian keys).
 * Annual charts: shade calendar years 1980–1988 inclusive (WDI-style year buckets).
 */

export const IRAN_IRAQ_WAR_OVERLAY_ID = "iran_iraq_war";

/** Inclusive Gregorian years aligned with WDI annual keys on charts. */
export const IRAN_IRAQ_WAR_SHADE_START_YEAR = 1980;
export const IRAN_IRAQ_WAR_SHADE_END_YEAR = 1988;

/** Muted warm amber; distinct from neutral focus/regime gray. */
export const IRAN_IRAQ_WAR_MARK_AREA_FILL = "rgba(245, 158, 11, 0.10)";

export type ChartPeriodOverlayBandInput = {
  id: string;
  startYear: number;
  endYear: number;
  fill: string;
  /** Optional short ECharts markArea label (caller-localized). */
  markAreaLabel?: string;
};

/** Default war overlay on when the outer window’s earliest year is before 1988 (war years visible). */
export function ipcOuterWarOverlayDefaultOn(outerStartYear: number, outerEndYear: number): boolean {
  return Math.min(outerStartYear, outerEndYear) < 1988;
}

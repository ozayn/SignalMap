import type { SignalMapTimelineEvent } from "./types";

export function getEventImportance(e: SignalMapTimelineEvent): 1 | 2 | 3 {
  if (e.importance != null) return e.importance;
  return 2;
}

/**
 * `viewPortion` = (viewEnd - viewStart) / (domainEnd - domainStart), in (0, 1].
 * 1.0 = entire domain visible (most zoomed out). Small values = more zoomed in.
 */
export function minImportanceForViewPortion(viewPortion: number): 1 | 2 | 3 {
  const v = Math.min(1, Math.max(0.0001, viewPortion));
  if (v > 0.48) return 3; // most zoomed out: landmarks only
  if (v > 0.1) return 2; // medium: hide light context
  return 1; // well zoomed in: full detail
}

/**
 * Optional tiny narrative labels (separate from tooltips) only at strong zoom: small viewPortion.
 * (Hover always uses the tooltip; this threshold only gates persistent in-chart labels.)
 */
export const EVENT_LABEL_ZOOM_PORTION = 0.08;

export function shouldShowInlaneLabelsByZoom(viewPortion: number): boolean {
  return viewPortion < EVENT_LABEL_ZOOM_PORTION;
}

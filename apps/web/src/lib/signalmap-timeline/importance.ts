import type { SignalMapTimelineEvent } from "./types";

/** Default tiers for `SIGNALMAP_TIMELINE_SEED` when `importance` is omitted (overridable per-event in data). */
const ID_TIER: Record<string, 1 | 2 | 3> = {
  // Landmarks
  "g-ww1-start": 3,
  "g-1929-crash": 3,
  "g-ww2-eu": 3,
  "g-bretton-woods": 3,
  "g-ww2-end": 3,
  "g-cuban": 3,
  "g-nixon-gold": 3,
  "g-1973-embargo": 3,
  "g-9-11": 3,
  "g-2008-lehman": 3,
  "g-ukraine-22": 3,
  "g-soviet-end": 3,
  "g-2010-spill": 3,
  "g-isf-gulf-91": 3,
  "g-2003-iraq": 3,
  "g-covid-pheic": 3,
  "g-arab-spring": 3,
  "g-egypt-11": 3,
  "g-japan-311": 3,
  "g-2022-oil-swing": 3,
  "g-2014-crimea": 3,
  "g-2023-gaza-escalation": 3,
  "g-plaza": 3,
  "g-paris-15": 3,
  "ir-rev-79": 3,
  "ir-hostage": 3,
  "ir-iq-war-start": 3,
  "ir-jcpoa": 3,
  "ir-wlf": 3,
  "ir-soleimani": 3,
  // Context / footnotes
  "g-china-wto-join-note": 1,
  "g-2000-dot": 1,
  "g-wto-95": 1,
  "g-y2k": 1,
  "g-oil-negative": 1,
  "ir-nuc-natanz": 1,
  "ir-rial-stress-18": 1,
  "g-1990-reunif": 1,
  "g-1987-b": 1,
};

export function getEventImportance(e: SignalMapTimelineEvent): 1 | 2 | 3 {
  if (e.importance != null) return e.importance;
  return ID_TIER[e.id] ?? 2;
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

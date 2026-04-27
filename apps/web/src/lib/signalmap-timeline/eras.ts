/**
 * Broad historical “eras” for subtle underlay stripes (BBC-style: quiet context, not legend clutter).
 * Dates are YYYY-MM-DD in UTC; bands are purely visual; labels are for optional a11y only.
 */
export type SignalMapTimelineEra = {
  start: string;
  end: string;
  /** Opaque, not drawn at full size—used for `aria-label` / `title` if needed. */
  label: string;
};

export const TIMELINE_ERA_BANDS: readonly SignalMapTimelineEra[] = [
  { start: "1914-01-01", end: "1945-09-02", label: "First & Second World War period" },
  { start: "1945-09-03", end: "1991-12-31", label: "Post-war / Cold War" },
  { start: "1992-01-01", end: "2001-09-10", label: "Post–Cold War, pre–9/11" },
  { start: "2001-09-11", end: "2008-08-31", label: "Post-9/11" },
  { start: "2008-09-01", end: "2020-01-20", label: "Financial crisis & after" },
  { start: "2020-01-21", end: "2100-12-31", label: "Pandemic era & after" },
];

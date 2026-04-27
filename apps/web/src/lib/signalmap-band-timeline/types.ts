/**
 * Band / swimlane timeline: fixed horizontal time axis, one row per lane.
 * Periods render as rounded bands; points render as markers. Used for world-style history views.
 */

export type BandTimelineLane = "global" | "iran" | "oil" | "fx" | "war" | "policy";

type BandTimelineEventBase = {
  id: string;
  title_en: string;
  title_fa: string;
  /** Vertical swimlane (Y). */
  lane: BandTimelineLane;
  /**
   * Styling / future filters (e.g. same row as `lane` or cross-cutting theme).
   * Defaults to `lane` in seed data.
   */
  category: BandTimelineLane;
  /** 1 = light context, 2 = default, 3 = landmark. */
  importance: 1 | 2 | 3;
  description_en: string;
  description_fa: string;
};

export type BandTimelinePeriodEvent = BandTimelineEventBase & {
  kind: "period";
  start_date: string;
  end_date: string;
};

export type BandTimelinePointEvent = BandTimelineEventBase & {
  kind: "point";
  date: string;
};

export type BandTimelineEvent = BandTimelinePeriodEvent | BandTimelinePointEvent;

export const BAND_LANE_ORDER: readonly BandTimelineLane[] = [
  "global",
  "iran",
  "oil",
  "fx",
  "war",
  "policy",
] as const;

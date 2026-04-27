/**
 * Band / swimlane timeline: fixed horizontal time axis, one row per lane.
 * Periods render as rounded bands; points render as markers. Used for world-style history views.
 */

export type BandWarRegion = "global" | "europe" | "middle_east";

export type BandTimelineLane =
  | "global"
  | "iran"
  | "oil"
  | "fx"
  /** World-scale conflicts (e.g. WWI, WWII) — separate from regional war rows. */
  | "global_wars"
  | "europe_wars"
  | "middle_east_wars"
  | "policy"
  /** Political leadership: Iran presidents and related terms. */
  | "iran_leadership"
  /** Political leadership: U.S. chief executives. */
  | "us_leadership";

/** Thematic / styling / filter: use `leadership` for IRI and U.S. head-of-term bands. */
export type BandTimelineCategory = BandTimelineLane | "leadership";

type BandTimelineEventBase = {
  id: string;
  title_en: string;
  title_fa: string;
  /** Vertical swimlane (Y). */
  lane: BandTimelineLane;
  /**
   * Styling / filter key (e.g. `leadership` for presidential-term bands, `europe_wars` for row colors).
   */
  category: BandTimelineCategory;
  /**
   * Geographic bucketing for conflict rows (only used for `*_wars` lanes; matches lane choice).
   */
  region?: BandWarRegion;
  /** 1 = light context, 2 = default, 3 = landmark. */
  importance: 1 | 2 | 3;
  description_en: string;
  description_fa: string;
  /** Optional: search / filters (e.g. president, us, iran). */
  tags?: string[];
  /** Optional: human-readable citation in EN (e.g. Britannica, White House). */
  source_citation_en?: string;
  source_citation_fa?: string;
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
  "global_wars",
  "europe_wars",
  "middle_east_wars",
  "policy",
  "iran_leadership",
  "us_leadership",
] as const;

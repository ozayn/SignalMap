import type { ChartAxisYearMode } from "@/lib/chart-axis-year";

/**
 * Reusable world / domain event model for SignalMap interactive timelines.
 * Consumed by charts via onEventClick for zoom, highlights, and cross-filtering.
 */

export type SignalMapTimelineCategory = "global" | "iran" | "oil" | "fx" | "war" | "political";

export type SignalMapTimelineEvent = {
  id: string;
  date_start: string;
  date_end?: string | null;
  title_en: string;
  title_fa: string;
  description_en: string;
  description_fa: string;
  category: SignalMapTimelineCategory;
  tags: string[];
  /**
   * 1 = context / footnote, 2 = default, 3 = landmark. At wide zoom, only 3s show;
   * zooming in gradually reveals 2, then 1.
   */
  importance?: 1 | 2 | 3;
};

export type SignalMapTimelineLocale = "en" | "fa";

export type SignalMapTimelineProps = {
  events?: SignalMapTimelineEvent[];
  /**
   * Domain bounds. Defaults to min/max of event `date_start` (and `date_end` if present), expanded slightly.
   */
  timeRange?: [string, string];
  /** UI language. */
  locale?: SignalMapTimelineLocale;
  /**
   * When set (e.g. from `useIranStudyChartYearMode`), the top year strip uses
   * Gregorian, Solar Hijri, or both — matching chart axes.
   */
  xAxisYearLabel?: ChartAxisYearMode;
  /** Fired for single events (not cluster buckets). */
  onEventClick?: (event: SignalMapTimelineEvent) => void;
  className?: string;
  /**
   * Initial view as fraction of full range width (0–1] visible, e.g. 0.25 = show 25% of span (zoomed in).
   * Default 1 = full range. Ignored on first client paint if `?start=&end=` in the URL (browser only).
   */
  initialZoom?: number;
  /**
   * When true (default), the visible year range is reflected in the URL as `?start=YYYY&end=YYYY` (client only).
   */
  syncYearRangeToUrl?: boolean;
  /**
   * `default` = importance filtered by zoom (3 only when zoomed out, then 2, then 1).
   * `all` = show every importance level at the current zoom (use sparingly; can crowd the chart).
   */
  importanceDetail?: "default" | "all";
};

export type TimeViewport = { startMs: number; endMs: number };

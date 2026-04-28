/**
 * On-page study chart chrome (outside or beside ECharts canvas).
 * PNG export uses `chart-export-presentation` / slide compositing separately.
 */

/** Flex stack: toolbar → title → plot → source */
export const STUDY_CHART_STACK_GAP_CLASS = "gap-1 md:gap-1.5";

/** Centered series title above the plot (replaces in-canvas ECharts title for alignment). */
export const STUDY_CHART_TITLE_WRAP_CLASS =
  "px-1 text-center text-[15px] font-semibold leading-snug tracking-tight text-foreground/90 sm:text-[16px]";

/** Source line under the plot; constrained to chart width */
export const STUDY_CHART_SOURCE_WRAP_CLASS =
  "max-w-full px-1 text-start text-[11px] leading-snug text-muted-foreground sm:text-xs";

/** Legend entry text (px); scroll and plain use the same hierarchy */
export const STUDY_CHART_LEGEND_FONT_PX = 13;

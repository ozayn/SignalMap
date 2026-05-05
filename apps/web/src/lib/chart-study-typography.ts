/**
 * On-page study chart chrome (outside or beside ECharts canvas).
 * PNG export uses `chart-export-presentation` / slide compositing separately.
 */

/** Flex stack: toolbar → title → plot → source */
export const STUDY_CHART_STACK_GAP_CLASS = "gap-1.5 md:gap-2";

/** Centered series title above the plot (replaces in-canvas ECharts title for alignment). */
export const STUDY_CHART_TITLE_WRAP_CLASS =
  "px-1 text-center text-[15px] font-semibold leading-snug tracking-tight text-foreground/90 sm:text-[16px] break-words";

/** Source line under the plot; constrained to chart width */
export const STUDY_CHART_SOURCE_WRAP_CLASS =
  "mt-2.5 max-w-full px-1 text-start text-[11px] leading-snug text-muted-foreground sm:text-xs break-words";

/** Legend entry text (px); scroll and plain use the same hierarchy */
export const STUDY_CHART_LEGEND_FONT_PX = 13;

/** Mobile / `max-md` height segment (portrait vs landscape); pair with a `md:*` tail. */
export const TIMELINE_CHART_MOBILE_HEIGHT_PREFIX =
  "h-[min(52dvh,320px)] max-md:landscape:h-[min(38dvh,260px)]";

/**
 * Default `TimelineChart` canvas height: more vertical space in portrait, slightly shorter in
 * `max-md` landscape to limit empty margin when the address bar / aspect ratio changes.
 */
export const TIMELINE_CHART_DEFAULT_HEIGHT_CLASS = `${TIMELINE_CHART_MOBILE_HEIGHT_PREFIX} md:h-96`;

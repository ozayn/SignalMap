/**
 * Shared line-series marker sizing for TimelineChart and study-level ECharts options.
 * Symbols stay visible for shape discrimination but stay smaller than line stroke emphasis.
 */

/** Default multi-series / primary line markers (~diameter in px). */
export const CHART_LINE_SYMBOL_SIZE = 5;

/** Oil, gold, production keys, dual-axis overlays, publication oil primary. */
export const CHART_LINE_SYMBOL_SIZE_COMPACT = 4;

/** Secondary single-line series or minimal overlay when space is tight. */
export const CHART_LINE_SYMBOL_SIZE_MINI = 3;

/** Symbol fill only; keep `lineStyle` at full opacity so lines read clearly. */
export const CHART_LINE_SYMBOL_ITEM_OPACITY = 0.82;

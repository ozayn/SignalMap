/**
 * Shared line-series marker sizing for TimelineChart and study-level ECharts options.
 * Symbols stay subtle shape cues; lines stay visually dominant (small size + low fill opacity).
 */

/** Default multi-series / primary line markers (ECharts symbolSize, px). */
export const CHART_LINE_SYMBOL_SIZE = 3;

/** Oil, gold, production keys, dual-axis overlays, publication oil primary. */
export const CHART_LINE_SYMBOL_SIZE_COMPACT = 2;

/** Secondary single-line series or minimal overlay when space is tight. */
export const CHART_LINE_SYMBOL_SIZE_MINI = 2;

/** Symbol fill only; keep `lineStyle` at full opacity so lines read clearly. */
export const CHART_LINE_SYMBOL_ITEM_OPACITY = 0.45;

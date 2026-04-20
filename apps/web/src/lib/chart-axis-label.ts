/**
 * Typography and spacing for ECharts y-axis **names** (titles), distinct from tick labels.
 * Used for on-screen charts and PNG export (same `setOption` path).
 */
/** Slightly larger than tick labels for hierarchy on screen and PNG export. */
export const CHART_Y_AXIS_NAME_FONT_SIZE = 16;
export const CHART_Y_AXIS_TICK_FONT_SIZE = 13;
/**
 * Distance from axis line to the axis name (ECharts `nameGap`).
 * Slightly generous so y-axis titles clear tick labels and the plot when using `nameLocation: "middle"`.
 */
export const CHART_Y_AXIS_NAME_GAP = 44;
/** Extra space between tick numerals and the axis line / neighbor content (`axisLabel.margin`). */
export const CHART_Y_AXIS_LABEL_MARGIN = 16;

export const chartYAxisNameTextStyle = (color: string) =>
  ({
    color,
    fontSize: CHART_Y_AXIS_NAME_FONT_SIZE,
    fontWeight: 500 as const,
    align: "center" as const,
    lineHeight: 22,
    /** Keeps rotated titles from sitting flush against the chart edge. */
    padding: [4, 6, 4, 6] as [number, number, number, number],
  }) satisfies {
    color: string;
    fontSize: number;
    fontWeight: 500;
    align: "center";
    lineHeight: number;
    padding: [number, number, number, number];
  };

/**
 * Splits titles like `Series (unit)` or `GDP (constant 2015 US$)` across two lines after the measure name.
 * Keeps short titles on one line.
 */
export function formatYAxisNameMultiline(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const idx = t.indexOf(" (");
  if (idx <= 0) return t;
  const lead = t.slice(0, idx).trimEnd();
  const tail = t.slice(idx).trim();
  if (!lead || !tail) return t;
  if (t.length < 26) return t;
  return `${lead}\n${tail}`;
}

/**
 * Single source of truth for WDI cross-country comparator series (`ChartSeries.key`).
 * Colors and marker shapes align TimelineChart lines, emphasis, and legend icons.
 *
 * Each country has a distinct (color, symbol) pair so multi-series charts stay readable
 * when printed or color is ambiguous. Keys match API `series` object names except USA → `us` on charts.
 */
export type ComparatorLineSymbol = "circle" | "rect" | "diamond" | "triangle" | "roundRect" | "arrow";

export type CountryComparatorSeriesKey =
  | "iran"
  | "us"
  | "germany"
  | "turkey"
  | "china"
  | "saudi_arabia";

export type CountryComparatorStyle = {
  color: string;
  /** ECharts built-in symbol for line series + legend (custom path used in legend for `arrow`). */
  symbol: ComparatorLineSymbol;
  legendIcon: ComparatorLineSymbol;
};

export const COUNTRY_COMPARATOR_STYLES: Record<CountryComparatorSeriesKey, CountryComparatorStyle> = {
  iran: { color: "#f59e0b", symbol: "circle", legendIcon: "circle" },
  us: { color: "#2563eb", symbol: "triangle", legendIcon: "triangle" },
  germany: { color: "#6b7280", symbol: "rect", legendIcon: "rect" },
  turkey: { color: "#10b981", symbol: "diamond", legendIcon: "diamond" },
  china: { color: "#dc2626", symbol: "roundRect", legendIcon: "roundRect" },
  saudi_arabia: { color: "#9333ea", symbol: "arrow", legendIcon: "arrow" },
};

export function countryComparatorSeriesStyle(seriesKey: string): CountryComparatorStyle | undefined {
  return COUNTRY_COMPARATOR_STYLES[seriesKey as CountryComparatorSeriesKey];
}

/** @deprecated Use `countryComparatorSeriesStyle(key)?.color` — kept for call sites that only need color. */
export function countryComparatorSeriesColor(seriesKey: string): string | undefined {
  return countryComparatorSeriesStyle(seriesKey)?.color;
}

/** Re-export color map for bundle consumers (e.g. oil production US/IRN alignment). */
export const COUNTRY_COMPARATOR_SERIES_COLORS: Record<CountryComparatorSeriesKey, string> = {
  iran: COUNTRY_COMPARATOR_STYLES.iran.color,
  us: COUNTRY_COMPARATOR_STYLES.us.color,
  germany: COUNTRY_COMPARATOR_STYLES.germany.color,
  turkey: COUNTRY_COMPARATOR_STYLES.turkey.color,
  china: COUNTRY_COMPARATOR_STYLES.china.color,
  saudi_arabia: COUNTRY_COMPARATOR_STYLES.saudi_arabia.color,
};

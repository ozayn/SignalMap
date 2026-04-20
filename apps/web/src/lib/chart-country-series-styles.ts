/**
 * Single source of truth for WDI cross-country comparator series (`ChartSeries.key`).
 * Colors and marker shapes align TimelineChart lines, emphasis, and legend icons.
 *
 * Iran and the United States both use circle markers per product spec; they remain
 * visually distinct via color. Germany and Turkey use different shapes.
 */
export type CountryComparatorSeriesKey = "iran" | "us" | "germany" | "turkey";

export type CountryComparatorStyle = {
  color: string;
  /** ECharts built-in symbol for line series + legend. */
  symbol: "circle" | "rect" | "diamond" | "triangle" | "roundRect";
  /** Same as `symbol` for `legend.data[].icon` where applicable. */
  legendIcon: "circle" | "rect" | "diamond" | "triangle" | "roundRect";
};

export const COUNTRY_COMPARATOR_STYLES: Record<CountryComparatorSeriesKey, CountryComparatorStyle> = {
  iran: { color: "#f59e0b", symbol: "circle", legendIcon: "circle" },
  us: { color: "#2563eb", symbol: "circle", legendIcon: "circle" },
  germany: { color: "#6b7280", symbol: "rect", legendIcon: "rect" },
  turkey: { color: "#10b981", symbol: "diamond", legendIcon: "diamond" },
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
};

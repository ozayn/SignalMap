/**
 * Single source of truth for WDI cross-country comparator series (`ChartSeries.key`).
 * Colors and marker shapes align TimelineChart lines, emphasis, and legend icons.
 *
 * Each country has a distinct (color, symbol) pair so multi-series charts stay readable
 * when printed or color is ambiguous. Keys match API `series` object names except USA → `us` on charts.
 */
import { SIGNAL_COUNTRY } from "@/lib/signalmap-chart-colors";

export type ComparatorLineSymbol = "circle" | "rect" | "diamond" | "triangle" | "roundRect" | "arrow";

export type CountryComparatorSeriesKey =
  | "iran"
  | "us"
  | "germany"
  | "turkey"
  | "china"
  | "saudi_arabia"
  | "brazil"
  | "argentina"
  | "india";

export type CountryComparatorStyle = {
  color: string;
  /** ECharts built-in symbol for line series + legend (custom path used in legend for `arrow`). */
  symbol: ComparatorLineSymbol;
  legendIcon: ComparatorLineSymbol;
};

export const COUNTRY_COMPARATOR_STYLES: Record<CountryComparatorSeriesKey, CountryComparatorStyle> = {
  iran: { color: SIGNAL_COUNTRY.iran, symbol: "circle", legendIcon: "circle" },
  us: { color: SIGNAL_COUNTRY.us, symbol: "triangle", legendIcon: "triangle" },
  germany: { color: SIGNAL_COUNTRY.germany, symbol: "rect", legendIcon: "rect" },
  turkey: { color: SIGNAL_COUNTRY.turkey, symbol: "diamond", legendIcon: "diamond" },
  china: { color: SIGNAL_COUNTRY.china, symbol: "roundRect", legendIcon: "roundRect" },
  saudi_arabia: { color: SIGNAL_COUNTRY.saudi_arabia, symbol: "arrow", legendIcon: "arrow" },
  brazil: { color: SIGNAL_COUNTRY.brazil, symbol: "circle", legendIcon: "circle" },
  argentina: { color: SIGNAL_COUNTRY.argentina, symbol: "rect", legendIcon: "rect" },
  india: { color: SIGNAL_COUNTRY.india, symbol: "roundRect", legendIcon: "roundRect" },
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
  brazil: COUNTRY_COMPARATOR_STYLES.brazil.color,
  argentina: COUNTRY_COMPARATOR_STYLES.argentina.color,
  india: COUNTRY_COMPARATOR_STYLES.india.color,
};

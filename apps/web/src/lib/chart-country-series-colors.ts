/**
 * Canonical line colors for cross-country comparator series (`ChartSeries.key`).
 * Used by TimelineChart for line, symbol, legend, and tooltip emphasis so studies stay aligned.
 */
export const COUNTRY_COMPARATOR_SERIES_COLORS = {
  iran: "#f59e0b",
  us: "#2563eb",
  germany: "#6b7280",
  turkey: "#10b981",
} as const;

export type CountryComparatorSeriesKey = keyof typeof COUNTRY_COMPARATOR_SERIES_COLORS;

export function countryComparatorSeriesColor(seriesKey: string): string | undefined {
  return COUNTRY_COMPARATOR_SERIES_COLORS[seriesKey as CountryComparatorSeriesKey];
}

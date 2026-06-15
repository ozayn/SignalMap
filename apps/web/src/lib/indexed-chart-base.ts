/**
 * Shared index-base-year resolution and chart copy for multi-series indexed views.
 * Every series on one chart must use the same calendar base year (= 100).
 */

import {
  indexSeriesTo100,
  resolveCommonIndexBaseYear,
  type DutchOverviewSeriesInput,
} from "@/lib/dutch-disease-overview-index";
import type { GdpLevelPoint } from "@/lib/gdp-levels-indexed";
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";

export { indexSeriesTo100, resolveCommonIndexBaseYear, type DutchOverviewSeriesInput };

export const DEFAULT_INDEX_PREFERRED_YEAR = 2000;

export type SharedIndexedSeriesResult = {
  baseYear: number;
  /** Series keyed by input ``key``; omits lines with no finite indexed values at the shared base year. */
  byKey: Record<string, GdpLevelPoint[]>;
};

/**
 * Index every non-empty series to 100 in one shared calendar year.
 * Prefers ``preferredYear`` when all series have valid values that year; otherwise earliest common year.
 */
export function indexMultiSeriesTo100SharedBase(
  series: ReadonlyArray<DutchOverviewSeriesInput>,
  preferredYear = DEFAULT_INDEX_PREFERRED_YEAR
): SharedIndexedSeriesResult | null {
  const nonEmpty = series.filter((s) => s.points.length > 0);
  if (nonEmpty.length === 0) return null;
  const baseYear = resolveCommonIndexBaseYear(nonEmpty, preferredYear);
  if (baseYear == null) return null;

  const byKey: Record<string, GdpLevelPoint[]> = {};
  for (const s of nonEmpty) {
    const idx = indexSeriesTo100(s.points, baseYear);
    if (!idx.some((p) => Number.isFinite(p.value))) continue;
    byKey[s.key] = idx;
  }
  if (Object.keys(byKey).length === 0) return null;
  return { baseYear, byKey };
}

export function isPreferredIndexBaseYear(
  baseYear: number,
  preferredYear = DEFAULT_INDEX_PREFERRED_YEAR
): boolean {
  return baseYear === preferredYear;
}

/** Y-axis / legend unit, e.g. "Index (2000 = 100)". */
export function formatIndexEquals100Label(baseYear: number, locale: "en" | "fa" = "en"): string {
  if (locale === "fa") {
    return `شاخص (${localizeChartNumericDisplayString(String(baseYear), "fa")} = ۱۰۰)`;
  }
  return `Index (${baseYear} = 100)`;
}

/** Toggle / chart title phrase, e.g. "Indexed (2000 = 100)". */
export function formatIndexedToEquals100Phrase(baseYear: number, locale: "en" | "fa" = "en"): string {
  if (locale === "fa") {
    return `شاخص‌شده (${localizeChartNumericDisplayString(String(baseYear), "fa")} = ۱۰۰)`;
  }
  return `Indexed (${baseYear} = 100)`;
}

/** Footer note when the shared base year is not the preferred default (2000). */
export function formatSharedIndexBaseNote(
  baseYear: number,
  preferredYear = DEFAULT_INDEX_PREFERRED_YEAR,
  locale: "en" | "fa" = "en"
): string | null {
  if (baseYear === preferredYear) return null;
  if (locale === "fa") {
    return `شاخص ${localizeChartNumericDisplayString(String(baseYear), "fa")} = ۱۰۰؛ اولین سالی که برای همهٔ سری‌های نمایش‌داده‌شده دادهٔ معتبر دارد.`;
  }
  return `Indexed to ${baseYear} = 100, the first year available for all displayed series.`;
}

/** Short subtitle, e.g. "Indexed to 2000 = 100". */
export function formatIndexedToEquals100Subtitle(baseYear: number, locale: "en" | "fa" = "en"): string {
  if (locale === "fa") {
    return `شاخص ${localizeChartNumericDisplayString(String(baseYear), "fa")} = ۱۰۰`;
  }
  return `Indexed to ${baseYear} = 100`;
}

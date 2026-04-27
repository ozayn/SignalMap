import type { ChartAxisYearMode, ChartAxisNumeralLocale } from "@/lib/chart-axis-year";
import { formatChartCategoryAxisYearLabel, getChartAxisYearDisplayParts } from "@/lib/chart-axis-year";
import { localizeChartNumericDisplayString } from "@/lib/chart-numerals-fa";
import type { StudyLocale } from "@/lib/iran-study-fa";

/**
 * One calendar year; BCE = negative. Single-language string for labels.
 */
export function formatYearADBC(year: number, lang: StudyLocale): string {
  if (lang === "en") {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
  }
  if (year < 0) return `${Math.abs(year)} پ.م.`;
  return `${year} م.`;
}

/**
 * Proleptic integer year to display string, aligned with chart `ChartAxisYearMode` (FA UI only;
 * English always uses {@link formatYearADBC}).
 * BCE (year < 1): only Gregorian-style BCE/CE is shown; Solar Hijri is not applied.
 * CE: optional Jalali or both via `formatChartCategoryAxisYearLabel` on YYYY-01-01.
 */
export function formatDynastyProlepticYear(
  year: number,
  lang: StudyLocale,
  yearMode: ChartAxisYearMode
): string {
  if (lang === "en") {
    return formatYearADBC(year, "en");
  }
  const numeral: ChartAxisNumeralLocale = "fa";
  if (year < 1) {
    return formatYearADBC(year, "fa");
  }
  const iso = `${String(year).padStart(4, "0")}-01-01`;
  if (yearMode === "gregorian") {
    return formatYearADBC(year, "fa");
  }
  if (yearMode === "jalali") {
    return formatChartCategoryAxisYearLabel(iso, "jalali", numeral);
  }
  return formatChartCategoryAxisYearLabel(iso, "both", numeral);
}

/**
 * In-view range (clipped to tMin..tMax), same display rules as {@link formatDynastyProlepticYear}.
 */
export function formatDynastyProlepticRange(
  startYear: number,
  endYear: number,
  tMin: number,
  tMax: number,
  lang: StudyLocale,
  yearMode: ChartAxisYearMode
): string {
  const a = Math.max(startYear, tMin);
  const b = Math.min(endYear, tMax);
  if (a > b) return "—";
  if (a === b) {
    return formatDynastyProlepticYear(a, lang, yearMode);
  }
  if (lang === "en") {
    return `${formatYearADBC(a, "en")} – ${formatYearADBC(b, "en")}`;
  }
  if (a < 1 || b < 1 || yearMode === "gregorian" || yearMode === "jalali") {
    return `${formatDynastyProlepticYear(a, lang, yearMode)} – ${formatDynastyProlepticYear(b, lang, yearMode)}`;
  }
  const isoA = `${String(a).padStart(4, "0")}-01-01`;
  const isoB = `${String(b).padStart(4, "0")}-01-01`;
  const pa = getChartAxisYearDisplayParts(isoA);
  const pb = getChartAxisYearDisplayParts(isoB);
  const gLine = `${pa.gregorian} – ${pb.gregorian}`;
  if (pa.jalali && pb.jalali) {
    const jLine = `${pa.jalali} – ${pb.jalali}`;
    const raw = `${gLine}\n${jLine}`;
    return localizeChartNumericDisplayString(raw, "fa");
  }
  return localizeChartNumericDisplayString(gLine, "fa");
}

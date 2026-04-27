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

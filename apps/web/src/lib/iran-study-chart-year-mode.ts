import { supportsIranStudyFa } from "@/lib/iran-study-fa";

/**
 * Iran-focused study pages that use `supportsIranStudyFa` also use a shared
 * Gregorian / Jalali / Both year-axis mode for `TimelineChart` (`xAxisYearLabel`).
 *
 * Keep this aligned with `IRAN_FA_STUDY_IDS`: adding a study there automatically
 * enables the year toggle in the study header (see `useIranStudyChartYearMode`).
 */
export function supportsIranStudyChartYearAxis(studyId: string): boolean {
  return supportsIranStudyFa(studyId);
}

import { supportsIranStudyFa } from "@/lib/iran-study-fa";

/**
 * Iran-focused study pages that use `supportsIranStudyFa` also use a shared
 * Gregorian / Iranian (SH) / Both year-axis mode for `TimelineChart` (`xAxisYearLabel`).
 * Default axis is Gregorian; SH appears only when the user picks it (or Both). Persisted via
 * `useIranStudyChartYearMode` + `localStorage` key `signalmap:chart-year-axis-mode`.
 *
 * Keep this aligned with `IRAN_FA_STUDY_IDS`: adding a study there automatically
 * enables the year toggle in the study header.
 */
export function supportsIranStudyChartYearAxis(studyId: string): boolean {
  return supportsIranStudyFa(studyId);
}

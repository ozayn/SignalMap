import type { StudyMeta } from "@/lib/studies";
import { IRAN_STUDY_FA_DISPLAY } from "@/lib/iran-study-fa-copy";

/**
 * Iran-focused studies that expose EN/FA on the study detail page (not full-site i18n).
 * Also drives the shared Gregorian / Jalali / Both year-axis control and `xAxisYearLabel` wiring on those pages.
 */
export const IRAN_FA_STUDY_IDS = new Set<string>([
  "iran",
  "usd-toman",
  "oil-and-fx",
  "iran_oil_ppp",
  "iran_oil_ppp_turkey",
  "iran_oil_export_capacity",
  "iran_fx_spread",
  "iran_real_wage_cpi",
  "iran-gdp-composition",
  "iran-gdp-accounts-dual",
  "gini-inequality",
  "inflation-rate",
  "poverty-rate",
  "dutch-disease-diagnostics",
]);

export type StudyLocale = "en" | "fa";

export function supportsIranStudyFa(studyId: string): boolean {
  return IRAN_FA_STUDY_IDS.has(studyId);
}

export function L(isFa: boolean, en: string, fa: string): string {
  return isFa ? fa : en;
}

/** User-visible study fields (title, description, observations, …) without touching data-fetch keys. */
export function mergeIranStudyDisplay(study: StudyMeta, studyId: string, isFa: boolean): StudyMeta {
  if (!isFa) return study;
  const o = IRAN_STUDY_FA_DISPLAY[studyId];
  if (!o) return study;
  return {
    ...study,
    title: o.title ?? study.title,
    subtitle: o.subtitle ?? study.subtitle,
    description: o.description ?? study.description,
    observations: o.observations ?? study.observations,
    unitLabel: o.unitLabel ?? study.unitLabel,
  };
}

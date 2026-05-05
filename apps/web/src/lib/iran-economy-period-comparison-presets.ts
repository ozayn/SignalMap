/** Default Gregorian year range (Islamic Republic start → current year). */
export const IPC_DEFAULT_OUTER_START = 1979;

/**
 * Gregorian year used as the `useSyncExternalStore` server snapshot (SSR + first client paint).
 * Bump when the calendar rolls forward so year clamps / defaults stay aligned with `ipcCurrentGregorianYear()`.
 */
export const IPC_SSR_GREGORIAN_YEAR_SNAPSHOT = 2026;

export function ipcCurrentGregorianYear(): number {
  return new Date().getFullYear();
}

export type IpcPresidentPreset =
  | "islamic_republic_outer"
  | "rafsanjani"
  | "khatami"
  | "ahmadinejad"
  | "rouhani"
  | "raisi"
  | "pezeshkian";

export type IpcPresidentPresetConfig = {
  /** Only widens the chart window (1979–present); does not change the focus band. */
  outerOnly?: boolean;
  outerStart?: number;
  outerEnd?: number;
  outerUseCurrentEnd?: boolean;
  focusStart?: number;
  focusEnd?: number;
  focusUseCurrentEnd?: boolean;
  /** Short label for shaded band on charts (markArea). */
  labelEn: string;
  labelFa: string;
  /** Optional longer note for study prose only (not shown on the chart band). */
  bandContextEn?: string;
  bandContextFa?: string;
};

export const IPC_PRESIDENT_PRESETS: Record<IpcPresidentPreset, IpcPresidentPresetConfig> = {
  islamic_republic_outer: {
    outerOnly: true,
    outerStart: IPC_DEFAULT_OUTER_START,
    outerUseCurrentEnd: true,
    labelEn: "Chart window: 1979–present",
    labelFa: "پنجره نمودار: ۱۹۷۹ تا اکنون",
  },
  rafsanjani: {
    focusStart: 1989,
    focusEnd: 1997,
    labelEn: "Rafsanjani",
    labelFa: "رفسنجانی",
    bandContextEn: "Shaded band: Rafsanjani presidencies (1989–1997 CE).",
    bandContextFa: "نوار سایه‌دار: دوره‌های ریاست‌جمهوری رفسنجانی (۱۹۸۹–۱۹۹۷ میلادی).",
  },
  khatami: {
    focusStart: 1997,
    focusEnd: 2005,
    labelEn: "Khatami presidency",
    labelFa: "ریاست‌جمهوری خاتمی",
  },
  ahmadinejad: {
    focusStart: 2005,
    focusEnd: 2013,
    labelEn: "Ahmadinejad presidency",
    labelFa: "ریاست‌جمهوری احمدی‌نژاد",
  },
  rouhani: {
    focusStart: 2013,
    focusEnd: 2021,
    labelEn: "Rouhani presidency",
    labelFa: "ریاست‌جمهوری روحانی",
  },
  raisi: {
    focusStart: 2021,
    focusEnd: 2024,
    labelEn: "Raisi presidency",
    labelFa: "ریاست‌جمهوری رئیسی",
  },
  pezeshkian: {
    focusStart: 2024,
    focusUseCurrentEnd: true,
    labelEn: "Pezeshkian presidency (to date)",
    labelFa: "ریاست‌جمهوری پزشکیان (تا کنون)",
  },
};

/** Button row order on the period-comparison study page. */
export const IPC_PRESET_UI_ORDER: IpcPresidentPreset[] = [
  "islamic_republic_outer",
  "rafsanjani",
  "khatami",
  "ahmadinejad",
  "rouhani",
  "raisi",
  "pezeshkian",
];

/** Short chip labels for preset buttons (EN / FA). */
export const IPC_PRESET_CHIP: Record<IpcPresidentPreset, { en: string; fa: string }> = {
  islamic_republic_outer: { en: "IR 1979–", fa: "ج.ا. ۱۹۷۹–" },
  rafsanjani: { en: "Rafsanjani", fa: "رفسنجانی" },
  khatami: { en: "Khatami", fa: "خاتمی" },
  ahmadinejad: { en: "Ahmadinejad", fa: "احمدی‌نژاد" },
  rouhani: { en: "Rouhani", fa: "روحانی" },
  raisi: { en: "Raisi", fa: "رئیسی" },
  pezeshkian: { en: "Pezeshkian", fa: "پزشکیان" },
};

/** Default outer window start when opening the Iran period-comparison study (Gregorian). */
export const IPC_PERIOD_COMPARISON_DEFAULT_OUTER_START = 1960;

/** Floor for outer/focus year inputs and resolved outer window (Pahlavi focus from 1941). */
export const IPC_OUTER_CHART_YEAR_MIN = 1900;

/** Islamic Republic “outer only” preset: chart window from state-formation year. */
export const IPC_ISLAMIC_REPUBLIC_OUTER_START = 1979;

/**
 * @deprecated Use `IPC_PERIOD_COMPARISON_DEFAULT_OUTER_START` for new code.
 * Kept as an alias so older imports still resolve to the study default outer start.
 */
export const IPC_DEFAULT_OUTER_START = IPC_PERIOD_COMPARISON_DEFAULT_OUTER_START;

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
  | "mohammad_reza_pahlavi"
  | "rafsanjani"
  | "khatami"
  | "ahmadinejad"
  | "rouhani"
  | "raisi"
  | "pezeshkian";

export type IpcPresidentPresetConfig = {
  /** Only widens the chart window; does not change the focus band. */
  outerOnly?: boolean;
  outerStart?: number;
  outerEnd?: number;
  outerUseCurrentEnd?: boolean;
  focusStart?: number;
  focusEnd?: number;
  focusUseCurrentEnd?: boolean;
  /** When applying this preset, set outer start to at most this year so the focus band is visible. */
  widenOuterStartToYear?: number;
  /** Short label for shaded band on charts (markArea). */
  labelEn: string;
  labelFa: string;
};

export const IPC_PRESIDENT_PRESETS: Record<IpcPresidentPreset, IpcPresidentPresetConfig> = {
  islamic_republic_outer: {
    outerOnly: true,
    outerStart: IPC_ISLAMIC_REPUBLIC_OUTER_START,
    outerUseCurrentEnd: true,
    labelEn: "Chart window: 1979–present",
    labelFa: "پنجره نمودار: ۱۹۷۹ تا اکنون",
  },
  mohammad_reza_pahlavi: {
    focusStart: 1941,
    focusEnd: 1979,
    widenOuterStartToYear: 1941,
    labelEn: "Pahlavi",
    labelFa: "پهلوی",
  },
  rafsanjani: {
    focusStart: 1989,
    focusEnd: 1997,
    labelEn: "Rafsanjani",
    labelFa: "رفسنجانی",
  },
  khatami: {
    focusStart: 1997,
    focusEnd: 2005,
    labelEn: "Khatami",
    labelFa: "خاتمی",
  },
  ahmadinejad: {
    focusStart: 2005,
    focusEnd: 2013,
    labelEn: "Ahmadinejad",
    labelFa: "احمدی‌نژاد",
  },
  rouhani: {
    focusStart: 2013,
    focusEnd: 2021,
    labelEn: "Rouhani",
    labelFa: "روحانی",
  },
  raisi: {
    focusStart: 2021,
    focusEnd: 2024,
    labelEn: "Raisi",
    labelFa: "رئیسی",
  },
  pezeshkian: {
    focusStart: 2024,
    focusUseCurrentEnd: true,
    labelEn: "Pezeshkian",
    labelFa: "پزشکیان",
  },
};

/** Button row order on the period-comparison study page. */
export const IPC_PRESET_UI_ORDER: IpcPresidentPreset[] = [
  "islamic_republic_outer",
  "mohammad_reza_pahlavi",
  "rafsanjani",
  "khatami",
  "ahmadinejad",
  "rouhani",
  "raisi",
  "pezeshkian",
];

/** Short chip labels for preset buttons (EN / FA). */
export const IPC_PRESET_CHIP: Record<IpcPresidentPreset, { en: string; fa: string }> = {
  islamic_republic_outer: { en: "IR period (1979–)", fa: "دوره جمهوری اسلامی (۱۹۷۹–)" },
  mohammad_reza_pahlavi: { en: "Pahlavi", fa: "پهلوی" },
  rafsanjani: { en: "Rafsanjani", fa: "رفسنجانی" },
  khatami: { en: "Khatami", fa: "خاتمی" },
  ahmadinejad: { en: "Ahmadinejad", fa: "احمدی‌نژاد" },
  rouhani: { en: "Rouhani", fa: "روحانی" },
  raisi: { en: "Raisi", fa: "رئیسی" },
  pezeshkian: { en: "Pezeshkian", fa: "پزشکیان" },
};

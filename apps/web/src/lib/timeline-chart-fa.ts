/** Tooltip / chrome strings inside ECharts (FA); series names come from props. */
export type TimelineChartFaUi = {
  sanctionsPeriod: string;
  scopeOilExports: string;
  political: string;
  warSecurity: string;
  sanctions: string;
  macroContext: string;
  presidentialTerm: string;
  scopeSanctions: string;
  scopeWorld: string;
  scopeIran: string;
  confidence: string;
  source: string;
  sourceN: (i: number) => string;
  sourcesPrefix: string;
  estimatedExtension: (latestOfficial: string) => string;
  indexed: string;
};

const EN: TimelineChartFaUi = {
  sanctionsPeriod: "Sanctions period",
  scopeOilExports: "oil exports",
  political: "Political",
  warSecurity: "War / security",
  sanctions: "Sanctions",
  macroContext: "Macro context",
  presidentialTerm: "Presidential term",
  scopeSanctions: "Sanctions",
  scopeWorld: "World event",
  scopeIran: "Iran event",
  confidence: "Confidence",
  source: "Source",
  sourceN: (i: number) => `Source ${i + 1}`,
  sourcesPrefix: "Sources",
  estimatedExtension: (latestOfficial: string) =>
    `Estimated extension (latest official data: ${latestOfficial})`,
  indexed: "indexed",
};

const FA: TimelineChartFaUi = {
  sanctionsPeriod: "دورهٔ تحریم",
  scopeOilExports: "صادرات نفت",
  political: "سیاسی",
  warSecurity: "جنگ / امنیت",
  sanctions: "تحریم",
  macroContext: "زمینهٔ کلان",
  presidentialTerm: "دورهٔ ریاست‌جمهوری",
  scopeSanctions: "رویداد تحریمی",
  scopeWorld: "رویداد جهانی",
  scopeIran: "رویداد ایران",
  confidence: "اطمینان",
  source: "منبع",
  sourceN: (i: number) => (i === 0 ? "منبع" : `منبع ${i + 1}`),
  sourcesPrefix: "منابع",
  estimatedExtension: (latestOfficial: string) =>
    `تخمین تمدید (آخرین دادهٔ رسمی: ${latestOfficial})`,
  indexed: "شاخص‌شده",
};

export function timelineChartFaUi(locale: "en" | "fa" | undefined): TimelineChartFaUi {
  return locale === "fa" ? FA : EN;
}

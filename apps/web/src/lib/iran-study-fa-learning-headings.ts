import type { LearningNoteSection } from "@/components/learning-note";

/** Translate common LearningNote section headings (bullets stay EN unless replaced later). */
const HEADING_FA: Record<string, string> = {
  "How to read this chart": "راهنمای خواندن این نمودار",
  "How to read this study": "راهنمای خواندن این مطالعه",
  "Visual elements": "عناصر بصری",
  "What this measures": "چه چیزی اندازه گرفته می‌شود",
  "Raw data": "دادهٔ خام",
  "Measurement choices & limitations": "انتخاب‌های اندازه‌گیری و محدودیت‌ها",
  Pitfalls: "اشتباهات رایج",
  "Why the FX spread matters": "چرا شکاف نرخ ارز مهم است",
  "What this study does not claim": "این مطالعه چه ادعایی نمی‌کند",
  "What this shows": "این نمودار چه نشان می‌دهد",
  "How to read": "راهنمای خواندن",
  "Measurement notes": "یادداشت‌های اندازه‌گیری",
  "Important note": "نکتهٔ مهم",
  Volatility: "نوسان",
  Purpose: "هدف",
  Limitations: "محدودیت‌ها",
  Methodology: "روش‌شناسی",
  "Methodological symmetry": "تقارن روش‌شناختی",
  "Reading guidance": "راهنمای خواندن",
  "Why volume matters": "چرا حجم مهم است",
  "Why indexing is used": "چرا از شاخص‌سازی استفاده شده",
  "What the proxy represents": "نمایندهٔ شاخص چیست",
  "Why real wages matter": "چرا دستمزد واقعی مهم است",
  "What this means": "معنای این نمودار",
};

export function faLearningMainTitle(isFa: boolean): string {
  return isFa ? "راهنمای خواندن این نمودار" : "How to read this chart";
}

export function learningNoteTitle(isFa: boolean, title: string): string {
  if (!isFa) return title;
  return HEADING_FA[title] ?? title;
}

export function localizeLearningSections(isFa: boolean, sections: LearningNoteSection[]): LearningNoteSection[] {
  if (!isFa) return sections;
  return sections.map((s) => ({
    ...s,
    heading: HEADING_FA[s.heading] ?? s.heading,
  }));
}

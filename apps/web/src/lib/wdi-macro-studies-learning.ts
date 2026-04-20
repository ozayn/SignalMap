import type { LearningNoteSection } from "@/components/learning-note";

const GINI_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "The Gini coefficient measures income inequality. Higher values mean more inequality in the distribution of income.",
      "This chart uses World Bank World Development Indicators (SI.POV.GINI), typically from household surveys; years without estimates appear as gaps.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "Vertical axis: Gini coefficient on a 0–100 scale (World Bank convention). 0 = perfect equality (everyone has the same income); 100 = maximum inequality (one person has all income).",
      "Tooltips show the numeric value (e.g. 41) for the point you hover.",
      "Lines connect available survey years; they are not interpolated between missing years.",
    ],
  },
  {
    heading: "Measurement notes",
    bullets: [
      "Survey design and coverage differ across countries; treat cross-country levels as indicative, not exact rankings.",
      "Revisions and new surveys can change past estimates slightly.",
    ],
  },
];

const GINI_FA: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "ضریب جینی نابرابری درآمد را خلاصه می‌کند؛ مقادیر بالاتر به‌معنای توزیع نابرابرتر درآمد است.",
      "این نمودار از شاخص‌های توسعهٔ جهانی بانک جهانی (SI.POV.GINI) استفاده می‌کند؛ معمولاً بر پایهٔ نظرسنجی‌های خانوار؛ سال‌های بدون برآورد به‌صورت شکاف دیده می‌شوند.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "محور عمودی: ضریب جینی در مقیاس ۰ تا ۱۰۰ (قرارداد بانک جهانی). ۰ یعنی برابری کامل؛ ۱۰۰ یعنی حداکثر نابرابری.",
      "راهنمای ابزار (tooltip) مقدار عددی نقطهٔ زیر مکان‌نما را نشان می‌دهد.",
      "خطوط فقط سال‌هایی را که داده وجود دارد به هم وصل می‌کنند؛ بین سال‌های بدون داده درون‌یابی نمی‌شود.",
    ],
  },
  {
    heading: "Measurement notes",
    bullets: [
      "طرح نظرسنجی و پوشش در کشورها متفاوت است؛ سطح کشورها را نشانه‌ای بگیرید، نه رتبه‌بندی دقیق.",
      "تجدیدنظرها و نظرسنجی‌های جدید ممکن است برآوردهای گذشته را کمی تغییر دهند.",
    ],
  },
];

const INFLATION_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "Inflation rate measures how quickly consumer prices rise each year, expressed as the percentage change from the same period a year earlier (year-on-year, YoY).",
      "This chart uses the World Bank’s annual series (FP.CPI.TOTL.ZG) for Iran and the United States.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "Horizontal axis: calendar year (annual data). Vertical axis: inflation in percent per year.",
      "Positive values mean prices rose on average versus the prior year; negative values mean they fell (deflation).",
      "Tooltips show the year and the rate with a percent sign (e.g. 18.4% YoY).",
    ],
  },
  {
    heading: "Measurement notes",
    bullets: [
      "CPI baskets and methods differ by country; the chart is for context, not a strict ranking.",
      "Revisions can change recent years slightly.",
    ],
  },
];

const INFLATION_FA: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "نرخ تورم نشان می‌دهد قیمت‌های مصرف‌کننده در هر سال نسبت به همان دورهٔ سال قبل چه مقدار تغییر کرده‌اند (درصد تغییر سال‌به‌سال، YoY).",
      "این نمودار از سری سالانهٔ بانک جهانی (FP.CPI.TOTL.ZG) برای ایران و ایالات متحده استفاده می‌کند.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "محور افقی: سال تقویمی (دادهٔ سالانه). محور عمودی: تورم به درصد در سال.",
      "مقادیر مثبت یعنی به‌طور میانگین قیمت‌ها نسبت به سال قبل بالا رفته‌اند؛ مقادیر منفی یعنی افت میانگین (کاهش قیمت).",
      "راهنمای ابزار سال و نرخ را با علامت درصد نشان می‌دهد.",
    ],
  },
  {
    heading: "Measurement notes",
    bullets: [
      "سبد و روش CPI در کشورها متفاوت است؛ نمودار برای زمینه است، نه رتبه‌بندی سخت‌گیرانه.",
      "تجدیدنظرها ممکن است سال‌های اخیر را کمی جابه‌جا کنند.",
    ],
  },
];

const POVERTY_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "The poverty rate measures the share of the population living below a defined income threshold.",
      "This chart uses two World Bank WDI headcount series for Iran (indicators SI.POV.DDAY and SI.POV.LMIC). The legend and tooltips use the dollar thresholds given in the Bank’s current indicator names (PPP basis).",
    ],
  },
  {
    heading: "Important note",
    bullets: [
      "These values use international poverty lines published in WDI and may differ from national definitions of poverty.",
      "World Bank international lines and PPP bases are revised over time; indicator codes can stay the same while the published $/day label changes between data releases.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "Horizontal axis: calendar year. Vertical axis: percent of the population below each line.",
      "The two lines are not additive: someone below the higher line is already counted in that series.",
      "Tooltips show the year, the poverty rate with a percent sign, and which threshold the series refers to.",
    ],
  },
];

const POVERTY_FA: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "نرخ فقر سهم جمعیتی را نشان می‌دهد که زیر آستانهٔ درآمد تعریف‌شده زندگی می‌کنند.",
      "این نمودار دو سری شمارش فقر WDI بانک جهانی برای ایران را نشان می‌دهد (SI.POV.DDAY و SI.POV.LMIC). فقره و راهنمای ابزار از عناوین فعلی شاخص بانک (مبنای PPP) پیروی می‌کنند.",
    ],
  },
  {
    heading: "Important note",
    bullets: [
      "این مقادیر بر پایهٔ خطوط فقر بین‌المللی منتشرشده در WDI است و ممکن است با تعاریف ملی فقر متفاوت باشد.",
      "خطوط بین‌المللی و مبنای PPP بانک جهانی در طول زمان تجدیدنظر می‌شوند؛ کد شاخص می‌تواند ثابت بماند در حالی که برچسب دلار/روز در انتشارات عوض می‌شود.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "محور افقی: سال تقویمی. محور عمودی: درصد جمعیت زیر هر خط.",
      "دو خط جمع نیستند؛ کسی که زیر خط بالاتر است در همان سری شمرده شده است.",
      "راهنمای ابزار سال، نرخ با علامت درصد، و خط فقر مربوط به هر سری را نشان می‌دهد.",
    ],
  },
];

export function giniLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? GINI_FA : GINI_EN;
}

export function inflationLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? INFLATION_FA : INFLATION_EN;
}

export function povertyLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? POVERTY_FA : POVERTY_EN;
}

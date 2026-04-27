import type { LearningNoteSection } from "@/components/learning-note";

const GINI_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "The Gini coefficient measures income inequality. Higher values mean more inequality in the distribution of income.",
      "This chart uses World Bank World Development Indicators (SI.POV.GINI), typically from household surveys; years without estimates appear as gaps. Series include Iran, the United States, Germany, Turkey, China, and Saudi Arabia where WDI publishes values.",
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
      "این نمودار از شاخص‌های توسعهٔ جهانی بانک جهانی (SI.POV.GINI) برای ایران، ایالات متحده، آلمان، ترکیه، چین و عربستان سعودی استفاده می‌کند؛ معمولاً بر پایهٔ نظرسنجی‌های خانوار؛ سال‌های بدون برآورد برای هر کشور به‌صورت شکاف دیده می‌شوند.",
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
      "This chart uses the World Bank’s annual series (FP.CPI.TOTL.ZG) for Iran, the United States, Germany, Turkey, China, and Saudi Arabia.",
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
      "این نمودار از سری سالانهٔ بانک جهانی (FP.CPI.TOTL.ZG) برای ایران، ایالات متحده، آلمان، ترکیه، چین و عربستان سعودی استفاده می‌کند.",
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

const GDP_GLOBAL_COMPARISON_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "Gross domestic product (GDP) is the total value of finished goods and services produced in an economy over a period. Here it is shown as World Bank WDI totals for six geographies: the United States, China, Iran, Turkey, Saudi Arabia, and the published world aggregate (WLD).",
      "Default view is indexed so lines show relative change from a common base style (100 in calendar year 2000 when available for that series). Absolute levels use the Bank’s preferred constant-price series where present, with current US$ as a fallback per economy when needed.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "Horizontal axis: year (Gregorian calendar; optional Solar Hijri / both labels when Persian UI is on). Vertical axis: index (100 = base year) or GDP in US dollars, depending on the toggle.",
      "Indexed lines answer “how much larger or smaller is GDP versus the base year?” for each country separately; they do not rank total dollar size on one scale.",
      "Log scale (absolute view only) compresses very large gaps—useful when one economy’s dollar total would otherwise flatten the rest.",
    ],
  },
  {
    heading: "Why comparisons need care",
    bullets: [
      "Population, prices, and measurement revisions differ; dollar totals reflect exchange rates and definitions, not welfare per person.",
      "The WLD aggregate follows World Bank methodology; it is not the sum of the five countries on the chart.",
    ],
  },
];

const GDP_GLOBAL_COMPARISON_FA: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "تولید ناخالص داخلی (GDP) جمع ارزش کالاها و خدمات نهایی تولیدشده در یک اقتصاد در یک دوره است. اینجا از WDI بانک جهانی برای ایالات متحده، چین، ایران، ترکیه، عربستان سعودی و مجموع جهانی منتشرشده (WLD) نمایش داده می‌شود.",
      "نمای پیش‌فرض شاخص‌شده است تا تغییر نسبی نسبت به سال پایه (۱۰۰ در سال ۲۰۰۰ میلادی هر جا برای آن سری موجود باشد) خوانا بماند. سطح مطلق ترجیحاً به دلار ثابت ۲۰۱۵ و در صورت نبود داده به دلار جاری برای هر اقتصاد است.",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "محور افقی: سال (میلادی؛ در رابط فارسی می‌توان برچسب شمسی یا هر دو را دید). محور عمودی: شاخص (۱۰۰ = سال پایه) یا GDP به دلار بسته به حالت نمایش.",
      "خطوط شاخص‌شده برای هر کشور جدا پاسخ می‌دهند GDP نسبت به سال پایه چقدر بزرگ‌تر یا کوچک‌تر شده؛ رتبه‌بندی مطلق دلاری روی یک مقیاس نیست.",
      "مقیاس لگاریتمی فقط در نمای مطلق است و فاصلهٔ بسیار بزرگ دلاری را فشرده می‌کند.",
    ],
  },
  {
    heading: "Why comparisons need care",
    bullets: [
      "جمعیت، قیمت‌ها و تجدیدنظرها فرق می‌کنند؛ جمع دلاری نرخ ارز و تعاریف را منعکس می‌کند، نه رفاه به ازای هر نفر.",
      "مجموع WLD طبق روش بانک جهانی است؛ جمع پنج کشور نمودار نیست.",
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

export function gdpGlobalComparisonLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? GDP_GLOBAL_COMPARISON_FA : GDP_GLOBAL_COMPARISON_EN;
}

export function povertyLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? POVERTY_FA : POVERTY_EN;
}

const MONEY_SUPPLY_M2_EN: LearningNoteSection[] = [
  {
    heading: "What this shows",
    bullets: [
      "Money supply growth measures how fast broad money (often labeled M2: cash plus deposits that can be spent fairly quickly) is increasing, expressed as an annual percent change (year-on-year).",
      "The primary M2 line combines WDI through 2016 with a CBI-liquidity–based extension. A second line adds Iran CPI inflation (WDI FP.CPI.TOTL.ZG) on the same calendar year. For the post-2016 construction, open the “Methodology (Post-2016 Extension)” section under the first chart (and use the same source line on PNG export).",
    ],
  },
  {
    heading: "How to read",
    bullets: [
      "Vertical axis: percent per year. Horizontal axis: year (Gregorian; optional Solar Hijri / both labels in Persian mode).",
      "High money growth can contribute to inflation pressure, but the relationship is not always immediate or one-to-one: velocity, output, and expectations also matter. The CPI series can extend past the WDI M2 window; the stitched M2 line extends with liquidity-based YoY where we have levels.",
    ],
  },
  {
    heading: "Source line (export)",
    bullets: [
      "Source: World Bank WDI (FM.LBL.BMNY.ZG; IMF IFS); post-2016 derived from CBI-style liquidity levels (YoY).",
    ],
  },
];

const MONEY_SUPPLY_M2_FA: LearningNoteSection[] = [
  {
    heading: "این چه می‌نماید",
    bullets: [
      "رشد نقدینگی یعنی سرعت افزایش حجم پول و سپرده‌های قابل خرج در اقتصاد — اغلب با پول وسیع / M2؛ در اینجا به‌صورت تغییر درصد سالانه (نسبت به سال قبل) نمایش داده می‌شود.",
      "خط اصلی M2 ترکیب WDI تا ۲۰۱۶ با ادامه مبتنی بر سطح نقدینگی است؛ تفکیک کامل ۲۰۱۷+ در بلوک «روش‌شناسی (بخش بعد از ۲۰۱۶)» زیر نمودار اول. خط دوم تورم CPI (FP.CPI.TOTL.ZG) را روی همان سال می‌گذارد. ردیف منبع پاورقی PNG همان ردیف منبع در پایین صفحه است.",
    ],
  },
  {
    heading: "چگونه بخوانید",
    bullets: [
      "محور عمودی: درصد در سال. محور افقی: سال (میلادی؛ در رابط فارسی شمسی یا هر دو).",
      "رشد بالای نقدینگی می‌تواند به فشار تورمی کمک کند اما ارتباط همیشه سریع یا یک‌به‌یک نیست؛ شکست داده و تفاوت طول سری مهم است.",
    ],
  },
  {
    heading: "ردیف منبع (خروج)",
    bullets: [
      "منبع: WDI بانک جهانی؛ IMF IFS؛ بخش بعد از ۲۰۱۶ بر اساس سطوح نقدینگی (محاسبه رشد سالانه).",
    ],
  },
];

export function moneySupplyM2LearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? MONEY_SUPPLY_M2_FA : MONEY_SUPPLY_M2_EN;
}

const ISI_DIAGNOSTICS_EN: LearningNoteSection[] = [
  {
    heading: "What ISI refers to here",
    bullets: [
      "Import substitution industrialization (ISI) usually describes development strategies that emphasize domestic production behind trade barriers—often with rising industrial shares and compressed imports relative to earlier openness.",
      "This page does not estimate a formal ISI regime index; it only plots standard WDI trade and industry shares plus GDP growth so you can look for patterns historically.",
      "The overview chart indexes four structure series to 100 in a common base year (preferring 2000) for the country you select—use it for pattern comparison, not for reading absolute percentage levels.",
    ],
  },
  {
    heading: "How to read the charts",
    bullets: [
      "Trade structure: each country has two lines—imports and exports as % of GDP (same vertical scale).",
      "Industrial structure: manufacturing value added and total industry value added are both % of GDP (manufacturing is a subset of industry in accounts).",
      "Outcomes: annual real GDP growth (NY.GDP.MKTP.KD.ZG) in percent per year—not indexed.",
      "Use the legend to hide lines when many series overlap; event markers default off.",
    ],
  },
];

const ISI_DIAGNOSTICS_FA: LearningNoteSection[] = [
  {
    heading: "ISI اینجا یعنی چه",
    bullets: [
      "صنعتی‌سازی جایگزین واردات (ISI) معمولاً به استراتژی‌هایی اشاره دارد که بر تولید داخلی پشت مانع تجاری تأکید دارند—اغلب با بالا رفتن سهم صنعت و فشرده شدن واردات نسبت به دوره‌های بازتر.",
      "این صفحه شاخص رسمی «رژیم ISI» برآورد نمی‌کند؛ فقط سهم‌های استاندارد WDI بازرگانی و صنعت به‌همراه رشد GDP را می‌گذارد تا الگوهای تاریخی را ببینید.",
      "نمای کلی چهار سری ساختاری را برای کشور انتخاب‌شده به شاخص ۱۰۰ در سال مبنای مشترک (ترجیحاً ۲۰۰۰) می‌برد—برای مقایسهٔ الگو است، نه خواندن سطح درصد مطلق.",
    ],
  },
  {
    heading: "چگونه بخوانید",
    bullets: [
      "ساختار تجارت: برای هر کشور دو خط — واردات و صادرات به‌صورت ٪ از GDP (یک مقیاس عمودی).",
      "ساختار صنعتی: ارزش افزوده تولیدات کارخانه‌ای و ارزش افزوده کل صنعت هر دو ٪ از GDP هستند (کارخانه بخشی از صنعت در حساب‌های ملی است).",
      "پیامدها: رشد سالانهٔ GDP واقعی (NY.GDP.MKTP.KD.ZG) به‌صورت درصد در سال — شاخص‌نشده.",
      "از افسانه برای پنهان کردن خطوط در شلوغی استفاده کنید؛ نشانگرهای رویداد پیش‌فرض خاموش‌اند.",
    ],
  },
];

export function isiDiagnosticsLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? ISI_DIAGNOSTICS_FA : ISI_DIAGNOSTICS_EN;
}

const DUTCH_DIAGNOSTICS_EN: LearningNoteSection[] = [
  {
    heading: "How to read these panels",
    bullets: [
      "At the top, one overview chart re-bases selected series to 100 in a common base year (preferring 2000) so you can compare broad co-movement; units are not comparable there—use the detail charts for levels.",
      "Below: four separate charts: (1) oil rents as % of GDP, (2) manufacturing value added as % of GDP, (3) imports as % of GDP, (4) open-market USD→toman.",
      "The WDI panels are annual; the FX chart uses the same open-market series as the USD→toman study and may be daily.",
      "Each detail y-axis is tuned to its own series—do not compare vertical gaps across panels as fixed magnitudes.",
    ],
  },
  {
    heading: "What this study does not claim",
    bullets: [
      "No composite “Dutch disease score” and no causal attribution: co-movement is descriptive.",
      "Manufacturing share is one tradable-sector proxy; other tradables and relative prices are not fully represented.",
      "Event markers are optional context only when enabled.",
    ],
  },
];

const DUTCH_DIAGNOSTICS_FA: LearningNoteSection[] = [
  {
    heading: "چگونه بخوانید",
    bullets: [
      "بالا یک نمای کلی چندسریه سری‌های انتخاب‌شده را در یک سال مبنای مشترک (ترجیحاً ۲۰۰۰) به شاخص ۱۰۰ می‌برد تا هم‌حرکتی کلی دیده شود؛ آنجا واحدها قابل مقایسهٔ مطلق نیستند — برای سطح واقعی به نمودارهای جدا رجوع کنید.",
      "پایین: چهار نمودار جدا — (۱) اجاره نفت ٪ از GDP، (۲) ارزش افزوده تولیدات کارخانه‌ای ٪ از GDP، (۳) واردات ٪ از GDP، (۴) دلار به تومان بازار آزاد.",
      "پنل‌های WDI سالانه‌اند؛ FX ممکن است روزانه باشد.",
      "در نمودارهای تفصیلی هر محور عمودی برای همان سری تنظیم شده — فاصلهٔ بصری بین پنل‌ها را نسبت مطلق نگیرید.",
    ],
  },
  {
    heading: "این مطالعه چه ادعایی ندارد",
    bullets: [
      "شاخص ترکیبی «بیم هلندی» وجود ندارد و هم‌حرکتی علیت نیست.",
      "سهم کارخانه‌جات فقط یک نماینده بخش قابل‌معامله است.",
      "نشانگرهای رویداد در صورت روشن شدن صرفاً زمینه‌اند.",
    ],
  },
];

export function dutchDiseaseDiagnosticsLearningSections(isFa: boolean): LearningNoteSection[] {
  return isFa ? DUTCH_DIAGNOSTICS_FA : DUTCH_DIAGNOSTICS_EN;
}

import type { Concept, ConceptKey } from "@/lib/concepts";
import { CONCEPTS } from "@/lib/concepts";

/** Persian overlays for concept cards (Iran FA mode). */
const CONCEPT_FA: Partial<Record<ConceptKey, Partial<Pick<Concept, "title" | "description" | "inSimpleTerms">>>> = {
  nominal_price: {
    title: "قیمت اسمی",
    description:
      "قیمتی که در همان لحظه به واحد پول جاری نقل می‌شود، بدون تعدیل تورم؛ نشان‌دهندهٔ ارزش بازار در زمان مشاهده است.",
  },
  oil_benchmark: {
    title: "مرجع نفت (برنت)",
    description:
      "نوعی نفت معیار در بازارهای جهانی که اغلب به‌عنوان مرجع برای قیمت‌های نفت استفاده می‌شود.",
  },
  event_overlay: {
    title: "رویدادهای زمینه‌ای",
    description:
      "نشانگرهای زمانی برای زمینه‌سازی بصری؛ برای درک هم‌زمانی، نه استدلال علّی خودکار.",
  },
  oil_price_shocks: {
    title: "شوک‌های قیمت نفت",
    description: "حرکات بزرگ قیمت که در این نما با نشانگر مشخص شده‌اند؛ صرفاً توصیفی.",
  },
  fx_rate: {
    title: "نرخ ارز",
    description: "تعداد واحد پول ملی در برابر یک واحد ارز مرجع؛ در این مطالعه معمولاً تومان به ازای دلار.",
  },
  ppp: {
    title: "برابری قدرت خرید (PPP)",
    description:
      "ضریب تبدیلی که نشان می‌دهد برای خرید همان سبد کالا چه مقدار پول ملی لازم است؛ برای مقایسهٔ بار داخلی.",
  },
  ppp_oil_burden: {
    title: "بار نفت بر پایهٔ PPP",
    description: "تقریبی از «سنگینی» قیمت نفت در اقتصاد داخلی با تعدیل PPP، نه نرخ بازار آزاد.",
  },
  log_scale: {
    title: "مقیاس لگاریتمی",
    description:
      "مقیاسی که فاصلهٔ عمودی یکسان را به‌جای تغییر مطلق، به‌صورت درصد تقریباً یکسان نشان می‌دهد.",
  },
  structural_break: {
    title: "شکست ساختاری",
    description: "نقطه یا دوره‌ای که سطح یا روند سری عوض می‌شود؛ توصیفی، بدون ادعای تشخیص آماری خودکار.",
  },
  derived_series: {
    title: "سری مشتق",
    description: "سری ساخته‌شده از ترکیب یا تبدیل سری‌های دیگر؛ برای برداشت باید فرمول و منبع را دید.",
  },
  price_vs_quantity: {
    title: "قیمت در برابر مقدار",
    description: "درآمد یا ظرفیتِ وابسته به هر دو قیمت و حجم؛ قیمت به‌تنهایی کافی نیست.",
  },
  oil_export_volume: {
    title: "حجم صادرات نفت",
    description: "مقدار نفت صادرشده در زمان؛ برآوردها تحت تحریم ناپایدارند.",
  },
  indexing: {
    title: "شاخص‌سازی و سال پایه",
    description: "بازتاباندن سری طوری که سال پایه برابر ۱۰۰ شود؛ برای دیدن تغییر نسبی.",
  },
  export_capacity_proxy: {
    title: "شاخص تقریبی ظرفیت صادرات",
    description: "جایگزین ساده برای «ظرفیت درآمدی»؛ نه درآمد تحقق‌یافته.",
  },
  multiple_exchange_rates: {
    title: "چند نرخ ارز",
    description: "هم‌زمانی نرخ رسمی و بازار آزاد؛ شکاف معمولاً بازتاب کنترل‌ها و محدودیت‌هاست.",
  },
  official_exchange_rate: {
    title: "نرخ رسمی",
    description: "نرخی که مرجع رسمی اعلام می‌کند؛ ممکن است با تجربهٔ بازار آزاد تفاوت داشته باشد.",
  },
  capital_controls: {
    title: "کنترل سرمایه",
    description: "محدودیت‌هایی بر جابه‌جایی ارز و سرمایه که به شکاف نرخ‌ها کمک می‌کند.",
  },
  price_controls: {
    title: "کنترل قیمت",
    description: "سقف یا کف قیمتی که می‌تواند سیگنال بازار را از قیمت تعادلی دور کند.",
  },
  measurement_vs_reality: {
    title: "اندازه‌گیری در برابر واقعیت",
    description: "شکاف میان آنچه آمار ثبت می‌کند و آنچه در اقتصاد غیررسمی رخ می‌دهد.",
  },
  fx_spread: {
    title: "شکاف نرخ ارز",
    description: "اختلاف درصدی یا نسبی بین دو نرخ؛ معمولاً رسمی در برابر آزاد.",
  },
  real_price: {
    title: "قیمت واقعی",
    description: "قیمت تعدیل‌شده با تورم؛ برای مقایسهٔ توان خرید در زمان‌های مختلف.",
  },
  cpi: {
    title: "شاخص قیمت مصرف‌کننده (CPI)",
    description: "میانگین تغییر قیمت سبد مصرفی خانوار؛ برای تعدیل اسمی به واقعی.",
  },
  purchasing_power: {
    title: "توان خرید",
    description: "مقدار کالا و خدمتی که با یک واحد درآمد می‌توان خرید؛ با تورم بالا کاهش می‌یابد.",
  },
  nominal_minimum_wage: {
    title: "حداقل دستمزد اسمی",
    description: "رقم اعلام‌شده بدون تعدیل قیمت‌ها؛ ممکن است با توان خرید واقعی هم‌خوان نباشد.",
  },
  real_wage: {
    title: "دستمزد واقعی",
    description: "دستمزد تعدیل‌شده با CPI؛ نزدیک‌تر به توان خرید از رقم اسمی.",
  },
  gdp_aggregate: {
    title: "تولید ناخالص داخلی (GDP)",
    description: "ارزش افزودهٔ نهایی کالا و خدمات تولیدشده در مرز یک کشور در یک دوره.",
  },
  final_consumption_share: {
    title: "سهم مصرف نهایی",
    description: "بخشی از GDP که مصرف نهایی خانوار و دولت تشکیل می‌دهد؛ در این نما به‌صورت درصد از GDP.",
  },
  gross_capital_formation: {
    title: "تشکیل سرمایهٔ ناخالص (سرمایه‌گذاری)",
    description: "سرمایه‌گذاری ناخالص ثابت و موجودی تغییرات؛ در این نما اغلب به‌صورت درصد از GDP.",
  },
};

export function getLocalizedConcept(key: ConceptKey, isFa: boolean): Concept {
  const base = CONCEPTS[key];
  const fa = CONCEPT_FA[key];
  if (!isFa || !fa) return base;
  return {
    ...base,
    title: fa.title ?? base.title,
    description: fa.description ?? base.description,
    inSimpleTerms: fa.inSimpleTerms ?? base.inSimpleTerms,
  };
}

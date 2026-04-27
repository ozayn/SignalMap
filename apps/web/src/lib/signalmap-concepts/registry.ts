import type { SignalMapConcept, SignalMapCoreConceptId } from "./types";
import { SIGNALMAP_CORE_CONCEPT_ORDER } from "./types";

const list: Record<SignalMapCoreConceptId, SignalMapConcept> = {
  fx: {
    id: "fx",
    title_en: "Foreign exchange (FX)",
    title_fa: "نرخ و بازار ارز (FX)",
    short_en: "The price of one currency in terms of another (e.g. how many toman or rials one US dollar buys on a given day).",
    short_fa: "قیمتِ یک ارز نسبت به دیگری (مثلاً چند تومان/ریال به‌ازای یک دلار در همان خوان روز/بازه).",
    example_en: "If USD/IRR goes from 40,000 to 50,000, the local unit depreciates: each dollar costs more in domestic currency.",
    example_fa: "اگر نسبت «دلار به جمع ریال» جابه‌جا شود، مثلا ریال در برابر دلار ضعیف‌تر دیده می‌شود: برای هر دلار باید ریال/تومان بیشتری بپردازید (در همان بستر اعلام/بازار).",
    tags: ["fx", "exchange", "rate", "currency", "dollar", "toman", "rial"],
  },
  cpi: {
    id: "cpi",
    title_en: "Consumer Price Index (CPI)",
    title_fa: "شاخص قیمت مصرف‌کننده (CPI)",
    short_en: "An index of how average consumer prices for a defined basket of goods and services change over time; used to track inflation in consumer prices and to convert nominal to real values.",
    short_fa: "نمایه‌ای از میانگین تغییر قیمت کالا و خدمات سبد «مصرف‌کننده» در گذر زمان؛ پایهٔ سنجش تورم مصرف‌کننده و تعدیل سری «اسمی» به «واقعی» (ثابت قدرت خرید).",
    example_en: "With CPI, you can see whether 10% more nominal wage is eaten by 12% higher prices: real (CPI-deflated) wage might fall even when the nominal figure rises.",
    example_fa: "با داشتن تورم مصرف‌کننده می‌توان ببین اگر اعلام «رشد دستمزد» ۱۰٪ باشد و تورم سبد مصرف ۱۲٪، توان خرید واقعی ممکن است کم‌تر شود اگر فقط سطح اسمی را ببینید.",
    tags: ["cpi", "inflation", "index", "basket", "prices", "deflator"],
  },
  inflation: {
    id: "inflation",
    title_en: "Inflation (general price level)",
    title_fa: "تورم (سطح عمومی قیمت‌ها)",
    short_en: "A sustained increase in the general level of prices (often measured with CPI or similar), reducing how much a unit of money can buy if nominal incomes do not keep pace.",
    short_fa: "افت پایداری مقدار خرید «هر واحد پولی» اگر سطحِ عمومی قیمت‌ها بالا برود و «درآمد/قیمت اسمی» جبران نکند (اغلب با تورم مصرف‌کننده/سبدِ مشابه اندازه‌گرفتنی است).",
    example_en: "A bond paying a fixed rial coupon loses purchasing power in real terms when inflation runs higher than the nominal return suggests.",
    example_fa: "اگر تورم بالا باشد، اصل و سودی که به مبلغ «ثابت و اسمی» اعلام می‌شود ممکن است سهم واقعی بیشتری از اقتصاد اخذ کند: خرید با «همان مبلغ روی کاغذ» ممکن است کاهش یابد.",
    tags: ["inflation", "price_level", "cpi", "purchasing_power"],
  },
  nominal_vs_real: {
    id: "nominal_vs_real",
    title_en: "Nominal vs real (values)",
    title_fa: "اسمی در برابر واقعی (واقعی «ثابت-قدرت-خرید»)",
    short_en: "Nominal values are measured in current units of account (e.g. today’s rial, today’s dollars). Real values are adjusted to remove the effect of inflation, so you compare true purchasing power or cost across time using a deflator (often CPI).",
    short_fa: "«اسمی» به واحد جاری (ریال/دلارِ همان رو) بدون اصلاح تورم. «واقعی» (ثابت قدرت خرید) وقتی اثر تورم را به‌واسطه کاهش/بسط با شاخص (غالبا CPI) برمی‌دارید تا بتوانید بار یا رفاه «قابل‌مقایسه» ببینید — نه فقط عدد بزرگ‌تر روی کاغذ.",
    example_en: "Nominal Brent in 2022 dollars vs real Brent in 2015 dollars: the second answers “how hard did oil feel” relative to consumer prices, not the headline number alone.",
    example_fa: "قیمت نفت «اسمی» (با جاری) را با نفت تعدیل‌شده با تورم مقایسه کنید: اگر تورم بالا رود، همان مبلغ اسمی اگر کمتر تغییر کند، ممکن است سنگین‌تر/سبک‌تر «واقعی» از نظر اقتصاددانی که به مصرف نگاه می‌کند باور کنید و از نظر اعداد بزرگ روی میله‌های نمودار منحرف نشوید.",
    tags: ["nominal", "real", "inflation", "deflator", "purchasing_power", "constant_prices"],
  },
  oil_shock: {
    id: "oil_shock",
    title_en: "Oil shock (sharp price or supply event)",
    title_fa: "شوک نفتی (جهش سریع قیمت/عرضه/رفتار بازار)",
    short_en: "A short period when oil price or availability moves unusually, often on geopolitics, supply outages, or logistics—often with large daily returns vs recent volatility.",
    short_fa: "لحظه‌ای/بستری که نفت (قیمت یا اثر عرضه) از حرکت «معمولی» اخیر به‌شکل چشمگیر جابه‌جا شود؛ اغلب با اخبار ژئوپلتیک/قطع/جنگ/تحریم همراه است (در این محصول: معمولاً بیم‌/امید بازار مالی از حرکات اخیر).",
    example_en: "Embargoes, wars, or OPEC+ meetings can move benchmarks like Brent in days when percentage changes exceed the recent “normal” band.",
    example_fa: "تحریم/جنگ/نتیجه اجلاس «اوپک و شرکا» (مفهومی) — در عرض چند جلسه معامله، اگر تغییر٪-روزانه نسبت به واریانس اخیر خیلی بزرگ شود، اقتصاددان در یک «شوک سریع» اثر می‌گوید.",
    tags: ["oil", "brent", "geopolitics", "volatility", "shock", "opec", "price"],
  },
  sanctions: {
    id: "sanctions",
    title_en: "Economic sanctions",
    title_fa: "تحریم اقتصادی",
    short_en: "Restrictions (trade, finance, technology, or shipping) imposed to change behaviour; in applied charts they show up in FX gaps, price vs quantity, and export constraints—not one mechanical price formula.",
    short_fa: "محدودیت (تجاری، مالی-بانکی، فناورانه، کشتیرانی) برای فشار/گفتگوی سیاست. در نمودار: شکاف نرخ، افت مقدار صادرات/تولید و جدا بودن نرخ رسمی/آزاد «توصیفی» است—نه یک فرمول خودکار «علت‌تک‌خانه».",
    example_en: "Export capacity may fall while quoted oil price stays high: sanctions often bind volumes before they bind the price series you see on a screen.",
    example_fa: "ممکن است مقدار (حجم) صادرات/آنتالیا به‌شدت کم ولی قیمت جهانی/مرجع صعودی بالا بماند؛ اثر بر درآمدِ بالقوه اتکا دارد — نه صرفا به اعداد بزرگ قیمت.",
    tags: ["sanctions", "export", "trade", "compliance", "enforcement", "ir"],
  },
  spread: {
    id: "spread",
    title_en: "Spread (gap between two rates or prices)",
    title_fa: "شکاف/اسپرد (تفاوت نسبی دو نرخ/قیمت)",
    short_en: "In FX work, the gap between (for example) the official and open-market rate, or between bid and ask, expressed in levels or in percent. It often signals a wedge when policy and market do not line up.",
    short_fa: "در اقتصاد-ارز: فاصلهٔ اختلاف دو نرخ/دو قیمت (مثلاً رسمی در برابر بازار/آزاد یا bid/ask) به‌واحد یا اغلب به٪. «همان شکاف» اگر بزرگ شود: کنترل، انتظار یا تقاضا در بازار غیررسمی را افتضاح‌تر (توصیفی) توضیح می‌دهد.",
    example_en: "If the official rate is 42,000 IRR/USD and the open market trades near 50,000, a positive spread in percent can indicate pressure outside the official window.",
    example_fa: "اگر ۴۲۰۰۰ (رسمی) و ۵۰۰۰۰ (آزاد) اعلان شود، اختلاف٪-بزرگ = سیگنال اختلاف اعلام-تجربه برای تحلیل‌گری (نه حکم اخلاقی-صرف).",
    tags: ["spread", "gap", "official", "parallel", "market", "arbitrage"],
  },
  exchange_rate_regime: {
    id: "exchange_rate_regime",
    title_en: "Exchange rate regime (fixed, managed, or floating)",
    title_fa: "نظام/رژیم نرخ ارز (ثابت/مدیریت‌شده/شناور)",
    short_en: "The rules a country (or its central bank) uses to set or influence the price of its currency: fixed or crawling peg, managed float, or more market-driven float. Affects how fast official and market rates can diverge.",
    short_fa: "قواعدی که دولت/بانک مرکزی برای نرخ ارز به‌کار می‌گیرد: پگ، شناور مدیریت‌شده، یا شناورتر. بر اختلاف احتمالی نرخ رسمی و بازار و سرعت تنظیم اثر دارد (توصیفی).",
    example_en: "Under a tight peg, small policy moves can be visible as large moves in the managed rate; under stress, secondary markets can reflect expectations not shown in the primary quote.",
    example_fa: "در پگ سخت، تغییر کوچک سیاست ممکن است در نرخ مدیریت‌شده بزرگ دیده شود؛ در استرس، بازار موازی می‌تواند انتظاری را منعکس کند که در نرخ اصلی نیست — صرفاً توصیفی.",
    tags: ["regime", "peg", "float", "intervention", "central_bank", "policy", "implied"],
  },
  liquidity_m2: {
    id: "liquidity_m2",
    title_en: "Liquidity: broad money (M2-style)",
    title_fa: "نقدینگی / پول وسیع (M2)",
    short_en: "Broad money aggregates include currency in circulation and various deposit types at banks—often used as a gauge of how much “money-like” balance-sheet liquidity exists. Interpretation is contextual: it does not, by itself, say whether inflation or exchange rates will move in one direction in every country or period.",
    short_fa: "جمع پول و شبه‌پول (اسکناس و سپرده‌های بانکی و …)؛ شاخصی برای «حجم نقدینگی» در معنای ملی. ارتباط با تورم یا نرخ ارز به تعریف سری، نهادها و دوره بستگی دارد — نه یک فرمول ثابت.",
    example_en: "If M2 is rising fast while the economy’s capacity to absorb it is not, some models stress inflation or asset-price channels—but country institutions and definitions differ (compare series notes on the page).",
    example_fa: "رشد سریع M2 در کنار کمبود ظرفیت عرضه ممکن است در برخی چارچوب‌ها به فشار تورمی اشاره شود؛ اما تعریف M2 و شرایط ملی متفاوت است — «M2 یعنی تورم» درست نیست.",
    tags: ["m2", "money", "broad", "monetary", "rials", "deposits", "liquidity"],
  },
  gdp: {
    id: "gdp",
    title_en: "Gross domestic product (GDP)",
    title_fa: "تولید ناخالص داخلی (GDP)",
    short_en: "The value of final goods and services produced within a country’s borders in a period (commonly in nominal and real terms). In composition charts, shares of GDP (consumption, investment, government) show the structure of the economy, not a universal welfare measure.",
    short_fa: "ارزش کالا و خدمات نهایی تولیدشده داخل مرز در یک دوره (اغلب اسمی و واقعی). در نمودار «سهم از GDP»، ساختار اقتصاد دیده می‌شود — نه معیار تک‌خطی رفاه.",
    example_en: "If household consumption is 50% of GDP and investment 25%, the economy tilts more toward current spending than toward building long-lived capital—interpretation is descriptive.",
    example_fa: "اگر مصرف نهایی خانوار بخش بزرگ‌تری از GDP باشد و تشکیل سرمایه بخش کوچک‌تری، در این نما «تمایل ساختاری» بیشتر به هزینه جاری دیده می‌شود — صرفاً توصیفی.",
    tags: ["gdp", "value_added", "composition", "income", "expenditure", "national_accounts"],
  },
};

export const SIGNALMAP_CONCEPT_REGISTRY: Readonly<typeof list> = list;

export const SIGNALMAP_CORE_ID_SET: ReadonlySet<SignalMapCoreConceptId> = new Set(
  SIGNALMAP_CORE_CONCEPT_ORDER
);

export function isSignalMapCoreConceptId(k: string): k is SignalMapCoreConceptId {
  return SIGNALMAP_CORE_ID_SET.has(k as SignalMapCoreConceptId);
}

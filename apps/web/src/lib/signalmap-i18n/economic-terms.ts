/**
 * Reusable Persian economic phrasing for SignalMap studies.
 * Pair with `L(isFa, english, faEconomic.key)` from `@/lib/iran-study-fa` on Iran FA-enabled pages.
 * Key technical terms use a minimal bilingual hint: «فارسی (Abbrev)» — abbreviations only, no long English.
 */
export const faEconomic = {
  gdp: "تولید ناخالص داخلی (GDP)",
  pctOfGdp: "درصدی از تولید ناخالص داخلی (GDP)",
  /** Axis / stat unit: percent of GDP (compact). */
  gdpPctUnit: "٪ از تولید ناخالص داخلی (GDP)",
  /** Composition chart caption above the share plot. */
  sharesOfGdp: "سهم‌ها از تولید ناخالص داخلی (GDP)",
  /** Main composition chart `label` / export title. */
  gdpCompositionTitle: "ترکیب تولید ناخالص داخلی (GDP)",
  /** Companion nominal GDP line label. */
  nominalGdpCompanion: "تولید ناخالص داخلی اسمی (GDP، همراه)",
  /** Nominal GDP series title (levels companion chart). */
  nominalGdpLevel: "تولید ناخالص داخلی اسمی (GDP)",
  gdpGrowth: "رشد تولید ناخالص داخلی (GDP)",
  realGdpGrowth: "رشد واقعی تولید ناخالص داخلی (GDP)",
  cpiInflation: "تورم شاخص قیمت مصرف‌کننده (CPI)",
  inflation: "تورم (CPI)",
  yoy: "نسبت به سال قبل",
  yoyAnnual: "٪ نسبت به سال قبل",
  nominal: "اسمی",
  realInflationAdjusted: "واقعی / تعدیل‌شده با تورم (CPI)",
  purchasingPower: "قدرت خرید",

  oilRents: "رانت نفتی",
  oilRevenuePlain: "درآمد نفتی",
  oilRentsPctGdp: "رانت نفتی (درصدی از تولید ناخالص داخلی) (GDP)",

  exchangeRate: "نرخ ارز (FX)",
  officialExchangeRate: "نرخ رسمی ارز (FX)",
  openMarketExchangeRate: "نرخ ارز بازار آزاد (FX)",
  dualExchangeRate: "نظام چندنرخی ارز (FX)",
  fxSpread: "شکاف نرخ ارز (FX)",
  fxSpreadPct: "شکاف نرخ ارز (٪) (FX)",
  officialVsOpen: "رسمی در برابر بازار آزاد",
  fxTitleOfficialVsOpenAnnual: "نرخ ارز: رسمی در برابر بازار آزاد (میانگین سالانه) (FX)",
  tomanPerUsd: "تومان به ازای هر دلار (FX)",

  broadMoney: "نقدینگی",
  m2Growth: "رشد نقدینگی (M2)",
  liquidityGrowth: "رشد نقدینگی (M2)",
  liquidityAndCpiTitle: "رشد نقدینگی (M2) و تورم شاخص قیمت مصرف‌کننده (CPI) (٪ سالانه)",
  growthLiquidityAndInflationAxis: "رشد نقدینگی و تورم (M2، CPI)",

  imports: "واردات",
  exports: "صادرات",
  tradeOpenness: "باز بودن تجاری",
  tradeToGdpRatio: "نسبت تجارت به تولید ناخالص داخلی (GDP)",
  manufacturingValueAdded: "ارزش افزوده تولید صنعتی",
  industryValueAdded: "ارزش افزوده بخش صنعت",
  manufacturingPctGdp: "ارزش افزوده تولید صنعتی (درصدی از تولید ناخالص داخلی) (GDP)",
  industryPctGdp: "ارزش افزوده بخش صنعت (درصدی از تولید ناخالص داخلی) (GDP)",
  importsExportsPctGdp: "واردات و صادرات (درصدی از تولید ناخالص داخلی) (GDP)",
  manufacturingIndustryPanelTitle: "ارزش افزوده تولید صنعتی و بخش صنعت (درصدی از تولید ناخالص داخلی) (GDP)",

  structuralAdjustment: "تعدیل ساختاری",
  reconstructionEconomy: "اقتصاد دوران بازسازی",
  importDependence: "وابستگی به واردات",
  exportDependence: "وابستگی به صادرات",
  dutchDisease: "بیماری هلندی",
  sanctions: "تحریم‌ها",
  eventMarkers: "نشانگرهای رویداد",

  officialRateAnnual: "نرخ رسمی ارز (سالانه) (FX)",
  openMarketAnnualMean: "نرخ ارز بازار آزاد (میانگین سالانه) (FX)",

  annualWdiVsMarketNoteFa:
    "برخی سری‌ها سالانه هستند (WDI) و برخی از داده‌های بازار با میانگین سالانه هم‌تراز شده‌اند؛ بنابراین این نمودارها برای مشاهده هم‌زمانی کلی به‌کار می‌روند، نه تطبیق روزبه‌روز.",
} as const;

export const enEconomic = {
  annualWdiVsMarketNoteEn:
    "Some series are annual WDI indicators, while market series are aligned using annual averages. These charts are intended for broad timing and pattern comparison, not day-by-day matching.",
} as const;

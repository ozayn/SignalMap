/**
 * Standardized economic labels for SignalMap (FA + EN mirrors).
 * Use `L(isFa, enEconomic.key, faEconomic.key)` from `@/lib/iran-study-fa` on bilingual study pages.
 * FA: main metric first; short English in parentheses only where listed; simple words (واردات، صنعت) stay Persian-only.
 */
export const faEconomic = {
  gdp: "تولید ناخالص داخلی (GDP)",
  /** Phrase for “% of GDP” in captions and source lines (no extra English tag). */
  pctOfGdp: "درصدی از تولید ناخالص داخلی",
  /** Compact axis / legend unit for share charts. */
  gdpPctUnit: "٪ از تولید ناخالص داخلی",
  sharesOfGdp: "سهم‌ها از تولید ناخالص داخلی (GDP)",
  gdpCompositionTitle: "ترکیب تولید ناخالص داخلی (GDP)",
  nominalGdpCompanion: "تولید ناخالص داخلی اسمی (GDP، همراه)",
  nominalGdpLevel: "تولید ناخالص داخلی اسمی (GDP)",
  gdpGrowth: "رشد تولید ناخالص داخلی (GDP growth)",
  realGdpGrowth: "رشد واقعی تولید ناخالص داخلی (GDP growth)",
  cpiInflation: "تورم شاخص قیمت مصرف‌کننده (CPI)",
  inflation: "تورم (CPI)",
  yoy: "نسبت به سال قبل",
  yoyAnnual: "٪ نسبت به سال قبل",
  nominal: "اسمی",
  realInflationAdjusted: "واقعی / تعدیل‌شده با تورم (CPI)",
  purchasingPower: "قدرت خرید",

  oilRents: "رانت نفتی",
  oilRevenuePlain: "درآمد نفتی",
  oilRentsPctGdp: "رانت نفتی (درصدی از تولید ناخالص داخلی)",
  brentOilPrice: "قیمت نفت برنت (Brent)",

  exchangeRate: "نرخ ارز (FX)",
  officialExchangeRate: "نرخ رسمی ارز",
  openMarketExchangeRate: "نرخ ارز بازار آزاد (FX)",
  dualExchangeRate: "نظام چندنرخی ارز",
  fxSpread: "شکاف نرخ ارز",
  fxSpreadPct: "شکاف نرخ ارز (٪)",
  fxSpreadApproxPct: "شکاف نرخ ارز (تقریبی ٪)",
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
  manufacturingPctGdp: "ارزش افزوده تولید صنعتی (درصدی از تولید ناخالص داخلی)",
  industryPctGdp: "ارزش افزوده بخش صنعت (درصدی از تولید ناخالص داخلی)",
  importsExportsPctGdp: "واردات و صادرات (درصدی از تولید ناخالص داخلی)",
  manufacturingIndustryPanelTitle: "ارزش افزوده تولید صنعتی و بخش صنعت (درصدی از تولید ناخالص داخلی)",

  structuralAdjustment: "تعدیل ساختاری",
  reconstructionEconomy: "اقتصاد دوران بازسازی",
  importDependence: "وابستگی به واردات",
  exportDependence: "وابستگی به صادرات",
  dutchDisease: "بیماری هلندی",
  sanctions: "تحریم‌ها",
  eventMarkers: "نشانگرهای رویداد",

  officialRateAnnual: "نرخ رسمی ارز (سالانه)",
  openMarketAnnualMean: "نرخ ارز بازار آزاد (میانگین سالانه) (FX)",

  annualWdiVsMarketNoteFa:
    "برخی سری‌ها سالانه هستند (WDI) و برخی از داده‌های بازار با میانگین سالانه هم‌تراز شده‌اند؛ بنابراین این نمودارها برای مشاهده هم‌زمانی کلی به‌کار می‌روند، نه تطبیق روزبه‌روز.",
} as const;

/** English chart labels (keep in sync with `faEconomic`). */
export const enEconomic = {
  annualWdiVsMarketNoteEn:
    "Some series are annual WDI indicators, while market series are aligned using annual averages. These charts are intended for broad timing and pattern comparison, not day-by-day matching.",

  gdpComposition: "GDP composition",
  realGdpGrowth: "Real GDP growth",
  gdpGrowth: "GDP growth",
  cpiInflation: "CPI inflation",
  openMarketExchangeRate: "Open-market exchange rate",
  officialExchangeRate: "Official exchange rate",
  fxSpread: "FX spread",
  broadMoneyGrowthM2: "Broad money growth (M2)",
  oilRents: "Oil rents",
  oilRentsPctGdp: "Oil rents (% of GDP)",
  estimatedOilRevenue: "Estimated oil revenue",
  brentOilPrice: "Brent oil price",
  manufacturingValueAdded: "Manufacturing value added",
  industryValueAdded: "Industry value added",
  imports: "Imports",
  exports: "Exports",
  pctOfGdp: "% of GDP",
} as const;

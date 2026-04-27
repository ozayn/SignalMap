import type { BandTimelinePeriodEvent } from "./signalmap-band-timeline/types";

/**
 * Canonical macro-crisis **periods** (ids and dates match `macro_crisis_periods.py` and API `world_core`).
 * Used to seed the band timeline without duplicating copy or ranges.
 */
export const MACRO_CRISIS_BAND_PERIODS: readonly BandTimelinePeriodEvent[] = [
  {
    kind: "period",
    id: "g-macro-great-depression",
    start_date: "1929-10-24",
    end_date: "1939-12-31",
    title_en: "Great Depression",
    title_fa: "رکود بزرگ",
    lane: "global",
    category: "global",
    importance: 3,
    description_en:
      "Global depression after the 1929 crash; deep trade, employment, and output losses across major economies (1920s–30s).",
    description_fa: "رکود جهانی پس از بحران ۱۹۲۹؛ افت سنگین تجارت، اشتغال و تولید در اقتصادهای اصلی.",
  },
  {
    kind: "period",
    id: "g-macro-gfc-2007",
    start_date: "2007-08-09",
    end_date: "2009-12-31",
    title_en: "Global Financial Crisis",
    title_fa: "بحران مالی جهانی",
    lane: "global",
    category: "global",
    importance: 3,
    description_en: "Subprime shock through banking stress, Lehman failure, and global recession (2007–2009).",
    description_fa: "شوک «ساب‌پرایم» تا بحران بانکی و رکود جهانی (۲۰۰۷–۲۰۰۹).",
  },
  {
    kind: "period",
    id: "g-covid-pandemic-era",
    start_date: "2020-01-30",
    end_date: "2022-12-31",
    title_en: "COVID-19 shock (2020–2022)",
    title_fa: "شوک کووید-۱۹ (۲۰۲۰–۲۰۲۲)",
    lane: "global",
    category: "global",
    importance: 3,
    description_en:
      "PHEIC and pandemic phase: lockdowns, large demand and supply dislocations, and major macro/energy swings.",
    description_fa: "فاز همه‌گیری و اضطرار بهداشت جهانی؛ تعطیلی‌ها و جابه‌جایی بزرگ تقاضا و عرضه و اثرهای کلان و انرژی.",
  },
];

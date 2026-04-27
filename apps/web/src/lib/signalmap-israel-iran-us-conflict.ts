import type { BandTimelineEvent } from "./signalmap-band-timeline/types";
import type { SignalMapTimelineEvent } from "./signalmap-timeline/types";

/**
 * Israel–Iran–US direct conflict (2024+). Ids and dates match ``israel_iran_us_conflict.py``
 * and API world_core / world_1900. End date on the main ongoing band is a **display** placeholder;
 * copy updates with the server-side rolling end for overlays.
 */
const ONGOING_MAIN_END = "2030-12-31";

/** Dot timeline: spans + point anchors (importance: major=3, secondary=2). */
export const ISRAEL_IRAN_US_TIMELINE_DOT: SignalMapTimelineEvent[] = [
  {
    id: "g-israel-iran-us-direct-conflict-ongoing",
    date_start: "2024-04-13",
    date_end: ONGOING_MAIN_END,
    title_en: "Israel–Iran direct conflict (ongoing)",
    title_fa: "رویارویی مستقیم اسرائیل و ایران (جاری)",
    description_en:
      "Direct Israel–Iran military escalation from April 2024 onward; U.S. alliance and regional spillovers; update end date periodically for display.",
    description_fa:
      "تشدید نظامی مستقیم اسرائیل-ایران از آوریل ۲۰۲۴ به بعد؛ نقش متحد آمریکا و اثرهای منطقه‌ای؛ پایان بازه فقط نمایشی است.",
    category: "war",
    tags: ["israel", "iran", "us", "mideast"],
    importance: 3,
  },
  {
    id: "g-il-ir-apr-2024-exchanges",
    date_start: "2024-04-14",
    title_en: "April 2024 Israel–Iran exchanges",
    title_fa: "مبادلات/تبادل آتش اردیبهشت ۱۴۰۳",
    description_en:
      "Large-scale drone and missile exchange after earlier Damascus strike; U.S. and partner air defence; crisis diplomacy.",
    description_fa:
      "تبادل گسترده پهپاد و موشک پس از اصابت دمشق؛ دفاع هوایی آمریکا و شرکا و دیپلماسی بحران.",
    category: "war",
    tags: ["israel", "iran", "2024"],
    importance: 3,
  },
  {
    id: "g-il-ir-12day-war-2025",
    date_start: "2025-06-13",
    date_end: "2025-06-24",
    title_en: "June 2025 Israel–Iran strikes (12 days)",
    title_fa: "حملات ژوئن ۲۰۲۵ (۱۲ روز)",
    description_en: "Open twelve-day war: missile/drone volleys, air sorties, oil and infrastructure risk.",
    description_fa: "دوازده روز جنگ آشکار؛ موج موشک/پهپاد و پروازها و ریسک نفت/زیرساخت.",
    category: "war",
    tags: ["israel", "iran", "2025"],
    importance: 3,
  },
  {
    id: "g-il-ir-2025-ceasefire",
    date_start: "2025-06-24",
    title_en: "June 2025 ceasefire",
    title_fa: "آتش‌بس ژوئن ۲۰۲۵",
    description_en: "Cessation after the 12-day phase; fragile, with continued regional tension.",
    description_fa: "توقف پس از فاز ۱۲روزه؛ اما تنش منطقه‌ای ادامه دارد.",
    category: "war",
    tags: ["israel", "iran", "ceasefire"],
    importance: 2,
  },
  {
    id: "g-us-il-ir-strikes-2026-02",
    date_start: "2026-02-28",
    title_en: "U.S.–Israel strikes on Iran (2026)",
    title_fa: "حملات آمریکا-اسرائیل به ایران (۲۰۲۶)",
    description_en: "Coordinated U.S. and Israeli strikes on nuclear- and security-linked targets; major market shock.",
    description_fa: "حملات هماهنگ بر اهداف هسته‌ای-امنیتی؛ شوک بزرگ بازار و ریسک منطقه‌ای.",
    category: "war",
    tags: ["us", "israel", "iran", "2026"],
    importance: 3,
  },
];

/** Band timeline: same episodes as horizontal bands / markers. */
export const ISRAEL_IRAN_US_BAND: BandTimelineEvent[] = [
  {
    kind: "period",
    id: "g-israel-iran-us-direct-conflict-ongoing",
    start_date: "2024-04-13",
    end_date: ONGOING_MAIN_END,
    title_en: "Israel–Iran direct conflict (ongoing)",
    title_fa: "رویارویی مستقیم اسرائیل و ایران (جاری)",
    lane: "middle_east_wars",
    category: "middle_east_wars",
    region: "middle_east",
    importance: 3,
    description_en:
      "Military exchange and escalation from April 2024; includes April/June 2025 and 2026 U.S.–allied operations within the same episode (see point markers).",
    description_fa:
      "مبادله و تشدید از آوریل ۱۴۰۳؛ شامل رویدادهای ۱۴۰۴ و عملیات ۱۴۰۵ در همان بستر (نقطه‌ها).",
  },
  {
    kind: "point",
    id: "g-il-ir-apr-2024-exchanges",
    date: "2024-04-14",
    title_en: "April 2024 exchanges",
    title_fa: "مبادلات اردیبهشت ۱۴۰۳",
    lane: "middle_east_wars",
    category: "middle_east_wars",
    region: "middle_east",
    importance: 3,
    description_en: "Key escalation round: drone/missile exchange and Alliance air defence; regional risk spike.",
    description_fa: "موج اصلی تبادل و دفاع متحدان؛ اوج ریسک منطقه‌ای.",
  },
  {
    kind: "period",
    id: "g-il-ir-12day-war-2025",
    start_date: "2025-06-13",
    end_date: "2025-06-24",
    title_en: "12-day war (June 2025)",
    title_fa: "جنگ ۱۲ روزه (ژوئن ۱۴۰۴)",
    lane: "middle_east_wars",
    category: "middle_east_wars",
    region: "middle_east",
    importance: 3,
    description_en: "Concentrated direct war phase before ceasefire line.",
    description_fa: "فاز متمرکز نبرد مستقیم تا خط آتش‌بس.",
  },
  {
    kind: "point",
    id: "g-il-ir-2025-ceasefire",
    date: "2025-06-24",
    title_en: "June 2025 ceasefire",
    title_fa: "آتش‌بس ژوئن ۱۴۰۴",
    lane: "middle_east_wars",
    category: "middle_east_wars",
    region: "middle_east",
    importance: 2,
    description_en: "Hostilities step down; stabilisation attempt.",
    description_fa: "کاهش اصلی درگیری و تلاش برای تثبیت.",
  },
  {
    kind: "point",
    id: "g-us-il-ir-strikes-2026-02",
    date: "2026-02-28",
    title_en: "U.S.–Israel strikes on Iran",
    title_fa: "حملات آمریکا-اسرائیل",
    lane: "middle_east_wars",
    category: "middle_east_wars",
    region: "middle_east",
    importance: 3,
    description_en: "U.S.–led allied operation; energy and security repricing.",
    description_fa: "عملیات متفقان تحت رهبری آمریکا؛ تجدید قیمت‌گذاری امنیت و انرژی.",
  },
];

import type { IranVerticalDynasty } from "./types";

/**
 * Core Iranian polities. Approximate conventional date ranges (rounded for display;
 * refine from primary historiography for production).
 */
export const IRAN_VERTICAL_DYNASTIES: readonly IranVerticalDynasty[] = [
  {
    id: "dy-achaemenid",
    start_year: -550,
    end_year: -330,
    title_en: "Achaemenid Empire",
    title_fa: "هخامنشیان",
    category: "dynasty",
    importance: 3,
    description_en:
      "First Persian royal line to rule a multi-ethnic empire from the Iranian plateau, ending with Alexander’s conquest of the core capitals.",
    description_fa:
      "نخستین پادشاهی ایرانی که شاهکشی گسترده و چندقومیتی را از فلات ایران سامان داد و با فتح پایتخت‌ها توسط سپاه اسکندر پایان یافت.",
  },
  {
    id: "dy-parthian",
    start_year: -247,
    end_year: 224,
    title_en: "Parthian (Arsacid) Iran",
    title_fa: "اشکانیان (پارتی)",
    category: "dynasty",
    importance: 3,
    description_en:
      "Eastern Iranian–led empire centred on the Iranian plateau, long rival to Rome, succeeded by the Sasanians.",
    description_fa:
      "امپراتوری با تکیه‌گاه شرقی-ایرانی و رقابت طولانی با رم؛ جایگزینش ساسانیان شدند.",
  },
  {
    id: "dy-sasanian",
    start_year: 224,
    end_year: 651,
    title_en: "Sasanian Empire",
    title_fa: "ساسانیان",
    category: "dynasty",
    importance: 3,
    description_en:
      "Zoroastrian-tinged high-imperial state; fall to the early Muslim conquests of the 7th century (display uses the conventional end around 651).",
    description_fa:
      "دولت بزرگ ساسانی با بافت مذهبی-ایرانی؛ سقوط در موج فتح‌های نخستین سدهٔ هفتم (پایان نمادین حوالی ۶۵۱).",
  },
  {
    id: "dy-safavid",
    start_year: 1501,
    end_year: 1736,
    title_en: "Safavid Iran",
    title_fa: "صفویه",
    category: "dynasty",
    importance: 3,
    description_en:
      "Re-establishment of a strong Iranian-centred monarchy, Twelver Shīʿa as state religion, and a major early-modern art and trade zone.",
    description_fa:
      "بازتأسیس پادشاهی قوی با مرکزیت ایران و تثبیت تشیع دوازده‌امامی در ساخت دولت و فرهنگ عصر جدید نخستین.",
  },
  {
    id: "dy-afsharid",
    start_year: 1736,
    end_year: 1750,
    title_en: "Afsharid",
    title_fa: "افشاریه",
    category: "dynasty",
    importance: 2,
    description_en:
      "Short but violent consolidation under Nader Shah; realm fragments soon after his death (end date rounded for display).",
    description_fa:
      "دورهٔ کوتاه اما پرشتاب در سیطرهٔ نادرشاه؛ پس از درگذشت، قلمرو به‌زودی پراکنده شد (تاریخ پایان گردشده).",
  },
  {
    id: "dy-zand",
    start_year: 1750,
    end_year: 1794,
    title_en: "Zand",
    title_fa: "زندیه",
    category: "dynasty",
    importance: 2,
    description_en:
      "Karim Khan’s rule from Shiraz; often treated as a recovery interval before the Qajars centralise power in Tehran.",
    description_fa:
      "دورهٔ کریم‌خان زند با تکیه‌گاه شیراز؛ فاصلهٔ بازآرایی تا تمرکز دوباره تحت قاجار.",
  },
  {
    id: "dy-qajar",
    start_year: 1794,
    end_year: 1925,
    title_en: "Qajar",
    title_fa: "قاجار",
    category: "dynasty",
    importance: 3,
    description_en:
      "Long 19th–early 20th century monarchy; constitutional revolution, oil concessions, and the First World War reshape the state.",
    description_fa:
      "پادشاهی پربسامد سدهٔ نوزدهم و آغاز بیستم؛ مشروطه، امتیازات نفتی و جنگ جهانی ساختار دولت را دگرگون کردند.",
  },
  {
    id: "dy-pahlavi",
    start_year: 1925,
    end_year: 1979,
    title_en: "Pahlavi",
    title_fa: "پهلوی",
    category: "dynasty",
    importance: 3,
    description_en:
      "Authoritarian modernisation, oil industry growth, 1953 crisis context, and mass revolution ending the monarchy in 1979.",
    description_fa:
      "مدرنیزاسیون متراکم، توسعهٔ نفت، بزنگاه ۱۳۳۲ و انقلاب ۱۳۵۷ که سلطنت را پایان داد.",
  },
  {
    id: "dy-islamic-republic",
    start_year: 1979,
    end_year: 2026,
    title_en: "Islamic Republic of Iran",
    title_fa: "جمهوری اسلامی ایران",
    category: "dynasty",
    importance: 3,
    description_en:
      "Republic after 1979, war with Iraq, sanctions cycles, and ongoing regional and energy politics (end year is a rolling display placeholder).",
    description_fa:
      "نظام جمهوری پس از ۱۳۵۷؛ جنگ، موج‌های تحریم و دیپلماسی و انرژی (پایان فقط مکان‌نمای نمایش است).",
  },
];

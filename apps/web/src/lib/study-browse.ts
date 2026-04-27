import { resolveStudyConcept } from "./signalmap-concepts";
import type { StudyConceptId } from "./signalmap-concepts";
import { IRAN_STUDY_FA_DISPLAY } from "./iran-study-fa-copy";
import { normalizeSearchText } from "./study-search-normalize";
import {
  getStudyById,
  STUDY_BROWSE_GROUP_TITLES,
  type StudyCountry,
  type StudyGroup,
  type StudyMeta,
  type StudyTheme,
} from "./studies";

export type BrowseProfile = {
  countries: StudyCountry[];
  themes: StudyTheme[];
  tags: string[];
  keywords: string[];
};

export const STUDY_COUNTRY_OPTIONS: { id: StudyCountry; label: string }[] = [
  { id: "iran", label: "Iran" },
  { id: "us", label: "US" },
  { id: "global", label: "Global" },
];

export const STUDY_THEME_OPTIONS: { id: StudyTheme; label: string }[] = [
  { id: "macro", label: "Macro" },
  { id: "oil", label: "Oil" },
  { id: "fx", label: "FX" },
  { id: "inequality", label: "Inequality" },
  { id: "social", label: "Social / platform" },
];

/** Localized browse labels (search & discovery). */
const COUNTRY_FA: Partial<Record<StudyCountry, string>> = {
  iran: "ایران",
  us: "ایالات متحده آمریکا",
  global: "جهانی",
};

const THEME_FA: Partial<Record<StudyTheme, string>> = {
  macro: "اقتصاد کلان",
  oil: "نفت",
  fx: "نرخ ارز",
  inequality: "نابرابری",
  social: "اجتماعی پلتفرم",
};

const STUDY_BROWSE_GROUP_TITLES_FA: Record<StudyGroup, { title: string; description: string }> = {
  core: {
    title: "سیگنال‌های اصلی",
    description: "نرخ ارز، نفت، نفت+ارز، تورم بین‌کشوری (CPI)",
  },
  iran: {
    title: "اقتصاد ایران",
    description: "حساب‌های ملی، نفت، صادرات، نرخ ارز و کار",
  },
  global: {
    title: "زمینهٔ جهانی",
    description: "مقیاس GDP، نفت بلندمدت، رویدادها، تولید و تجارت",
  },
  policy: {
    title: "ساختار و سیاست",
    description: "منبع در برابر بخش قابل‌تجارت و الگوهای واردات‌گریز (WDI)",
  },
  welfare: {
    title: "نابرابری و رفاه",
    // Omit the exact word for poverty as a single token in this shared blurb, so "فقر" search targets poverty studies and FA text.
    description: "نابرابری در درآمد، رفاه و توان خرید و قیمت‌ها",
  },
  discourse: {
    title: "گفتمان و مخاطب",
    description: "رشد پلتفرم و تحلیل نظرات یوتیوب",
  },
};

/** Signal-row tags. `study.tags` (when set) come first, then kind-derived tags (de-duplicated). */
export function getSignalTags(study: StudyMeta): string[] {
  const tags: string[] = [];
  const kind = study.primarySignal.kind;
  if (
    kind === "oil_brent" ||
    kind === "oil_and_fx" ||
    kind === "gold_and_oil" ||
    kind === "real_oil" ||
    kind === "oil_ppp_iran" ||
    kind === "oil_export_capacity" ||
    kind === "oil_production_major_exporters" ||
    kind === "oil_trade_network" ||
    kind === "oil_exporter_timeseries" ||
    kind === "oil_geopolitical_reaction" ||
    kind === "oil_economy_overview"
  ) {
    tags.push("Oil");
  }
  if (kind === "fx_usd_toman" || kind === "oil_and_fx" || kind === "fx_usd_irr_dual") {
    tags.push("FX");
  }
  if (kind === "gold_and_oil") tags.push("Gold");
  if (
    kind === "events_timeline" ||
    kind === "global_events_timeline" ||
    kind === "band_events_timeline" ||
    kind === "comparative_history_timeline" ||
    kind === "iran_dynasties_timeline"
  ) {
    tags.push("Reference");
  }
  if (kind === "gdp_composition" || kind === "iran_gdp_accounts_dual" || kind === "gdp_global_comparison") tags.push("GDP");
  if (kind === "oil_trade_network" || kind === "oil_exporter_timeseries") tags.push("Trade");
  return [...new Set([...(study.tags ?? []), ...tags])];
}

function sectionTitlesForStudy(studyId: string): string[] {
  const study = getStudyById(studyId);
  if (!study?.groupPlacements?.length) return [];
  const out: string[] = [];
  for (const p of study.groupPlacements) {
    const t = STUDY_BROWSE_GROUP_TITLES[p.group];
    const f = STUDY_BROWSE_GROUP_TITLES_FA[p.group];
    out.push(t.title, t.description, f.title, f.description);
  }
  return out;
}

function faDisplaySearchBits(study: StudyMeta): string[] {
  const fa = IRAN_STUDY_FA_DISPLAY[study.id];
  if (!fa) return [];
  const o: string[] = [];
  if (fa.title) o.push(fa.title);
  if (fa.subtitle) o.push(fa.subtitle);
  if (fa.description) o.push(fa.description);
  if (fa.unitLabel) o.push(fa.unitLabel);
  if (fa.observations) o.push(...fa.observations);
  if (fa.simpleTermsParagraphs) o.push(...fa.simpleTermsParagraphs);
  if (fa.fxDualCardTitle) o.push(fa.fxDualCardTitle);
  return o;
}

const OIL_KINDS: readonly string[] = [
  "oil_brent",
  "oil_global_long",
  "oil_and_fx",
  "real_oil",
  "oil_ppp_iran",
  "oil_export_capacity",
  "oil_production_major_exporters",
  "oil_trade_network",
  "oil_exporter_timeseries",
  "oil_geopolitical_reaction",
  "oil_economy_overview",
  "gold_and_oil",
];

/**
 * Bilingual and Persian-friendly aliases so EN queries match FA text and vice versa
 * (WDI, policy labels, and common class names on study detail pages).
 */
function subjectSearchAliasBits(study: StudyMeta): string[] {
  const k = study.primarySignal.kind;
  const concepts = new Set<StudyConceptId>((study.concepts ?? []) as StudyConceptId[]);
  const b: string[] = [];

  if (OIL_KINDS.includes(k)) {
    b.push("نفت", "نفت خام", "oil", "brent", "crude", "petroleum", "OPEC", "اُپک");
  }

  const cpiInConcepts =
    concepts.has("cpi") || concepts.has("real_wage") || concepts.has("real_oil_price");
  if (k === "inflation_cpi_yoy" || cpiInConcepts) {
    b.push("تورم", "inflation", "CPI", "consumer price", "تورم مصرف‌کننده", "تورم مصرف کننده");
  }

  if (k === "iran_money_supply_m2") {
    b.push("نقدینگی", "M2", "broad money", "money supply", "پول وسیع", "نقدینگی m2", "رشد نقدینگی", "liquidity");
  }

  if (k === "fx_usd_toman" || k === "oil_and_fx" || k === "fx_usd_irr_dual") {
    b.push("نرخ ارز", "نرخ آزاد", "نرخ رسمی", "تومان", "toman", "dollar", "forex", "دلار", "foreign exchange", "FX");
  }

  if (k === "gdp_composition" || k === "iran_gdp_accounts_dual" || k === "gdp_global_comparison") {
    b.push("تولید ناخالص داخلی", "GDP", "gross domestic product", "حساب‌های ملی", "national accounts", "WDI", "wdi");
  }

  if (k === "gini_inequality") {
    b.push("نابرابری", "gini", "inequality", "income distribution", "جینی", "ضریب جینی");
  }

  if (k === "poverty_headcount_iran") {
    b.push("فقر", "poverty", "poverty line", "خط فقر", "دستمزد", "welfare");
  }

  if (k === "dutch_disease_diagnostics_iran" || concepts.has("dutch_disease_pattern")) {
    b.push("بیماری هلندی", "Dutch disease", "resource curse", "اجاره نفت", "نفت");
  }

  if (k === "isi_diagnostics") {
    b.push(
      "جانشینی واردات",
      "import substitution",
      "ISI",
      "صنعتی‌سازی",
      "واردات",
      "صادرات",
      "تولید صنعتی",
      "manufacturing",
      "industry",
      "صنعت"
    );
  }

  if (k === "isi_diagnostics" || k === "oil_trade_network" || k === "oil_exporter_timeseries" || concepts.has("trade_networks")) {
    b.push("imports", "exports", "تجارت");
  }

  if (k === "wage_cpi_real") {
    b.push("تورم", "CPI", "wage", "دستمزد", "دست‌مزد");
  }

  if (study.themes?.includes("inequality")) {
    b.push("نابرابری", "inequality", "welfare", "رفاه");
  }

  if (k === "real_oil") {
    b.push("CPI", "inflation", "تورم");
  }

  if (k === "iran_dynasties_timeline") {
    b.push("Iran", "ایران", "ایرانی", "persian", "Farsi", "تاریخ", "تاریخی", "history", "dynasty", "dynasties", "دودمان", "BCE", "chronology");
  }

  if (k === "comparative_history_timeline") {
    b.push(
      "France",
      "فرانسه",
      "United Kingdom",
      "بریتانیا",
      "انگلستان",
      "United States",
      "ایالات متحده",
      "Renaissance",
      "رنسانس",
      "Enlightenment",
      "تنویر",
      "Industrial Revolution",
      "انقلاب صنعتی",
      "Cold War",
      "جنگ سرد",
      "world war",
      "comparative",
      "مقایسه",
      "تاریخ",
      "history"
    );
  }

  return [...new Set(b)];
}

function deriveBrowseDefaults(study: StudyMeta): BrowseProfile {
  const k = study.primarySignal.kind;
  const id = study.id;

  switch (k) {
    case "overview_stub":
      return {
        countries: ["global"],
        themes: ["macro", "social"],
        tags: [],
        keywords: ["sentiment", "hashtags", "overview", "sample"],
      };
    case "oil_brent":
      return {
        countries: ["iran", "global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["brent", "crude", "petroleum", "barrel", "opec", "commodity"],
      };
    case "oil_global_long":
      return {
        countries: ["global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["long run", "history", "oil price", "annual", "daily"],
      };
    case "gold_and_oil":
      return {
        countries: ["global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["gold", "conflict", "monetary", "1900", "shocks"],
      };
    case "fx_usd_toman":
      return {
        countries: ["iran"],
        themes: ["fx", "macro"],
        tags: [],
        keywords: ["toman", "rial", "exchange rate", "open market", "currency"],
      };
    case "oil_and_fx":
      return {
        countries: ["iran"],
        themes: ["oil", "fx", "macro"],
        tags: [],
        keywords: ["dual", "macroeconomic"],
      };
    case "real_oil":
      return {
        countries: ["global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["real price", "inflation adjusted", "cpi", "burden"],
      };
    case "oil_ppp_iran":
      return {
        countries: study.comparatorCountry === "Turkey" ? ["iran", "global"] : ["iran"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["ppp", "purchasing power", "turkey", "burden", "affordability"],
      };
    case "oil_export_capacity":
      return {
        countries: ["iran"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["sanctions", "exports", "volume", "capacity"],
      };
    case "oil_production_major_exporters":
      return {
        countries: ["global", "iran"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["saudi", "russia", "united states", "production", "mbd", "barrels per day"],
      };
    case "events_timeline":
      return {
        countries: ["global"],
        themes: ["macro"],
        tags: [],
        keywords: ["timeline", "history", "geopolitics", "reference"],
      };
    case "global_events_timeline":
      return {
        countries: ["global", "iran"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "timeline",
          "history",
          "chronology",
          "Bretton",
          "OPEC",
          "geopolitics",
          "zoom",
          "layers",
        ],
      };
    case "band_events_timeline":
      return {
        countries: ["global", "iran"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "bands",
          "swimlane",
          "eras",
          "periods",
          "timeline",
          "history",
          "geopolitics",
          "zoom",
          "layers",
        ],
      };
    case "iran_dynasties_timeline":
      return {
        countries: ["iran", "global"],
        themes: ["macro"],
        tags: [],
        keywords: ["iran", "history", "dynasty", "periods", "BCE", "chronology", "persia", "vertical", "reference"],
      };
    case "comparative_history_timeline":
      return {
        countries: ["global", "iran", "us"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "comparative",
          "France",
          "UK",
          "US",
          "Renaissance",
          "enlightenment",
          "industrial",
          "world war",
          "swimlane",
          "context",
        ],
      };
    case "follower_growth_dynamics":
      return {
        countries: ["global"],
        themes: ["social", "macro"],
        tags: [],
        keywords: ["twitter", "instagram", "youtube", "followers", "growth model", "logistic"],
      };
    case "fx_usd_irr_dual":
      return {
        countries: ["iran"],
        themes: ["fx", "macro"],
        tags: [],
        keywords: ["official rate", "spread", "multiple exchange rates", "irr"],
      };
    case "wage_cpi_real":
      return {
        countries: ["iran"],
        themes: ["macro"],
        tags: [],
        keywords: ["minimum wage", "labor", "cpi", "real wage", "inflation"],
      };
    case "oil_trade_network":
      return {
        countries: ["global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["network", "comtrade", "trade flows", "importers"],
      };
    case "oil_exporter_timeseries":
      return {
        countries: ["global", "iran"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["exports", "hs 2709", "comtrade"],
      };
    case "oil_geopolitical_reaction":
      return {
        countries: ["global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: ["brent", "tension", "short term", "daily"],
      };
    case "youtube_comment_analysis": {
      const persianOrIranFocus =
        id === "bbc_persian_discourse" ||
        id === "iran_international_discourse" ||
        id === "bplus-discourse";
      const countries: StudyCountry[] = persianOrIranFocus ? ["iran", "global"] : ["us", "global"];
      return {
        countries,
        themes: ["social"],
        tags: [],
        keywords: [
          "youtube",
          "comments",
          "nlp",
          "sentiment",
          "topics",
          "tf-idf",
          "pca",
          "umap",
          "discourse",
          "media",
        ],
      };
    }
    case "gdp_composition":
    case "iran_gdp_accounts_dual":
      return {
        countries: ["iran"],
        themes: ["macro"],
        tags: [],
        keywords: ["gdp", "national accounts", "consumption", "investment", "wdi", "world bank"],
      };
    case "gini_inequality":
      return {
        countries: ["iran", "us", "global"],
        themes: ["inequality", "macro"],
        tags: [],
        keywords: ["gini", "income distribution", "germany", "turkey", "china", "saudi arabia", "world bank", "survey"],
      };
    case "inflation_cpi_yoy":
      return {
        countries: ["iran", "us", "global"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "inflation",
          "cpi",
          "consumer prices",
          "yoy",
          "prices",
          "world bank",
          "germany",
          "turkey",
          "china",
          "saudi arabia",
        ],
      };
    case "gdp_global_comparison":
      return {
        countries: ["iran", "us", "global"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "gdp",
          "ny.gdp.mktp.kd",
          "ny.gdp.mktp.cd",
          "world bank",
          "wdi",
          "china",
          "turkey",
          "saudi arabia",
          "world aggregate",
          "indexed",
        ],
      };
    case "isi_diagnostics":
      return {
        countries: ["iran", "global"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "isi",
          "import substitution",
          "brazil",
          "argentina",
          "india",
          "turkey",
          "iran",
          "wdi",
          "imports",
          "exports",
          "manufacturing",
          "industry",
          "gdp growth",
        ],
      };
    case "poverty_headcount_iran":
      return {
        countries: ["iran"],
        themes: ["inequality", "macro"],
        tags: [],
        keywords: ["poverty", "headcount", "wdi", "world bank", "ppp", "international line"],
      };
    case "dutch_disease_diagnostics_iran":
      return {
        countries: ["iran"],
        themes: ["macro", "oil", "fx"],
        tags: [],
        keywords: [
          "dutch disease",
          "resource curse",
          "oil rents",
          "manufacturing",
          "imports",
          "wdi",
          "structural",
        ],
      };
    case "oil_economy_overview":
      return {
        countries: ["iran", "global"],
        themes: ["oil", "macro"],
        tags: [],
        keywords: [
          "brent",
          "production",
          "revenue",
          "iran",
          "crude",
          "barrels per day",
          "eia",
          "fred",
        ],
      };
    case "iran_money_supply_m2":
      return {
        countries: ["iran"],
        themes: ["macro"],
        tags: [],
        keywords: [
          "m2",
          "broad money",
          "fm.lbl.bmny.zg",
          "liquidity",
          "money supply",
          "wdi",
          "inflation",
          "fp.cpi.totl.zg",
        ],
      };
    default:
      return { countries: ["global"], themes: ["macro"], tags: [], keywords: [] };
  }
}

export function getBrowseProfile(study: StudyMeta): BrowseProfile {
  const d = deriveBrowseDefaults(study);
  return {
    countries: study.countries ?? d.countries,
    themes: study.themes ?? d.themes,
    tags: [...new Set([...(study.tags ?? []), ...d.tags])],
    keywords: [...new Set([...(study.keywords ?? []), ...d.keywords])],
  };
}

function conceptSearchBits(study: StudyMeta): string[] {
  const keys = study.concepts ?? [];
  const bits: string[] = [];
  for (const key of keys) {
    bits.push(key.replace(/_/g, " "));
    for (const fa of [false, true] as const) {
      const c = resolveStudyConcept(key, fa);
      if (c) {
        bits.push(c.title, c.short, c.example, ...c.tags);
      }
    }
  }
  return bits;
}

/** Normalized text used for client-side search. */
export function getStudySearchHaystack(study: StudyMeta): string {
  const p = getBrowseProfile(study);
  const signalTags = getSignalTags(study);
  const parts: string[] = [
    study.title,
    study.subtitle ?? "",
    study.description,
    ...(study.observations ?? []),
    study.unitLabel ?? "",
    study.id,
    String(study.number),
    study.status,
    ...p.countries,
    ...p.themes,
    ...p.tags,
    ...p.keywords,
    ...signalTags,
    ...conceptSearchBits(study),
    ...sectionTitlesForStudy(study.id),
    ...faDisplaySearchBits(study),
  ];
  for (const c of p.countries) {
    const cf = COUNTRY_FA[c];
    if (cf) parts.push(cf);
  }
  for (const t of p.themes) {
    const tf = THEME_FA[t];
    if (tf) parts.push(tf);
  }
  for (const opt of STUDY_COUNTRY_OPTIONS) {
    if (p.countries.includes(opt.id)) parts.push(opt.label);
  }
  for (const opt of STUDY_THEME_OPTIONS) {
    if (p.themes.includes(opt.id)) parts.push(opt.label);
  }
  parts.push(...subjectSearchAliasBits(study));
  return normalizeSearchText(parts.join(" "));
}

/** Every query word must appear somewhere in the haystack (AND). */
export function studyMatchesSearch(study: StudyMeta, query: string, haystack?: string): boolean {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  const h = normalizeSearchText(haystack ?? getStudySearchHaystack(study));
  const words = nq.split(/\s+/).filter(Boolean);
  return words.every((w) => h.includes(w));
}

export function studyMatchesCountryFilters(study: StudyMeta, active: Set<StudyCountry>): boolean {
  if (active.size === 0) return true;
  const p = getBrowseProfile(study);
  return p.countries.some((c) => active.has(c));
}

export function studyMatchesThemeFilters(study: StudyMeta, active: Set<StudyTheme>): boolean {
  if (active.size === 0) return true;
  const p = getBrowseProfile(study);
  return p.themes.some((t) => active.has(t));
}

export function studyMatchesBrowseFilters(
  study: StudyMeta,
  opts: {
    search: string;
    haystack?: string;
    countries: Set<StudyCountry>;
    themes: Set<StudyTheme>;
  }
): boolean {
  if (!studyMatchesSearch(study, opts.search, opts.haystack)) return false;
  if (!studyMatchesCountryFilters(study, opts.countries)) return false;
  if (!studyMatchesThemeFilters(study, opts.themes)) return false;
  return true;
}

export { normalizeSearchText } from "./study-search-normalize";

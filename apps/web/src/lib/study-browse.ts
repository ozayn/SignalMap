import { CONCEPTS, type ConceptKey } from "./concepts";
import { STUDY_SECTIONS, type StudyCountry, type StudyMeta, type StudyTheme } from "./studies";

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

/** Signal-row tags (aligned with former studies page). */
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
    kind === "oil_geopolitical_reaction"
  ) {
    tags.push("Oil");
  }
  if (kind === "fx_usd_toman" || kind === "oil_and_fx" || kind === "fx_usd_irr_dual") {
    tags.push("FX");
  }
  if (kind === "gold_and_oil") tags.push("Gold");
  if (kind === "events_timeline") tags.push("Events");
  if (kind === "follower_growth_dynamics") tags.push("Growth");
  if (kind === "youtube_comment_analysis") {
    tags.push("Discourse");
    if (study.youtubeLanguage !== "English") tags.push("Persian");
  }
  if (kind === "wage_cpi_real") tags.push("Wage");
  if (kind === "gdp_composition" || kind === "iran_gdp_accounts_dual" || kind === "gdp_global_comparison") tags.push("GDP");
  if (kind === "gini_inequality") tags.push("Inequality");
  if (kind === "inflation_cpi_yoy") tags.push("Inflation");
  if (kind === "poverty_headcount_iran") tags.push("Poverty");
  if (kind === "dutch_disease_diagnostics_iran") tags.push("Macro", "Oil", "FX");
  if (kind === "oil_trade_network" || kind === "oil_exporter_timeseries") tags.push("Trade");
  if (study.eventLayers && study.eventLayers.length > 0 && !tags.includes("Events")) {
    tags.push("Events");
  }
  return [...new Set(tags)];
}

function sectionTitlesForStudy(studyId: string): string[] {
  const out: string[] = [];
  for (const sec of STUDY_SECTIONS) {
    if (sec.studyIds.includes(studyId)) out.push(sec.title, sec.description);
  }
  return out;
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
  const keys = (study.concepts ?? []) as ConceptKey[];
  const bits: string[] = [];
  for (const key of keys) {
    bits.push(key.replace(/_/g, " "));
    const c = CONCEPTS[key];
    if (c) {
      bits.push(c.title);
      bits.push(c.description);
    }
  }
  return bits;
}

/** Normalized text used for client-side search. */
export function getStudySearchHaystack(study: StudyMeta): string {
  const p = getBrowseProfile(study);
  const signalTags = getSignalTags(study);
  const parts = [
    study.title,
    study.subtitle ?? "",
    study.description,
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
  ];
  return parts.join(" ").toLowerCase();
}

/** Every query word must appear somewhere in the haystack (AND). */
export function studyMatchesSearch(study: StudyMeta, query: string, haystack?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const h = haystack ?? getStudySearchHaystack(study);
  const words = q.split(/\s+/).filter(Boolean);
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

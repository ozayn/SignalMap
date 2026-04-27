export type PrimarySignal =
  | { kind: "overview_stub" }
  | { kind: "oil_brent" }
  | { kind: "oil_global_long" }
  | { kind: "gold_and_oil" }
  | { kind: "fx_usd_toman" }
  | { kind: "oil_and_fx" }
  | { kind: "real_oil" }
  | { kind: "oil_ppp_iran" }
  | { kind: "oil_export_capacity" }
  | { kind: "oil_production_major_exporters" }
  | { kind: "events_timeline" }
  | { kind: "follower_growth_dynamics" }
  | { kind: "fx_usd_irr_dual" }
  | { kind: "wage_cpi_real" }
  | { kind: "oil_trade_network" }
  | { kind: "oil_exporter_timeseries" }
  | { kind: "oil_geopolitical_reaction" }
  | { kind: "youtube_comment_analysis" }
  | { kind: "gdp_composition" }
  | { kind: "iran_gdp_accounts_dual" }
  | { kind: "gini_inequality" }
  | { kind: "inflation_cpi_yoy" }
  | { kind: "gdp_global_comparison" }
  | { kind: "isi_diagnostics" }
  | { kind: "poverty_headcount_iran" }
  | { kind: "dutch_disease_diagnostics_iran" }
  | { kind: "iran_money_supply_m2" }
  | { kind: "oil_economy_overview" };

import type { ConceptKey } from "./concepts";

/** Browse / filter: geographic emphasis (a study may span several). */
export type StudyCountry = "iran" | "us" | "global";

/** Browse / filter: coarse theme. */
export type StudyTheme = "macro" | "oil" | "fx" | "inequality" | "social";

export type StudyGroup = "core" | "iran" | "global" | "policy" | "welfare" | "discourse";

export type StudyGroupPlacement = { group: StudyGroup; order: number };

/** YouTube discourse: videos and comments per video. Set here; all discourse studies use these. */
export const YOUTUBE_DISCOURSE_VIDEOS_LIMIT = 10;
export const YOUTUBE_DISCOURSE_COMMENTS_PER_VIDEO = 50;

export type StudyMeta = {
  id: string;
  number: number;
  title: string;
  /** Optional short subtitle (e.g. "Inflation-adjusted minimum wage (CPI)"). */
  subtitle?: string;
  timeRange: [string, string];
  description: string;
  status: string;
  primarySignal: PrimarySignal;
  eventLayers?: string[];
  /** When false, study is hidden from list and not directly accessible. Default: true. */
  visible?: boolean;
  /**
   * When true, study is omitted from browse and `/studies/[id]` in production builds (`NODE_ENV === "production"`).
   * Local `next dev` still lists and opens it. Use for work-in-progress or staging-only studies.
   */
  hiddenInProduction?: boolean;
  /** Concepts used in this study for educational display. */
  concepts?: ConceptKey[];
  /** When set, show Turkey as a comparator (always-on for Study 8). */
  comparatorCountry?: "Turkey";
  /** Observational bullets for "What this chart shows (in this dataset)". 3–6 short bullets, no causality. */
  observations?: string[];
  /** Unit label for stat cards; shown once above cards when all share the same unit. */
  unitLabel?: string;
  /** YouTube discourse: channel ID (default: bplus). */
  youtubeChannelId?: string;
  /** YouTube discourse: language for display and text direction ("English" | "Persian"). Overrides API when set. */
  youtubeLanguage?: "English" | "Persian";
  /** GDP composition (Iran): show local view toggles (levels currency, calendar). */
  gdpCompositionIranLocalOptions?: boolean;
  /** Browse: country tags (search + filter). When omitted, derived from `primarySignal` in `study-browse`. */
  countries?: StudyCountry[];
  /** Browse: theme tags (search + filter). When omitted, derived from `primarySignal`. */
  themes?: StudyTheme[];
  /** Browse: extra labels for search and optional display. */
  tags?: string[];
  /** Browse: extra searchable tokens (not shown unless also in `tags`). */
  keywords?: string[];
  /**
   * `/studies` grouped layout: one or more `{ group, order }` rows. Same study can appear in two sections
   * (e.g. inflation: core + welfare) by listing two placements. Omit or leave empty to hide from grouped view.
   */
  groupPlacements?: StudyGroupPlacement[];
};

export const STUDIES: StudyMeta[] = [
  {
    id: "1",
    number: 1,
    title: "SignalMap Overview",
    timeRange: ["2024-01-01", "2024-08-31"],
    description:
      "Longitudinal exploration of sentiment, interaction volume, and hashtag coverage across a defined time window.",
    status: "active",
    primarySignal: { kind: "overview_stub" },
    visible: false,
  },
  {
    id: "iran",
    number: 2,
    title: "Brent oil price as an exogenous context signal",
    timeRange: ["2021-01-15", new Date().toISOString().slice(0, 10)],
    description: "Brent crude in USD: event-anchored windows, optional context markers.",
    status: "active",
    groupPlacements: [{ group: "core", order: 2 }],
    primarySignal: { kind: "oil_brent" },
    concepts: ["nominal_price", "oil_benchmark", "event_overlay", "oil_price_shocks"],
    unitLabel: "USD per barrel",
  },
  {
    id: "usd-toman",
    number: 3,
    title: "USD→Toman (Open Market) — Socio-economic Signal",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "Open-market toman per US dollar as a lived-economy pressure indicator (Bonbast / rial archive from 2012; FRED PWT annual pre-archive). Official WDI annual shown dashed for comparison. For official vs open and spread, see the dual-rate study.",
    status: "active",
    groupPlacements: [{ group: "core", order: 1 }],
    primarySignal: { kind: "fx_usd_toman" },
    concepts: ["fx_rate", "event_overlay"],
    unitLabel: "toman per USD",
  },
  {
    id: "oil-and-fx",
    number: 4,
    title: "Oil and USD/toman: dual macroeconomic signals",
    timeRange: ["2021-01-15", new Date().toISOString().slice(0, 10)],
    description: "Brent and open-market USD/toman on two y-axes: oil vs. currency pressure together.",
    status: "active",
    groupPlacements: [{ group: "core", order: 3 }],
    primarySignal: { kind: "oil_and_fx" },
    concepts: ["nominal_price", "oil_benchmark", "fx_rate", "event_overlay"],
  },
  {
    id: "global_oil_1900",
    number: 5,
    title: "Global conflict and economic shocks (1900–present)",
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description: "1900+ gold and oil with a long event layer: big-picture global context.",
    status: "active",
    groupPlacements: [{ group: "global", order: 2 }],
    primarySignal: { kind: "gold_and_oil" },
    eventLayers: ["world_1900"],
    concepts: ["nominal_price", "oil_benchmark", "gold_price", "event_overlay"],
  },
  {
    id: "real_oil_price",
    number: 6,
    title: "Real oil prices and global economic burden",
    timeRange: ["1987-05-20", new Date().toISOString().slice(0, 10)],
    description: "Nominal Brent deflated with US CPI: real oil price and burden, not the spot headline.",
    status: "active",
    groupPlacements: [{ group: "global", order: 6 }],
    primarySignal: { kind: "real_oil" },
    eventLayers: ["world_core", "world_1900"],
    concepts: ["real_price", "cpi", "real_oil_price", "derived_series", "event_overlay"],
    unitLabel: "constant 2015 USD per barrel",
  },
  {
    id: "iran_oil_ppp",
    number: 7,
    title: "Oil price burden in Iran (PPP-based)",
    timeRange: ["1990-01-01", new Date().toISOString().slice(0, 10)],
    description: "Oil in Iran as PPP toman per barrel: domestic purchasing-power burden, not the FX screen rate.",
    status: "active",
    groupPlacements: [{ group: "iran", order: 7 }],
    primarySignal: { kind: "oil_ppp_iran" },
    eventLayers: ["iran_core", "world_core"],
    concepts: ["ppp", "ppp_oil_burden", "log_scale", "structural_break", "derived_series", "event_overlay"],
    unitLabel: "PPP-adjusted toman per barrel",
  },
  {
    id: "iran_oil_ppp_turkey",
    number: 8,
    title: "Iran and Turkey: comparative PPP oil burden",
    timeRange: ["1990-01-01", new Date().toISOString().slice(0, 10)],
    description: "Same PPP oil-burden methodology for Iran and Turkey: side-by-side comparison.",
    status: "active",
    groupPlacements: [{ group: "iran", order: 8 }],
    primarySignal: { kind: "oil_ppp_iran" },
    eventLayers: [],
    concepts: ["ppp", "ppp_oil_burden", "log_scale", "structural_break", "derived_series"],
    comparatorCountry: "Turkey",
    unitLabel: "PPP-adjusted toman per barrel",
  },
  {
    id: "iran_oil_export_capacity",
    number: 9,
    title: "Iran oil export capacity: price and volume",
    timeRange: ["2010-01-01", "2024-12-31"],
    description: "Brent vs. an estimated export-capacity index: price and tradable volume in one view (proxy, not revenue).",
    status: "active",
    groupPlacements: [{ group: "iran", order: 4 }],
    primarySignal: { kind: "oil_export_capacity" },
    eventLayers: ["sanctions"],
    concepts: ["oil_benchmark", "price_vs_quantity", "oil_export_volume", "indexing", "export_capacity_proxy", "derived_series", "event_overlay"],
    observations: [
      "Over the period shown, oil price and the export capacity proxy often move in the same direction but not in lockstep.",
      "The proxy series appears to fall in some years when volume declines, even when price rises.",
      "The gap between price and proxy widens when estimated export volume is relatively low.",
      "In this dataset, the proxy remains below its early-period peak in several later years.",
    ],
  },
  {
    id: "oil_major_exporters",
    number: 14,
    title: "Major oil exporters: production levels",
    timeRange: ["1960-01-01", "today"],
    description: "US, Saudi Arabia, Russia, Iran: annual crude (mb/d). Iran backfilled 1965+ from EI/EIA when the live line has gaps.",
    status: "active",
    groupPlacements: [{ group: "global", order: 4 }],
    primarySignal: { kind: "oil_production_major_exporters" },
    eventLayers: ["iran_core", "sanctions", "opec_decisions"],
    concepts: ["oil_production", "oil_production_vs_exports", "barrels_per_day", "supply_shocks"],
  },
  {
    id: "follower_growth_dynamics",
    number: 10,
    title: "Follower growth dynamics over time",
    timeRange: ["2010-01-01", new Date().toISOString().slice(0, 10)],
    description: "Follower count over time with optional linear, exponential, and logistic fits (exploratory).",
    status: "active",
    tags: ["Platform", "Growth fit"],
    groupPlacements: [{ group: "discourse", order: 1 }],
    primarySignal: { kind: "follower_growth_dynamics" },
    hiddenInProduction: true,
    concepts: ["linear_vs_exponential_growth", "logistic_growth_saturation", "model_fitting_intuition", "overfitting_simple"],
    observations: [
      "In this dataset, the raw follower count rises over the period shown.",
      "Growth appears to slow toward the end of the series in many cases.",
      "The fitted curves diverge from each other in the later part of the chart; which sits closest to the points depends on the loaded data.",
      "The line connecting points often shows irregular steps; spacing between points varies over the period.",
    ],
  },
  {
    id: "events_timeline",
    number: 11,
    title: "Historical events timeline (1900–present)",
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description: "A scrollable 1900+ event list: reference context for other charts (not a price series).",
    status: "active",
    groupPlacements: [{ group: "global", order: 5 }],
    primarySignal: { kind: "events_timeline" },
    hiddenInProduction: true,
    concepts: ["event_overlay"],
  },
  {
    id: "iran_fx_spread",
    number: 12,
    title: "Dual Exchange Rates in Iran — Official vs Open Market",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "Regime / distortion view: WDI official toman/USD vs. open market on the same merged history as the open-market study (FRED + rial archive + Bonbast). Yearly spread (%) only where a calendar year has both official and open data.",
    status: "active",
    tags: ["Dual", "Spread"],
    groupPlacements: [{ group: "iran", order: 5 }],
    primarySignal: { kind: "fx_usd_irr_dual" },
    concepts: ["multiple_exchange_rates", "official_exchange_rate", "fx_rate", "capital_controls", "price_controls", "measurement_vs_reality", "fx_spread", "derived_series"],
  },
  {
    id: "oil_geopolitical_reaction",
    number: 16,
    title: "Oil market reaction to geopolitical tensions",
    timeRange: [
      new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
    ],
    description: "Last ~90 days of Brent: short-horizon moves with optional shock and policy markers.",
    status: "active",
    groupPlacements: [{ group: "global", order: 3 }],
    primarySignal: { kind: "oil_geopolitical_reaction" },
    eventLayers: ["world_core", "world_1900", "sanctions", "opec_decisions"],
    concepts: ["nominal_price", "oil_benchmark", "event_overlay", "oil_price_shocks"],
    unitLabel: "USD per barrel",
  },
  {
    id: "oil_trade_network",
    number: 15,
    title: "Oil trade network",
    timeRange: ["2010", String(new Date().getFullYear())],
    description: "Who ships crude to whom: Comtrade network (kb/d) by year, Sankey or node–link view.",
    status: "active",
    groupPlacements: [{ group: "global", order: 7 }],
    primarySignal: { kind: "oil_trade_network" },
    concepts: ["trade_networks", "energy_geopolitics", "export_dependencies"],
  },
  {
    id: "oil_exporter_timeseries",
    number: 17,
    title: "Major crude oil exporters: trade flows",
    timeRange: ["2000", "today"],
    description: "Annual crude exports (kb/d) for four majors from HS 2709 Comtrade, mirror-flow derived.",
    status: "active",
    groupPlacements: [{ group: "global", order: 8 }],
    primarySignal: { kind: "oil_exporter_timeseries" },
    concepts: ["trade_networks", "energy_geopolitics", "export_dependencies"],
    unitLabel: "thousand barrels/day",
  },
  {
    id: "bplus-discourse",
    number: 18,
    title: "Bplus YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Comment text on Bplus videos: topic clusters and tone (NLP, exploratory).",
    status: "active",
    tags: ["Bplus", "Comments"],
    groupPlacements: [{ group: "discourse", order: 2 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "breaking_points_discourse",
    number: 19,
    title: "Breaking Points YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Breaking Points: comment topics and tone on sampled videos (NLP).",
    status: "active",
    tags: ["Breaking Points", "Comments"],
    groupPlacements: [{ group: "discourse", order: 3 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCDRIjKy6eZOvKtOELtTdeUA",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "tucker_carlson_discourse",
    number: 20,
    title: "Tucker Carlson YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Tucker Carlson channel: sample-video comments, topics and tone (NLP).",
    status: "active",
    tags: ["Tucker C.", "Comments"],
    groupPlacements: [{ group: "discourse", order: 4 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCGttrUON87gWfU6dMWm1fcA",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "cnn_discourse",
    number: 21,
    title: "CNN YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "CNN: comment topics and tone on a sample of videos (NLP).",
    status: "active",
    tags: ["CNN", "Comments"],
    groupPlacements: [{ group: "discourse", order: 5 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCupvZG-5ko_eiXAupbDfxWw",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "fox_news_discourse",
    number: 22,
    title: "Fox News YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Fox News: comment topics and tone on a sample of videos (NLP).",
    status: "active",
    tags: ["Fox", "Comments"],
    groupPlacements: [{ group: "discourse", order: 6 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCXIJgqnII2ZOINSWNOGFThA",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "bbc_discourse",
    number: 23,
    title: "BBC News YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "BBC News (English): comment topics and tone on a sample of videos (NLP).",
    status: "active",
    tags: ["BBC", "Comments"],
    groupPlacements: [{ group: "discourse", order: 7 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UC16niRr50-MSBwiO3YDb3RA",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "rest_is_politics_discourse",
    number: 26,
    title: "The Rest Is Politics YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "The Rest Is Politics: comment topics and tone on a sample of videos (NLP).",
    status: "active",
    tags: ["TRIP", "Comments"],
    groupPlacements: [{ group: "discourse", order: 8 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCsufaClk5if2RGqABb-09Uw",
    youtubeLanguage: "English",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "bbc_persian_discourse",
    number: 24,
    title: "BBC Persian YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "BBC Persian: Farsi comment topics and tone (NLP).",
    status: "active",
    tags: ["BBC Farsi", "Comments", "FA"],
    groupPlacements: [{ group: "discourse", order: 9 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCHZk9MrT3DGWmVqdsj5y0EA",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "iran_international_discourse",
    number: 25,
    title: "Iran International YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Iran International: Farsi/English mix in comments, topics and tone (NLP).",
    status: "active",
    tags: ["Iran Int'l", "Comments", "FA"],
    groupPlacements: [{ group: "discourse", order: 10 }],
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCat6bC0Wrqq9Bcq7EkH_yQw",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "iran_real_wage_cpi",
    number: 13,
    title: "Real Minimum Wage in Iran",
    subtitle: "Inflation-adjusted minimum wage (CPI)",
    timeRange: ["2010-01-01", new Date().toISOString().slice(0, 10)],
    description: "Nominal vs. CPI-deflated minimum wage: purchasing power of the wage, not a full labor market model.",
    status: "active",
    tags: ["Wage", "CPI", "Real"],
    groupPlacements: [{ group: "iran", order: 6 }],
    primarySignal: { kind: "wage_cpi_real" },
    hiddenInProduction: true,
    concepts: ["real_price", "cpi", "purchasing_power", "nominal_minimum_wage", "real_wage", "measurement_vs_reality", "derived_series"],
    observations: [
      "Nominal minimum wage rises sharply in later years over the period shown.",
      "Real minimum wage is flat or declining for much of the period in this dataset.",
      "The gap between nominal and real widens in high-inflation years.",
      "Real purchasing power appears to recover only partially toward the end of the series.",
    ],
  },
  {
    id: "iran-gdp-composition",
    number: 27,
    title: "GDP composition — Iran",
    gdpCompositionIranLocalOptions: true,
    subtitle: "Consumption and investment as shares of GDP (World Bank)",
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description: "Consumption and investment as GDP shares, plus level views (WDI; Iran; optional SHJ labels in levels).",
    status: "active",
    groupPlacements: [{ group: "iran", order: 1 }],
    primarySignal: { kind: "gdp_composition" },
    hiddenInProduction: true,
    eventLayers: ["iran_core"],
    concepts: ["gdp_aggregate", "final_consumption_share", "gross_capital_formation", "event_overlay"],
    observations: [
      "Consumption and investment shares are both expressed as percent of GDP, so they are comparable on the same vertical scale.",
      "The two shares do not sum to 100%: GDP also includes net exports, government investment nuances, and statistical discrepancies in national accounts.",
      "Nominal GDP (current US$) appears in a separate companion chart (log scale) so the dollar size of the economy is visible without compressing the % series.",
      "The level chart shows consumption, GDP, and investment in the same price basis (constant 2015 US$ when WDI has all three KD series; otherwise current US$).",
      "Levels value type: Real (WDI constant 2015 US$ *KD), USD (current US$ *CD), or Toman (current US$ × per-year mean open-market toman/USD, IRN only, approximate). Composition vs Levels views; Iranian (Solar Hijri) year labels on Levels are display-only.",
      "The series start in different years in WDI; the app uses the earliest year any bundled indicator has data through the latest available year.",
      "World Bank data are annual; revisions and methodology can shift recent years slightly.",
    ],
  },
  {
    id: "iran-gdp-accounts-dual",
    number: 28,
    title: "Iran national accounts — dual-axis reference",
    subtitle: "Consumption and investment (left) vs GDP (right)",
    gdpCompositionIranLocalOptions: true,
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description: "Academic-style dual axis: C and I (left) vs. GDP (right). Scales are not directly comparable—pattern view only.",
    status: "active",
    groupPlacements: [{ group: "iran", order: 2 }],
    primarySignal: { kind: "iran_gdp_accounts_dual" },
    eventLayers: ["iran_core"],
    concepts: ["gdp_aggregate", "final_consumption_share", "gross_capital_formation", "event_overlay"],
    observations: [
      "Left axis: consumption and investment (two separate series). Right axis: GDP. Each axis has its own scale.",
      "Lines use the same WDI indicators and value-type bundle as Study 27 levels (NE.CON.*, NY.GDP.MKTP.*, NE.GDI.TOTL.*).",
      "Because the vertical scales differ, you cannot read a gap between a left-axis line and the GDP line as a fixed economic magnitude.",
      "Annual data; missing FX years omit Toman points when that value type is selected.",
    ],
  },
  {
    id: "gini-inequality",
    number: 29,
    title: "Income inequality: Gini coefficient",
    subtitle: "World Bank annual estimates (Iran, United States, and comparators)",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "Gini (SI.POV.GINI) over time: Iran, US, DE, TR, CN, SA—descriptive; survey methods still differ by country.",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["inequality", "macro"],
    tags: ["Gini", "WDI", "6 countries"],
    keywords: ["si.pov.gini", "survey", "household income"],
    primarySignal: { kind: "gini_inequality" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    groupPlacements: [{ group: "welfare", order: 1 }],
    concepts: ["event_overlay", "measurement_vs_reality"],
    unitLabel: "Gini coefficient (0–100)",
    observations: [
      "Gini is observed at irregular intervals in the World Bank series; lines connect available survey-based estimates.",
      "Cross-country levels are not directly comparable without attention to survey design and coverage.",
      "Higher Gini means more inequality in this dataset’s definition (income distribution).",
    ],
  },
  {
    id: "inflation-rate",
    number: 30,
    title: "Annual inflation rate",
    subtitle: "Inflation (CPI, % YoY) — Iran, United States, Germany, Turkey, China, and Saudi Arabia",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "CPI inflation % YoY (WDI): same six economies; baskets and shocks still differ by country.",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["macro"],
    tags: ["CPI", "YoY", "6 countries"],
    keywords: ["fp.cpi.totl.zg", "prices"],
    groupPlacements: [
      { group: "core", order: 4 },
      { group: "welfare", order: 3 },
    ],
    primarySignal: { kind: "inflation_cpi_yoy" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    concepts: ["cpi", "event_overlay", "measurement_vs_reality"],
    unitLabel: "Annual % change (CPI)",
    observations: [
      "Annual frequency: one observation per calendar year where the World Bank publishes FP.CPI.TOTL.ZG.",
      "Positive values mean prices rose on average versus the prior year; negative values mean they fell.",
      "Cross-country comparison is descriptive; CPI baskets and methods differ.",
    ],
  },
  {
    id: "poverty-rate",
    number: 31,
    title: "Poverty headcount ratio",
    subtitle: "Iran — share of population below international poverty lines (World Bank WDI)",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "Two WDI headcount lines for Iran (day / LMIC thresholds). Dollar lines follow World Bank definitions and revisions.",
    status: "active",
    countries: ["iran"],
    themes: ["inequality", "macro"],
    tags: ["Poverty", "WDI", "Iran"],
    keywords: ["si.pov.dday", "si.pov.lmic", "international poverty line", "ppp"],
    groupPlacements: [{ group: "welfare", order: 2 }],
    primarySignal: { kind: "poverty_headcount_iran" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    concepts: ["event_overlay", "measurement_vs_reality"],
    unitLabel: "% of population",
    observations: [
      "Annual data where the World Bank publishes estimates; years without values appear as gaps.",
      "Two lines use different international thresholds; the higher threshold line is not a sum of the lower.",
      "International lines differ from national poverty statistics and survey timing.",
    ],
  },
  {
    id: "dutch-disease-diagnostics",
    number: 32,
    title: "Dutch disease diagnostics — Iran (pattern view)",
    subtitle: "Oil rents, manufacturing share, imports, and open-market FX (exploratory)",
    timeRange: ["1970-01-01", new Date().toISOString().slice(0, 10)],
    description: "Oil rents, manufacturing and import shares (WDI) plus open FX: pattern view for a resource–tradables story, not a single index.",
    status: "active",
    countries: ["iran"],
    themes: ["macro", "oil", "fx"],
    tags: ["Dutch", "Rents", "WDI"],
    groupPlacements: [{ group: "policy", order: 1 }],
    keywords: [
      "NY.GDP.PETR.RT.ZS",
      "NV.IND.MANF.ZS",
      "NE.IMP.GNFS.ZS",
      "manufacturing",
      "oil rents",
      "imports",
      "toman",
    ],
    primarySignal: { kind: "dutch_disease_diagnostics_iran" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    concepts: [
      "gdp_aggregate",
      "fx_rate",
      "export_dependencies",
      "measurement_vs_reality",
      "event_overlay",
      "dutch_disease_pattern",
    ],
    observations: [
      "Oil rents, manufacturing’s GDP share, and imports share are separate WDI series; co-movement is descriptive, not proof of a mechanism.",
      "Manufacturing value added is one tradable-sector proxy; services and agriculture are not shown here.",
      "Open-market FX is daily/irregular where available; WDI panels are annual—compare broad timing, not day-to-day alignment.",
      "Event markers are optional context and default off; they do not explain structural statistics by themselves.",
    ],
  },
  {
    id: "global-gdp-comparison",
    number: 33,
    title: "Global GDP comparison",
    subtitle: "United States, China, Iran, Turkey, Saudi Arabia, and world total (World Bank WDI)",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "Total GDP (WDI): levels or index to 2000=100. US, China, IR, TR, SA + world—relative growth, not a ranking of size in index view.",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["macro"],
    tags: ["GDP", "Index", "WDI"],
    keywords: ["ny.gdp.mktp.kd", "ny.gdp.mktp.cd", "aggregate", "china", "turkey", "saudi arabia", "world"],
    groupPlacements: [{ group: "global", order: 1 }],
    primarySignal: { kind: "gdp_global_comparison" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    concepts: ["gdp_aggregate", "measurement_vs_reality", "indexing", "event_overlay"],
    unitLabel: "Indexed (2000 = 100) or US$ levels",
    observations: [
      "Each economy uses WDI total GDP; the app prefers constant 2015 US$ and falls back to current US$ only when the constant-price series is empty for that country.",
      "Indexed view rescales each country independently (100 × value ÷ value in the base year); lines are comparable for relative growth, not for ranking absolute dollar totals.",
      "The world aggregate (WLD) is a World Bank series; it is not a simple sum of the five countries shown.",
      "Annual data; revisions can shift recent levels slightly.",
    ],
  },
  {
    id: "isi-diagnostics",
    number: 34,
    title: "ISI diagnostics — trade and industry structure",
    subtitle: "Brazil, Argentina, India, Turkey, and Iran (World Bank WDI)",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "Trade and industry as % of GDP, plus real GDP growth: BR, AR, IN, TR, IR. Indexed overview + raw panels—broad ISI-relevant patterns.",
    status: "active",
    countries: ["iran", "global"],
    themes: ["macro"],
    tags: ["ISI", "5 countries", "WDI"],
    groupPlacements: [{ group: "policy", order: 2 }],
    keywords: [
      "isi",
      "import substitution",
      "ne.imp.gnfs.zs",
      "ne.exp.gnfs.zs",
      "nv.ind.manf.zs",
      "nv.ind.totl.zs",
      "ny.gdp.mktp.kd.zg",
      "manufacturing",
      "industry",
      "trade",
    ],
    primarySignal: { kind: "isi_diagnostics" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    concepts: ["trade_networks", "gdp_aggregate", "measurement_vs_reality", "indexing"],
    unitLabel: "% of GDP or % growth (see panels)",
    observations: [
      "Each panel uses World Bank WDI annual series; coverage and revisions differ by country and year.",
      "The indexed overview normalizes each chosen structure series independently (100 × value ÷ value in the base year); it shows co-movement of shares, not levels comparable across different units of meaning.",
      "Manufacturing value added is a subset of total industry value added in national accounts; both are shown as shares of GDP.",
      "GDP growth (NY.GDP.MKTP.KD.ZG) is the annual percentage change of real GDP at constant national prices; it is not indexed in the outcomes chart.",
    ],
  },
  {
    id: "oil-economy-overview",
    number: 35,
    title: "Oil economy overview — Iran",
    subtitle: "Production, benchmark price, and estimated revenue",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description: "Annual Iran production, benchmark price, and a simple prod×price line—how volume and market price line up, not state fiscal receipts.",
    status: "active",
    groupPlacements: [{ group: "iran", order: 3 }],
    primarySignal: { kind: "oil_economy_overview" },
    countries: ["iran", "global"],
    themes: ["oil", "macro"],
    tags: ["Iran", "Volume × price"],
    concepts: ["nominal_price", "oil_benchmark", "price_vs_quantity", "derived_series"],
    observations: [
      "Revenue is annual barrels × annual average price (EIA global proxy 1980–86; FRED DCOILBRENTEU 1987+). Not government receipts or net export value.",
      "1965–1999 production: embedded Energy Institute (1965–79) and EIA/BP-compatible annuals (1980–99) when the live EIA/IMF pipeline has no value for that year; 2000+ from the same pipeline as other oil production studies. Primary (EIA/IMF) wins when both exist.",
      "When prices rise with flat production, the revenue line tends to rise; when production falls, revenue can fall even if price is high.",
    ],
  },
  {
    id: "iran-money-supply-growth",
    number: 36,
    title: "Money Supply Growth (M2) — Iran",
    subtitle: "Broad money growth and CPI inflation (WDI/IFS through 2016; 2017+ = CBI-style liquidity YoY, annual %)",
    timeRange: ["1960-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "Annual broad money (M2): World Bank WDI FM.LBL.BMNY.ZG through 2016 (IMF IFS in WDI’s chain), then year-on-year % derived in SignalMap from CBI-style broad-liquidity (نقدینگی) year-end levels (continuity estimate). Optional Iran CPI inflation (WDI) on the same calendar year for comparison—liquidity, prices, and macro stress in long perspective.",
    status: "active",
    groupPlacements: [{ group: "iran", order: 4 }],
    primarySignal: { kind: "iran_money_supply_m2" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
    countries: ["iran"],
    themes: ["macro"],
    tags: ["Iran", "M2", "WDI", "liquidity", "CPI"],
    concepts: ["cpi", "event_overlay", "measurement_vs_reality"],
    unitLabel: "Growth or inflation (annual %)",
    observations: [
      "M2: WDI FM.LBL.BMNY.ZG / IFS through 2016; 2017+ = SignalMap-derived YoY on CBI-style year-end broad liquidity (static file). Definitions may differ; treat 2017+ as continuity, not a strict redefinition of WDI M2.",
      "CPI: WDI FP.CPI.TOTL.ZG (Iran) on the same calendar year; may extend past WDI M2; compare only overlapping years for strict timing claims.",
      "Rapid liquidity growth can add to inflation and FX pressure, but the mapping is not mechanical or instant; WDI vs CBI-liquidity YoY can differ by a few points in overlap years (calendar vs year-end).",
    ],
  },
];

/** Fixed section order for `/studies` grouped view. */
export const STUDY_BROWSE_GROUP_ORDER: readonly StudyGroup[] = [
  "core",
  "iran",
  "global",
  "policy",
  "welfare",
  "discourse",
] as const;

export const STUDY_BROWSE_GROUP_TITLES: Record<StudyGroup, { title: string; description: string }> = {
  core: {
    title: "Core Signals",
    description: "FX, spot oil, oil+FX, and cross-country inflation (CPI).",
  },
  iran: {
    title: "Iran Economy",
    description: "National accounts, oil, exports, FX, and labor in the Iran view.",
  },
  global: {
    title: "Global Context",
    description: "GDP scale, long-run oil, events, production, and trade.",
  },
  policy: {
    title: "Structural & Policy",
    description: "Resource–tradable and import-substitution–style structure (WDI).",
  },
  welfare: {
    title: "Inequality & Welfare",
    description: "Inequality, poverty, and prices—welfare and purchasing power.",
  },
  discourse: {
    title: "Discourse & Audience",
    description: "Platform growth and YouTube comment analysis.",
  },
};

/**
 * Studies that belong in one browse group, sorted by that group’s `order` (inclusive of duplicate rows for
 * the same study, e.g. inflation in core + welfare).
 */
export function getBrowseRowsForGroup(
  studies: StudyMeta[],
  group: StudyGroup
): { study: StudyMeta; order: number }[] {
  const out: { study: StudyMeta; order: number }[] = [];
  for (const study of studies) {
    for (const p of study.groupPlacements ?? []) {
      if (p.group === group) out.push({ study, order: p.order });
    }
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

/** Primary signals that may attach the `global_macro_oil` event layer (curated world anchors). */
const PRIMARY_KINDS_GLOBAL_MACRO_OIL: ReadonlyArray<PrimarySignal["kind"]> = [
  "oil_brent",
  "oil_global_long",
  "gold_and_oil",
  "real_oil",
  "oil_ppp_iran",
  "oil_and_fx",
  "oil_production_major_exporters",
  "oil_geopolitical_reaction",
  "gdp_composition",
  "iran_gdp_accounts_dual",
];

export function studyUsesGlobalMacroOilLayer(study: StudyMeta | undefined): boolean {
  if (!study) return false;
  return PRIMARY_KINDS_GLOBAL_MACRO_OIL.includes(study.primarySignal.kind);
}

export function getStudyById(id: string): StudyMeta | undefined {
  const byId = STUDIES.find((s) => s.id === id);
  if (byId) return byId;
  const num = parseInt(id, 10);
  if (!Number.isNaN(num)) {
    return STUDIES.find((s) => s.number === num);
  }
  return undefined;
}

/** Listed on `/studies` and reachable at `/studies/[id]` for the current build (dev vs production). */
export function isStudyListedForDeployment(study: StudyMeta | undefined): boolean {
  if (!study || study.visible === false) return false;
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production" && study.hiddenInProduction) return false;
  return true;
}

/** Studies visible in the list. Excludes those with visible: false and `hiddenInProduction` in production. */
export function getVisibleStudies(): StudyMeta[] {
  return STUDIES.filter((s) => isStudyListedForDeployment(s));
}

/** Prev/next study for navigation. Uses visible studies ordered by number. */
export function getPrevNextStudies(currentId: string): {
  prev: StudyMeta | null;
  next: StudyMeta | null;
} {
  const visible = [...getVisibleStudies()].sort((a, b) => a.number - b.number);
  const idx = visible.findIndex((s) => s.id === currentId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? visible[idx - 1] ?? null : null,
    next: idx < visible.length - 1 ? visible[idx + 1] ?? null : null,
  };
}

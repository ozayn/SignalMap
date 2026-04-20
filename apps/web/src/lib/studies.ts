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
  | { kind: "poverty_headcount_iran" }
  | { kind: "dutch_disease_diagnostics_iran" };

import type { ConceptKey } from "./concepts";

/** Browse / filter: geographic emphasis (a study may span several). */
export type StudyCountry = "iran" | "us" | "global";

/** Browse / filter: coarse theme. */
export type StudyTheme = "macro" | "oil" | "fx" | "inequality" | "social";

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
    description:
      "A baseline study illustrating event-anchored windows on a macroeconomic series.",
    status: "active",
    primarySignal: { kind: "oil_brent" },
    concepts: ["nominal_price", "oil_benchmark", "event_overlay", "oil_price_shocks"],
    unitLabel: "USD per barrel",
  },
  {
    id: "usd-toman",
    number: 3,
    title: "USD→Toman (open market) as a socio-economic signal",
    timeRange: ["2018-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "Open-market USD/toman rate as a lived economic pressure indicator.",
    status: "active",
    primarySignal: { kind: "fx_usd_toman" },
    concepts: ["fx_rate", "event_overlay"],
    unitLabel: "toman per USD",
  },
  {
    id: "oil-and-fx",
    number: 4,
    title: "Oil and USD/toman: dual macroeconomic signals",
    timeRange: ["2021-01-15", new Date().toISOString().slice(0, 10)],
    description:
      "Brent oil price (left axis) and USD→toman open-market rate (right axis) overlaid for comparative context.",
    status: "active",
    primarySignal: { kind: "oil_and_fx" },
    concepts: ["nominal_price", "oil_benchmark", "fx_rate", "event_overlay"],
  },
  {
    id: "global_oil_1900",
    number: 5,
    title: "Global conflict and economic shocks (1900–present)",
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "A long-range view of global conflicts and structural shocks contextualized against gold (monetary stress) and oil (energy/geopolitical stress) prices.",
    status: "active",
    primarySignal: { kind: "gold_and_oil" },
    eventLayers: ["world_1900"],
    concepts: ["nominal_price", "oil_benchmark", "gold_price", "event_overlay"],
  },
  {
    id: "real_oil_price",
    number: 6,
    title: "Real oil prices and global economic burden",
    timeRange: ["1987-05-20", new Date().toISOString().slice(0, 10)],
    description:
      "Oil prices adjusted for inflation to examine long-term economic burden rather than market signaling.",
    status: "active",
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
    description:
      "An estimate of the domestic economic burden of oil prices in Iran using purchasing power parity (PPP) rather than market exchange rates.",
    status: "active",
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
    description:
      "Side-by-side comparison of PPP-adjusted oil burden in Iran and Turkey. Both series use identical methodology for contextual comparison.",
    status: "active",
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
    description:
      "A comparative view of global oil prices and Iran's estimated crude export capacity under constraints.",
    status: "active",
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
    timeRange: ["2000-01-01", "today"],
    description:
      "Crude oil production for Saudi Arabia, Russia, and Iran. Annual data in million barrels per day.",
    status: "active",
    primarySignal: { kind: "oil_production_major_exporters" },
    eventLayers: ["iran_core", "sanctions", "opec_decisions"],
    concepts: ["oil_production", "oil_production_vs_exports", "barrels_per_day", "supply_shocks"],
  },
  {
    id: "follower_growth_dynamics",
    number: 10,
    title: "Follower growth dynamics over time",
    timeRange: ["2010-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "An exploratory analysis of historical follower growth using simple growth models.",
    status: "active",
    primarySignal: { kind: "follower_growth_dynamics" },
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
    description:
      "A reference timeline of major political, economic, and geopolitical events used as context throughout SignalMap.",
    status: "active",
    primarySignal: { kind: "events_timeline" },
    concepts: ["event_overlay"],
  },
  {
    id: "iran_fx_spread",
    number: 12,
    title: "Dual Exchange Rates in Iran",
    timeRange: ["2012-01-01", new Date().toISOString().slice(0, 10)],
    description: "Official vs open-market USD/IRR.",
    status: "active",
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
    description:
      "Monitor recent oil price changes during periods of geopolitical stress. High-resolution Brent data with event markers for military escalation, sanctions, OPEC decisions, and major shocks.",
    status: "active",
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
    description:
      "Network view of crude oil trade between major exporting and importing countries. Nodes represent countries; edges show directional trade flows (thousand barrels per day).",
    status: "active",
    primarySignal: { kind: "oil_trade_network" },
    concepts: ["trade_networks", "energy_geopolitics", "export_dependencies"],
  },
  {
    id: "oil_exporter_timeseries",
    number: 17,
    title: "Major crude oil exporters: trade flows",
    timeRange: ["2000", "today"],
    description:
      "Annual crude oil export volumes for Saudi Arabia, Russia, United States, and Iran. Derived from bilateral trade flows (UN Comtrade HS 2709).",
    status: "active",
    primarySignal: { kind: "oil_exporter_timeseries" },
    concepts: ["trade_networks", "energy_geopolitics", "export_dependencies"],
    unitLabel: "thousand barrels/day",
  },
  {
    id: "bplus-discourse",
    number: 18,
    title: "Bplus YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Audience sentiment and discourse topics from Bplus Podcast YouTube comments.",
    status: "active",
    primarySignal: { kind: "youtube_comment_analysis" },
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "breaking_points_discourse",
    number: 19,
    title: "Breaking Points YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Audience sentiment and discourse topics from Breaking Points YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from Tucker Carlson YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from CNN YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from Fox News YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from BBC News YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from The Rest Is Politics YouTube comments.",
    status: "active",
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
    description: "Audience sentiment and discourse topics from BBC Persian YouTube comments.",
    status: "active",
    primarySignal: { kind: "youtube_comment_analysis" },
    youtubeChannelId: "UCHZk9MrT3DGWmVqdsj5y0EA",
    concepts: ["tf_idf", "dimensionality_reduction", "pca", "umap", "topic_grouping", "stopwords"],
  },
  {
    id: "iran_international_discourse",
    number: 25,
    title: "Iran International YouTube Discourse",
    timeRange: ["2020-01-01", new Date().toISOString().slice(0, 10)],
    description: "Audience sentiment and discourse topics from Iran International YouTube comments.",
    status: "active",
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
    description:
      "Nominal and CPI-adjusted (real) minimum wage in Iran. Emphasizes purchasing power and measurement limits.",
    status: "active",
    primarySignal: { kind: "wage_cpi_real" },
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
    description:
      "Annual economic structure: consumption and investment as shares of GDP, nominal GDP (current US$), and absolute levels for consumption, GDP, and investment (constant 2015 US$ when available). Iran only in this version; the API supports other countries for future comparisons.",
    status: "active",
    primarySignal: { kind: "gdp_composition" },
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
    description:
      "Reference-style layout for Iran: final consumption and gross capital formation (investment) on the left y-axis, GDP on the right. Same World Bank WDI level units as the GDP composition study’s levels view (Real / USD / Toman). The two axes are not directly comparable—this chart is for visual comparison with common academic figures, not for ratio reading across axes.",
    status: "active",
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
    description:
      "The Gini coefficient summarizes how unequally income is distributed in a country. This study plots World Bank estimates over time for Iran, the United States, Germany, Turkey, China, and Saudi Arabia using the same indicator (SI.POV.GINI).",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["inequality", "macro"],
    tags: ["Gini", "World Bank", "Cross-country"],
    keywords: ["si.pov.gini", "survey", "household income"],
    primarySignal: { kind: "gini_inequality" },
    eventLayers: ["iran_core", "world_core", "sanctions"],
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
    description:
      "Year-on-year change in consumer prices (annual %) from the World Bank. Iran, the United States, Germany, Turkey, China, and Saudi Arabia use the same indicator (FP.CPI.TOTL.ZG) for comparability; levels still differ by methodology and shocks.",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["macro"],
    tags: ["CPI", "Consumer prices", "YoY"],
    keywords: ["fp.cpi.totl.zg", "prices"],
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
    description:
      "The poverty headcount ratio is the percentage of the population living below a defined international poverty line. This study plots two World Bank WDI series for Iran (SI.POV.DDAY and SI.POV.LMIC); the exact dollar thresholds follow the Bank’s published indicator definitions and change when PPP bases are revised.",
    status: "active",
    countries: ["iran"],
    themes: ["inequality", "macro"],
    tags: ["WDI", "Poverty lines", "Headcount"],
    keywords: ["si.pov.dday", "si.pov.lmic", "international poverty line", "ppp"],
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
    description:
      "A multi-panel diagnostic view for Iran: World Bank oil rents and manufacturing value added as shares of GDP, imports as a share of GDP, and open-market USD→toman as macro pressure context. Dutch disease is a structural hypothesis about resource booms and tradables—not something this page measures as a single index.",
    status: "active",
    countries: ["iran"],
    themes: ["macro", "oil", "fx"],
    tags: ["WDI", "Dutch disease", "Resource curse", "Structural change"],
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
    description:
      "Total GDP over time from the World Bank: constant 2015 US$ (NY.GDP.MKTP.KD) when available for each economy, otherwise current US$ (NY.GDP.MKTP.CD). Includes the WLD aggregate. Default view indexes each series to 100 in calendar year 2000 when that year exists (otherwise the earliest usable base year for that series) so very different economy sizes stay readable on one chart.",
    status: "active",
    countries: ["iran", "us", "global"],
    themes: ["macro"],
    tags: ["GDP", "World Bank", "Cross-country", "WDI"],
    keywords: ["ny.gdp.mktp.kd", "ny.gdp.mktp.cd", "aggregate", "china", "turkey", "saudi arabia", "world"],
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
];

/** Studies page grouped sections (order + copy). Study ids must exist in `STUDIES`. */
export const STUDY_SECTIONS: { title: string; description: string; studyIds: string[] }[] = [
  {
    title: "Foundations (signals)",
    description: "Core price and exchange-rate series that anchor later analysis.",
    studyIds: ["iran", "usd-toman", "oil-and-fx", "iran-gdp-composition", "iran-gdp-accounts-dual", "dutch-disease-diagnostics"],
  },
  {
    title: "Context (timelines)",
    description: "Reference timelines for events and long-range price context.",
    studyIds: ["events_timeline", "global_oil_1900", "oil_geopolitical_reaction"],
  },
  {
    title: "Burden & adjustment (methods)",
    description: "Inflation-adjusted and PPP-based measures of economic burden.",
    studyIds: ["real_oil_price", "iran_oil_ppp", "iran_real_wage_cpi"],
  },
  {
    title: "Comparisons & constraints",
    description: "Cross-country comparisons and capacity under constraints.",
    studyIds: [
      "iran_oil_ppp_turkey",
      "iran_oil_export_capacity",
      "oil_major_exporters",
      "iran_fx_spread",
      "gini-inequality",
      "inflation-rate",
      "global-gdp-comparison",
      "poverty-rate",
    ],
  },
  {
    title: "Audience dynamics (growth & networks)",
    description: "Follower growth, simple growth models, and network prototypes.",
    studyIds: ["follower_growth_dynamics", "oil_trade_network", "oil_exporter_timeseries"],
  },
  {
    title: "Media discourse",
    description:
      "Language, narrative, and audience discourse extracted from YouTube comment sections.",
    studyIds: [
      "bplus-discourse",
      "bbc_persian_discourse",
      "iran_international_discourse",
      "breaking_points_discourse",
      "tucker_carlson_discourse",
      "cnn_discourse",
      "fox_news_discourse",
      "bbc_discourse",
      "rest_is_politics_discourse",
    ],
  },
];

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

/** Studies visible in the list. Excludes those with visible: false. */
export function getVisibleStudies(): StudyMeta[] {
  return STUDIES.filter((s) => s.visible !== false);
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

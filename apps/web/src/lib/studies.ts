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
  | { kind: "youtube_comment_analysis" };

import type { ConceptKey } from "./concepts";

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
];

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

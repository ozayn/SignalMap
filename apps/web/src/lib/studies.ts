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
  | { kind: "events_timeline" }
  | { kind: "follower_growth_dynamics" }
  | { kind: "fx_usd_irr_dual" }
  | { kind: "wage_cpi_real" };

import type { ConceptKey } from "./concepts";

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
    timeRange: ["2021-01-15", "2026-02-06"],
    description:
      "A baseline study illustrating event-anchored windows on a macroeconomic series.",
    status: "active",
    primarySignal: { kind: "oil_brent" },
    concepts: ["nominal_price", "oil_benchmark", "event_overlay"],
  },
  {
    id: "usd-toman",
    number: 3,
    title: "USD→Toman (open market) as a socio-economic signal",
    timeRange: ["2018-01-01", "2027-01-01"],
    description:
      "Open-market USD/toman rate as a lived economic pressure indicator.",
    status: "active",
    primarySignal: { kind: "fx_usd_toman" },
    concepts: ["fx_rate", "event_overlay"],
  },
  {
    id: "oil-and-fx",
    number: 4,
    title: "Oil and USD/toman: dual macroeconomic signals",
    timeRange: ["2021-01-15", "2027-01-01"],
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
  return STUDIES.find((s) => s.id === id);
}

/** Studies visible in the list. Excludes those with visible: false. */
export function getVisibleStudies(): StudyMeta[] {
  return STUDIES.filter((s) => s.visible !== false);
}

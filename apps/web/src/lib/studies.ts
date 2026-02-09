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
  | { kind: "events_timeline" };

import type { ConceptKey } from "./concepts";

export type StudyMeta = {
  id: string;
  number: number;
  title: string;
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
    concepts: ["real_price", "cpi", "event_overlay"],
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
    concepts: ["ppp", "log_scale", "structural_break", "event_overlay"],
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
    concepts: ["ppp", "log_scale", "structural_break"],
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
    concepts: ["oil_benchmark", "price_vs_quantity", "indexing", "event_overlay"],
  },
  {
    id: "events_timeline",
    number: 10,
    title: "Historical events timeline (1900–present)",
    timeRange: ["1900-01-01", new Date().toISOString().slice(0, 10)],
    description:
      "A reference timeline of major political, economic, and geopolitical events used as context throughout SignalMap.",
    status: "active",
    primarySignal: { kind: "events_timeline" },
    concepts: ["event_overlay"],
  },
];

export function getStudyById(id: string): StudyMeta | undefined {
  return STUDIES.find((s) => s.id === id);
}

/** Studies visible in the list. Excludes those with visible: false. */
export function getVisibleStudies(): StudyMeta[] {
  return STUDIES.filter((s) => s.visible !== false);
}

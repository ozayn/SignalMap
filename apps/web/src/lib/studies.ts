export type PrimarySignal =
  | { kind: "overview_stub" }
  | { kind: "oil_brent" }
  | { kind: "oil_global_long" }
  | { kind: "gold_and_oil" }
  | { kind: "fx_usd_toman" }
  | { kind: "oil_and_fx" };

export type StudyMeta = {
  id: string;
  number: number;
  title: string;
  timeRange: [string, string];
  description: string;
  status: string;
  primarySignal: PrimarySignal;
  eventLayers?: string[];
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
  },
];

export function getStudyById(id: string): StudyMeta | undefined {
  return STUDIES.find((s) => s.id === id);
}

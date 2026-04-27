/**
 * Static macro-context markers for GDP composition charts (Iran-first).
 * Visualization only — not used in any series computation.
 *
 * To add events: append to IRAN_GDP_MACRO_EVENTS with unique `year` + `anchorMonth`
 * (or extend with `country: "IRN"` when multi-country support is added).
 */

import type { TimelineEvent } from "@/components/timeline-chart";

export type GdpMacroEventType = "political" | "war" | "sanctions";

export type GdpMacroEventDef = {
  /** Gregorian calendar year (display / x-axis alignment). */
  year: number;
  /** Month 1–12 for `YYYY-MM-01` anchor when multiple events share a year. */
  anchorMonth: number;
  /** Full title (tooltip, accessibility). */
  label: string;
  /** Short markLine caption; avoids crowding when many anchors exist. */
  chartLabel: string;
  description: string;
  type: GdpMacroEventType;
};

/** Ordered roughly chronologically; `anchorMonth` avoids stacked lines in the same year. */
export const IRAN_GDP_MACRO_EVENTS: GdpMacroEventDef[] = [
  {
    year: 1953,
    anchorMonth: 8,
    label: "1953 coup",
    chartLabel: "1953 coup",
    description: "CIA-backed coup (Operation Ajax) against Prime Minister Mossadegh.",
    type: "political",
  },
  {
    year: 1979,
    anchorMonth: 2,
    label: "1979 Revolution",
    chartLabel: "1979 Revolution",
    description: "Iranian Revolution: collapse of the monarchy and establishment of the Islamic Republic.",
    type: "political",
  },
  {
    year: 1979,
    anchorMonth: 11,
    label: "US Embassy crisis",
    chartLabel: "Embassy crisis",
    description: "US Embassy hostage crisis begins (diplomatic rupture with the United States).",
    type: "political",
  },
  {
    year: 1980,
    anchorMonth: 9,
    label: "Iran–Iraq War",
    chartLabel: "Iraq War",
    description: "Start of the Iran–Iraq War (major regional conflict and economic shock).",
    type: "war",
  },
  {
    year: 1988,
    anchorMonth: 8,
    label: "War ceasefire",
    chartLabel: "Ceasefire",
    description: "Iran–Iraq War ends (UN-brokered ceasefire).",
    type: "war",
  },
  {
    year: 2006,
    anchorMonth: 12,
    label: "Nuclear sanctions",
    chartLabel: "Sanctions",
    description: "Escalation of international sanctions linked to Iran’s nuclear program.",
    type: "sanctions",
  },
  {
    year: 2015,
    anchorMonth: 7,
    label: "JCPOA",
    chartLabel: "JCPOA",
    description: "Joint Comprehensive Plan of Action (nuclear deal) agreed.",
    type: "sanctions",
  },
  {
    year: 2016,
    anchorMonth: 11,
    label: "OPEC+ output framework (Vienna)",
    chartLabel: "OPEC+ 2016",
    description: "OPEC+ coordination after 2014–2016 low price phase; long-run governance of spare capacity and cuts.",
    type: "political",
  },
  {
    year: 2018,
    anchorMonth: 5,
    label: "US exits JCPOA",
    chartLabel: "JCPOA exit",
    description: "United States withdrawal from the JCPOA; renewed sanctions pressure.",
    type: "sanctions",
  },
  {
    year: 2020,
    anchorMonth: 1,
    label: "Soleimani strike",
    chartLabel: "Soleimani",
    description: "US strike killing Qasem Soleimani (sharp escalation in US–Iran tensions).",
    type: "war",
  },
  {
    year: 2022,
    anchorMonth: 9,
    label: "2022 protests",
    chartLabel: "Protests",
    description: "Widespread protests following Mahsa Amini’s death in custody.",
    type: "political",
  },
  {
    year: 2025,
    anchorMonth: 3,
    label: "2025 tensions",
    chartLabel: "2025",
    description: "Economic protests and heightened domestic political tensions (period label; exact timing varies in reporting).",
    type: "political",
  },
];

/** Timeline events for `TimelineChart` (point-in-time vertical markers). */
export function iranGdpMacroEventsToTimeline(): TimelineEvent[] {
  return IRAN_GDP_MACRO_EVENTS.map((e, i) => ({
    id: `iran-gdp-macro-${e.year}-${e.anchorMonth}-${i}`,
    title: e.label,
    chartLabel: e.chartLabel,
    date: `${e.year}-${String(e.anchorMonth).padStart(2, "0")}-01`,
    description: e.description,
    type: e.type,
    macroMarker: true,
    layer: "iran_core",
    scope: "iran",
  }));
}

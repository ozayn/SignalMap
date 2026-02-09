export type StudyMeta = {
  id: string;
  number: number;
  title: string;
  timeRange: [string, string];
  description: string;
  status: string;
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
  },
  {
    id: "iran",
    number: 2,
    title: "Iran discourse 2021–2026",
    timeRange: ["2021-01-15", "2026-02-06"],
    description:
      "Longitudinal analysis of public discourse with event overlays for Mahsa Amini protests, internet restrictions, and related events.",
    status: "active",
  },
];

export function getStudyById(id: string): StudyMeta | undefined {
  return STUDIES.find((s) => s.id === id);
}

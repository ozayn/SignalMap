import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStudyById } from "@/lib/studies";

const study = getStudyById("comparative-history-timeline");

export const metadata: Metadata = {
  title: study?.title ? `${study.title} — SignalMap` : "Comparative history timeline",
  description: study?.description,
};

export default function ComparativeHistoryTimelineLayout({ children }: { children: ReactNode }) {
  return children;
}

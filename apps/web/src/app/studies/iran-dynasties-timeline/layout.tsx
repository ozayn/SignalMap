import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStudyById } from "@/lib/studies";

const study = getStudyById("iran-dynasties-timeline");

export const metadata: Metadata = {
  title: study?.title ? `${study.title} — SignalMap` : "Iran dynasties timeline",
  description: study?.description,
};

export default function IranDynastiesLayout({ children }: { children: ReactNode }) {
  return children;
}

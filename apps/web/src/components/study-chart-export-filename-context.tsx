"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StudyChartExportFilenameLocale = "en" | "fa";

export type StudyChartExportFilenameContextValue = {
  studySlug: string;
  locale: StudyChartExportFilenameLocale;
};

const StudyChartExportFilenameContext = createContext<StudyChartExportFilenameContextValue | null>(null);

export function StudyChartExportFilenameProvider({
  value,
  children,
}: {
  value: StudyChartExportFilenameContextValue;
  children: ReactNode;
}) {
  return <StudyChartExportFilenameContext.Provider value={value}>{children}</StudyChartExportFilenameContext.Provider>;
}

export function useStudyChartExportFilenameContext(): StudyChartExportFilenameContextValue | null {
  return useContext(StudyChartExportFilenameContext);
}

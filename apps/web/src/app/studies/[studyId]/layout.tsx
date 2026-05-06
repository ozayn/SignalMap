import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildStudyMetadata } from "@/lib/study-page-metadata";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ studyId: string }>;
};

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { studyId } = await params;
  return buildStudyMetadata(studyId);
}

export default async function StudyLayout({ children }: LayoutProps) {
  return children;
}

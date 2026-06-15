import type { Metadata } from "next";
import { UsLivingStandardsStudy } from "@/components/studies/us-living-standards-study";
import { buildStudyMetadata } from "@/lib/study-page-metadata";

export const metadata: Metadata = buildStudyMetadata("us-living-standards");

export default function UsLivingStandardsStudyPage() {
  return (
    <div className="studies-container py-8">
      <UsLivingStandardsStudy />
    </div>
  );
}

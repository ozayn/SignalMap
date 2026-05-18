import type { Metadata } from "next";
import { getStudyById, isStudyListedForDeployment } from "@/lib/studies";

const SITE_NAME = "SignalMap";
const DEFAULT_DESCRIPTION =
  "Research-style dashboard for exploring economic, geopolitical, historical, and platform signals over time.";

type StudyMetadataOverride = {
  title: string;
  description?: string;
  ogImage?: string;
};

const STUDY_METADATA_OVERRIDES: Record<string, StudyMetadataOverride> = {
  "iran-economy-period-comparison": {
    title: "Iran Economy — Period Comparison | SignalMap",
  },
  "us-economy": {
    title: "United States Economy Study | SignalMap",
  },
  "russia-economy": {
    title: "Russia Economy Study | SignalMap",
  },
  "turkey-economy": {
    title: "Turkey Economy Study | SignalMap",
  },
  "saudi-arabia-economy": {
    title: "Saudi Arabia Economy Study | SignalMap",
  },
  "tajikistan-economy": {
    title: "Tajikistan Economy Study | SignalMap",
  },
  "china-economy": {
    title: "China Economy Study | SignalMap",
  },
};

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "https://signalmap.ozayn.com";
  return raw.replace(/\/+$/, "");
}

function clampDescription(text: string, maxLen = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export function buildStudyMetadata(studyId: string): Metadata {
  const siteUrl = resolveSiteUrl();
  const defaultOg = `${siteUrl}/logo.png`;
  // TODO(og): generate study-specific OG images and replace default logo.
  const study = getStudyById(studyId);

  if (!study || !isStudyListedForDeployment(study)) {
    const title = `Study not found | ${SITE_NAME}`;
    const description = "This study page is unavailable.";
    const url = `${siteUrl}/studies/${encodeURIComponent(studyId)}`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        url,
        siteName: SITE_NAME,
        images: [{ url: defaultOg, width: 1200, height: 630 }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [defaultOg],
      },
    };
  }

  const canonicalId = study.id;
  const override = STUDY_METADATA_OVERRIDES[canonicalId];
  const title = override?.title ?? `${study.title} | ${SITE_NAME}`;
  const description = clampDescription(
    override?.description ?? study.socialDescription ?? study.description ?? DEFAULT_DESCRIPTION
  );
  const ogImage = override?.ogImage ?? defaultOg;
  const url = `${siteUrl}/studies/${canonicalId}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

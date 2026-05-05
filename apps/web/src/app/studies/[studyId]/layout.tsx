import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStudyById, isStudyListedForDeployment } from "@/lib/studies";

const SITE_NAME = "SignalMap";
const SITE_URL = "https://signalmap.ozayn.com";
const DEFAULT_OG = `${SITE_URL}/og/study.png`;

type StudyMetadataOverride = {
  title: string;
  description: string;
  ogImage: string;
};

const STUDY_METADATA_OVERRIDES: Record<string, StudyMetadataOverride> = {
  "iran-economy-period-comparison": {
    title: "Iran Economy — Period Comparison | SignalMap",
    description: "Compare Iran's macroeconomic indicators across presidencies and time periods.",
    ogImage: `${SITE_URL}/og/iran.png`,
  },
  "us-economy": {
    title: "United States Economy Study | SignalMap",
    description: "Track U.S. inflation, growth, fiscal indicators, rates, and distribution metrics across policy eras.",
    ogImage: `${SITE_URL}/og/us.png`,
  },
  "russia-economy": {
    title: "Russia Economy Study | SignalMap",
    description: "Explore Russia's macro indicators across post-Soviet periods with focus presets and crisis overlays.",
    ogImage: `${SITE_URL}/og/russia.png`,
  },
  "turkey-economy": {
    title: "Turkey Economy Study | SignalMap",
    description: "Follow Turkey's inflation, exchange rate, rates, debt, and distribution indicators across policy regimes.",
    ogImage: `${SITE_URL}/og/turkey.png`,
  },
};

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ studyId: string }>;
};

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { studyId } = await params;
  const study = getStudyById(studyId);

  if (!study || !isStudyListedForDeployment(study)) {
    const title = `Study not found | ${SITE_NAME}`;
    const description = "This study page is unavailable.";
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/studies/${encodeURIComponent(studyId)}`,
        siteName: SITE_NAME,
        images: [{ url: DEFAULT_OG, width: 1200, height: 630 }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [DEFAULT_OG],
      },
    };
  }

  const canonicalId = study.id;
  const override = STUDY_METADATA_OVERRIDES[canonicalId];
  const title = override?.title ?? `${study.title} | ${SITE_NAME}`;
  const description = override?.description ?? study.description;
  const ogImage = override?.ogImage ?? DEFAULT_OG;
  const url = `${SITE_URL}/studies/${canonicalId}`;

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

export default async function StudyLayout({ children }: LayoutProps) {
  return children;
}

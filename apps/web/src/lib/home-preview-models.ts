import type { HomePreviewPoint, HomePreviewStackedPoint } from "@/lib/home-preview-series";

export type HomePreviewCardPayload = {
  id: string;
  title: string;
  href: string;
  subtitle: string;
  points: HomePreviewPoint[];
  chartKind?: "line" | "stacked_area";
  stackedPoints?: HomePreviewStackedPoint[];
  /** Upstream vs preview sizes (for debugging / transparency). */
  stats?: { upstream: number; preview: number; stackedUpstream?: number; stackedPreview?: number };
};

export type HomePreviewResponse = {
  generated_at: string;
  cards: HomePreviewCardPayload[];
};

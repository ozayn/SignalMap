import type { HomePreviewPoint } from "@/lib/home-preview-series";

export type HomePreviewCardPayload = {
  id: string;
  title: string;
  href: string;
  subtitle: string;
  points: HomePreviewPoint[];
  /** Upstream vs preview sizes (for debugging / transparency). */
  stats?: { upstream: number; preview: number };
};

export type HomePreviewResponse = {
  generated_at: string;
  cards: HomePreviewCardPayload[];
};

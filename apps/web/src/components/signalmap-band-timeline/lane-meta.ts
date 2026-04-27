import type { BandTimelineLane } from "@/lib/signalmap-band-timeline";

/** Layer toggle keys (same as `BandTimelineLane` for this view). */
export type BandLane = BandTimelineLane;

export const LAYER_ROW_H_PX = 48;

export const LAYER_UI: { key: BandLane; labelEn: string; labelFa: string }[] = [
  { key: "global", labelEn: "Global", labelFa: "جهانی" },
  { key: "iran", labelEn: "Iran", labelFa: "ایران" },
  { key: "oil", labelEn: "Oil", labelFa: "نفت" },
  { key: "fx", labelEn: "FX", labelFa: "ارز" },
  { key: "global_wars", labelEn: "Global conflicts", labelFa: "نبردهای جهانی" },
  { key: "europe_wars", labelEn: "Europe", labelFa: "اروپا" },
  { key: "middle_east_wars", labelEn: "Middle East", labelFa: "خاورمیانه" },
  { key: "policy", labelEn: "Policy", labelFa: "سیاست" },
  { key: "iran_leadership", labelEn: "Iran leadership", labelFa: "رهبری سیاسی ایران" },
  { key: "us_leadership", labelEn: "U.S. leadership", labelFa: "رهبری سیاسی آمریکا" },
];

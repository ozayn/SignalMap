import type { BandTimelineLane } from "@/lib/signalmap-band-timeline";

/** Layer toggle keys (same as `BandTimelineLane` for this view). */
export type BandLane = BandTimelineLane;

export const LAYER_ROW_H_PX = 48;

export const LAYER_UI: { key: BandLane; labelEn: string; labelFa: string }[] = [
  { key: "global", labelEn: "Global", labelFa: "جهانی" },
  { key: "iran", labelEn: "Iran", labelFa: "ایران" },
  { key: "oil", labelEn: "Oil", labelFa: "نفت" },
  { key: "fx", labelEn: "FX", labelFa: "ارز" },
  { key: "war", labelEn: "Wars", labelFa: "جنگ" },
  { key: "policy", labelEn: "Policy", labelFa: "سیاست" },
];

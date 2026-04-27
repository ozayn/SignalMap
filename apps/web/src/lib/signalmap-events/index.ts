/**
 * Single import surface for SignalMap event data on the web.
 * Today: dot-timeline seed and band-timeline seed remain the source files; merge into one list is future work.
 */
export type { SignalMapEventRecord } from "./types";
export { SIGNALMAP_TIMELINE_SEED } from "../signalmap-timeline/seed";
export { BAND_TIMELINE_SEED } from "../signalmap-band-timeline/seed";
export type { BandTimelineEvent, BandTimelineLane } from "../signalmap-band-timeline/types";
export type { SignalMapTimelineEvent, SignalMapTimelineCategory } from "../signalmap-timeline/types";

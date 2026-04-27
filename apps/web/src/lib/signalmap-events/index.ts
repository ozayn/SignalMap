/**
 * Single import surface for SignalMap event data on the web.
 * Today: dot-timeline seed and band-timeline seed remain the source files; merge into one list is future work.
 */
export type { SignalMapEventRecord } from "./types";
export { SIGNALMAP_TIMELINE_SEED } from "../signalmap-timeline/seed";
export { BAND_TIMELINE_SEED } from "../signalmap-band-timeline/seed";
export { SIGNALMAP_BALKAN_AND_WAR_BAND, SIGNALMAP_BALKAN_AND_WAR_RANGES } from "../signalmap-war-canonical";
export { SIGNALMAP_OIL_BAND, SIGNALMAP_OIL_TIMELINE } from "../signalmap-oil-canonical";
export { SIGNALMAP_FX_BAND } from "../signalmap-fx-band-canonical";
export type { StudyConceptId, SignalMapCoreConceptId, SignalMapConcept } from "../signalmap-concepts";
export { SIGNALMAP_CONCEPT_REGISTRY, resolveStudyConcept, resolveStudyConcepts, SIGNALMAP_CORE_CONCEPT_ORDER } from "../signalmap-concepts";
export {
  IR_LEADERSHIP_COUNT,
  LEADERSHIP_BAND_ALL,
  US_LEADERSHIP_COUNT,
} from "../signalmap-band-timeline/leadership-seed";
export { MACRO_CRISIS_BAND_PERIODS } from "../signalmap-macro-crisis-periods";
export { ISRAEL_IRAN_US_BAND, ISRAEL_IRAN_US_TIMELINE_DOT } from "../signalmap-israel-iran-us-conflict";
export type { BandTimelineCategory, BandTimelineEvent, BandTimelineLane } from "../signalmap-band-timeline/types";
export type { SignalMapTimelineEvent, SignalMapTimelineCategory } from "../signalmap-timeline/types";

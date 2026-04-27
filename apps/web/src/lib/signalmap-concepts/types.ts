/**
 * Reusable “concept card” data for study pages: definition + example, fully split EN/FA
 * (render with `locale` — never interleave languages in the same string).
 */
export const SIGNALMAP_CORE_CONCEPT_ORDER = [
  "fx",
  "cpi",
  "inflation",
  "nominal_vs_real",
  "oil_shock",
  "sanctions",
  "spread",
  "exchange_rate_regime",
  "liquidity_m2",
  "gdp",
] as const;

export type SignalMapCoreConceptId = (typeof SIGNALMAP_CORE_CONCEPT_ORDER)[number];

export type SignalMapConcept = {
  id: SignalMapCoreConceptId;
  title_en: string;
  title_fa: string;
  /** One–two sentence definition. */
  short_en: string;
  short_fa: string;
  /** Worked-style anchor for the idea (not a full lesson). */
  example_en: string;
  example_fa: string;
  /** Optional browse / filter keys (EN tokens). */
  tags: string[];
};

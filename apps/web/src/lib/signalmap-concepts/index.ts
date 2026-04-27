/**
 * Reusable study concept cards (registry + legacy `ConceptKey` from `../concepts`).
 */
import { CONCEPTS, type ConceptKey, type Concept } from "@/lib/concepts";
import { getLocalizedConcept } from "@/lib/concepts-fa";
import {
  isSignalMapCoreConceptId,
  SIGNALMAP_CONCEPT_REGISTRY,
} from "./registry";
import type { SignalMapConcept, SignalMapCoreConceptId } from "./types";
export { SIGNALMAP_CORE_CONCEPT_ORDER } from "./types";
export { SIGNALMAP_CONCEPT_REGISTRY, isSignalMapCoreConceptId } from "./registry";
export type { SignalMapConcept, SignalMapCoreConceptId } from "./types";

export type StudyConceptId = SignalMapCoreConceptId | ConceptKey;

/** What the study “Concepts used” block renders. */
export type ResolvedStudyConcept = {
  id: string;
  title: string;
  short: string;
  example: string;
  tags: string[];
  links?: Concept["links"];
};

function isConceptKey(k: string): k is ConceptKey {
  return k in CONCEPTS;
}

/**
 * Bilingual, single-locale: pass `isFa` from the page — no mixed copy in one string.
 * Registry (core) wins when `id` is a `SignalMapCoreConceptId` (e.g. `fx`, `gdp`, and `cpi`).
 */
export function resolveStudyConcept(id: string, isFa: boolean): ResolvedStudyConcept | null {
  if (isSignalMapCoreConceptId(id)) {
    const c: SignalMapConcept = SIGNALMAP_CONCEPT_REGISTRY[id];
    return {
      id: c.id,
      title: isFa ? c.title_fa : c.title_en,
      short: isFa ? c.short_fa : c.short_en,
      example: isFa ? c.example_fa : c.example_en,
      tags: c.tags,
    };
  }
  if (isConceptKey(id)) {
    const c = getLocalizedConcept(id, isFa);
    return {
      id,
      title: c.title,
      short: c.description,
      example: c.inSimpleTerms ?? "",
      tags: [],
      links: c.links,
    };
  }
  return null;
}

export function resolveStudyConcepts(ids: readonly string[], isFa: boolean): ResolvedStudyConcept[] {
  const out: ResolvedStudyConcept[] = [];
  for (const k of ids) {
    const r = resolveStudyConcept(k, isFa);
    if (r) out.push(r);
  }
  return out;
}

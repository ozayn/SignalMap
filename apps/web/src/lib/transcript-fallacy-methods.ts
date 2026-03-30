/**
 * Copy for transcript fallacy detection methods (heuristic, classifier, LLM).
 * Used by short in-app notes and the Learning page.
 */

export type FallacyMethodKey = "heuristic" | "classifier" | "llm";

/** Short notes shown next to method selection (4 lines each). */
export const FALLACY_METHOD_SHORT_NOTES: Record<
  FallacyMethodKey,
  { title: string; bullets: [string, string, string, string] }
> = {
  heuristic: {
    title: "Heuristic",
    bullets: [
      "What it is: A fixed set of English keyword and phrase rules tuned to flag candidate fallacy-like patterns in text.",
      "How it works: Each transcript chunk is scanned for matches; labels attach when rules fire (with optional strength cues).",
      "Strength: Fast, deterministic, and easy to audit — you can see which rules matched.",
      "Limitation: Not a full logical-fallacy detector; misses nuance, non-English speech, and can misfire on informal phrasing.",
    ],
  },
  classifier: {
    title: "Classifier",
    bullets: [
      "What it is: A planned NLP approach using a trained model or embeddings to assign fallacy labels from examples.",
      "How it works (when available): Learned patterns from labeled data generalize beyond fixed keyword lists.",
      "Strength: Can capture phrasing that rules miss if training data and labels are good.",
      "Limitation: Not shipped yet; quality depends heavily on data, definitions, and ongoing evaluation.",
    ],
  },
  llm: {
    title: "LLM",
    bullets: [
      "What it is: A prompt-based pass where a language model reads each chunk and returns structured labels and short rationales.",
      "How it works: The model reasons over wording in context; output is parsed and validated server-side.",
      "Strength: Flexible wording coverage and explanations — useful for exploration and comparison with other methods.",
      "Limitation: Can be inconsistent, over- or under-confident, and may hallucinate labels or quotes; needs human review.",
    ],
  },
};

/** Longer entries for /learning (title + description paragraphs). */
export type TranscriptFallacyLearningConcept = {
  title: string;
  description: string;
};

export const TRANSCRIPT_FALLACY_LEARNING_CONCEPTS: TranscriptFallacyLearningConcept[] = [
  {
    title: "Transcript fallacy analysis — overview",
    description:
      "This tool labels transcript chunks with candidate rhetorical patterns (e.g. types of potential fallacies). It is experimental: labels are aids for exploration, not proof that a formal fallacy occurred. Three method families are available for comparison: rule-based heuristics, a future classifier model, and an LLM-assisted pass. Each method uses different signals, so they will often disagree — that disagreement is informative, not a bug.",
  },
  {
    title: "Heuristic method (rule-based)",
    description:
      "Uses hand-tuned keyword and phrase detectors with simple context guards. What it uses: explicit string patterns and lightweight rules over chunk text. Strengths: transparent, reproducible, and cheap to run; good for baseline coverage and debugging. Weaknesses: English-centric, brittle to paraphrase, and cannot capture full argument structure. When it may fail: sarcasm, code-switching, implicit premises, or valid rhetoric that resembles a pattern. It may disagree with the LLM because the LLM infers intent and paraphrase while heuristics only match surface cues.",
  },
  {
    title: "Classifier method (NLP model)",
    description:
      "Will use a supervised or embedding-based model trained on labeled examples (or similar signals) rather than fixed keyword lists. What it uses: learned weights from data — typically text features or dense embeddings — mapped to fallacy categories. Strengths: can generalize beyond exact phrases if training matches the domain. Weaknesses: depends on label quality, class balance, and domain shift; errors can be opaque without careful evaluation. When it may fail: out-of-domain topics, rare phrasing, or labels that do not match how annotators defined fallacies. Not yet implemented in this app; results are disabled until the pipeline is ready.",
  },
  {
    title: "LLM method (prompt-based)",
    description:
      "Uses a hosted large language model with structured JSON prompts to assign labels and short rationales per chunk. What it uses: semantic reasoning over the transcript text via the model’s weights (not audio diarization). Strengths: handles varied wording and can supply explanations. Weaknesses: non-deterministic across runs, possible hallucinations, and sensitivity to prompt wording; not a substitute for domain validation. When it may fail: subtle logic, unstated assumptions, or chunks where the model overfits to keywords. It may disagree with heuristics because it interprets meaning more freely, or with a future classifier because training objectives differ.",
  },
  {
    title: "Why methods may disagree",
    description:
      "Heuristics surface explicit cues; classifiers optimize for training distributions; LLMs infer loosely from natural language. The same chunk might trigger a rule, score high in a model, and be rejected by an LLM — or the reverse. Treat disagreement as a signal to read the source text, not as proof that one method is “right.” Compare outputs cautiously and avoid using any single method alone for high-stakes conclusions.",
  },
];

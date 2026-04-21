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
      "Language: English transcripts only today. Persian (and other) transcripts return unsupported with a clear note — no English rules are run on non-English text.",
      "Limitation: Not a full logical-fallacy detector; misses nuance and can misfire on informal phrasing. Persian heuristic rules are planned but not wired yet.",
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
      "Language: For pasted transcripts, choose English or Farsi in the language control. The LLM uses separate English and Persian prompts (same JSON label set). YouTube captions supply language automatically. Other languages use the English prompt with a reliability caveat in the API note.",
      "Limitation: Can be inconsistent, over- or under-confident, and may hallucinate labels or quotes; needs human review.",
    ],
  },
};

/** Longer entries for /learning (title + description paragraphs). */
export type TranscriptFallacyLearningConcept = {
  title: string;
  /** One plain sentence shown first on /learning. */
  quickDefinition: string;
  description: string;
};

export const TRANSCRIPT_FALLACY_LEARNING_CONCEPTS: TranscriptFallacyLearningConcept[] = [
  {
    title: "Transcript fallacy analysis — overview",
    quickDefinition: "Labels chunks of speech with possible rhetorical patterns so you can explore the text, not to prove formal fallacies.",
    description:
      "This tool labels transcript chunks with candidate rhetorical patterns (e.g. types of potential fallacies). It is experimental: labels are aids for exploration, not proof that a formal fallacy occurred. Three method families are available for comparison: rule-based heuristics, a future classifier model, and an LLM-assisted pass. Each method uses different signals, so they will often disagree — that disagreement is informative, not a bug.",
  },
  {
    title: "Heuristic method (rule-based)",
    quickDefinition: "Looks for fixed word patterns in the text—fast and clear, but easy to miss rephrasing.",
    description:
      "Uses hand-tuned keyword and phrase detectors with simple context guards. What it uses: explicit string patterns and lightweight rules over chunk text. Strengths: transparent, reproducible, and cheap to run; good for baseline coverage and debugging. Weaknesses: English-centric, brittle to paraphrase, and cannot capture full argument structure. Language support: English only for now; Persian heuristics are scaffolded in the codebase but not executed, so Persian transcripts get analysis_supported=false with an explicit note. When it may fail: sarcasm, code-switching, implicit premises, or valid rhetoric that resembles a pattern. It may disagree with the LLM because the LLM infers intent and paraphrase while heuristics only match surface cues.",
  },
  {
    title: "Classifier method (NLP model)",
    quickDefinition: "Would learn from examples to score chunks—more flexible than keywords, not wired up here yet.",
    description:
      "Will use a supervised or embedding-based model trained on labeled examples (or similar signals) rather than fixed keyword lists. What it uses: learned weights from data — typically text features or dense embeddings — mapped to fallacy categories. Strengths: can generalize beyond exact phrases if training matches the domain. Weaknesses: depends on label quality, class balance, and domain shift; errors can be opaque without careful evaluation. When it may fail: out-of-domain topics, rare phrasing, or labels that do not match how annotators defined fallacies. Not yet implemented in this app; results are disabled until the pipeline is ready.",
  },
  {
    title: "LLM method (prompt-based)",
    quickDefinition: "Uses a large language model to read meaning and assign labels, which can change run to run.",
    description:
      "Uses a hosted large language model with structured JSON prompts to assign labels and short rationales per chunk. What it uses: semantic reasoning over the transcript text via the model’s weights (not audio diarization). Strengths: handles varied wording and can supply explanations. Language support: for pasted transcripts, pick English or Farsi in the language control; the model uses dedicated English and Persian system prompts (same JSON schema). YouTube captions supply language automatically. Other languages may use the English prompt with an API note. Weaknesses: non-deterministic across runs, possible hallucinations, and sensitivity to prompt wording; not a substitute for domain validation. When it may fail: subtle logic, unstated assumptions, or chunks where the model overfits to keywords. It may disagree with heuristics because it interprets meaning more freely, or with a future classifier because training objectives differ.",
  },
  {
    title: "Why methods may disagree",
    quickDefinition: "Each method listens for different clues, so split votes usually mean “read the quote,” not “pick a winner.”",
    description:
      "Heuristics surface explicit cues; classifiers optimize for training distributions; LLMs infer loosely from natural language. The same chunk might trigger a rule, score high in a model, and be rejected by an LLM — or the reverse. Treat disagreement as a signal to read the source text, not as proof that one method is “right.” Compare outputs cautiously and avoid using any single method alone for high-stakes conclusions.",
  },
];

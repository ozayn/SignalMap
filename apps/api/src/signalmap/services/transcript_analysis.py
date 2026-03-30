"""
Experimental chunk-level transcript analysis (playground).

This layer will later support:
- Cognitive bias / fallacy detection (per-chunk or span-level classifiers)
- Political-direction clustering (embeddings + labels as weak supervision)
- Discourse-study ingestion (aligned spans into study schemas)

Modes ``frames`` and ``fallacies`` use keyword heuristics only: they are experimental
prototypes, not definitive classifiers, and are unsuitable for research claims without validation.

Dispatch is **language-aware**: each ``mode`` + ``method`` + normalized transcript language
(English / Persian / other) selects an implementation or returns ``analysis_supported: false``
with an explicit ``analysis_note`` when that combination is not implemented.

``fallacies`` heuristic mode uses English-only, hand-tuned pattern checks with context guards.
Persian heuristic rules are scaffolded (``FALLACY_KEYWORDS_FA``) but not wired to detectors yet.
It is a heuristic prototype (not a validated logical-fallacy classifier) and will miss real fallacies
and occasionally misfire; use ``label_matches`` for internal rule debugging only.

For ``mode="fallacies"``, use ``method`` to choose how fallacies are detected:

- ``heuristic`` — rule-based (English only today; Persian returns unsupported).
- ``classifier`` — reserved; returns ``analysis_supported: false`` until implemented.
- ``llm`` — Groq chat completion per chunk (English or Persian system prompt; default model
  aligns with ``GROQ_MODEL`` / ``GROQ_FALLACY_MODEL``; requires ``GROQ_API_KEY``; experimental).

Modes ``summarize_llm`` and ``speaker_guess_llm`` call Groq (see ``GROQ_API_KEY``). They are
**experimental prototypes** and not substitutes for manual review or validated classifiers.
Transcript fetch, chunking, and cache remain language-neutral; analysis applies language rules above.
"""

from __future__ import annotations

import re
from typing import Any, Literal, Optional

from fastapi import HTTPException

from signalmap.services.llm_transcript_analysis import (
    groq_fallacy_chunk_json,
    normalize_fallacy_llm_response,
    require_groq_api_key,
    run_speaker_guess_llm,
    run_summarize_llm,
)

_LLM_MODE_NOTE = (
    "Groq LLM mode (experimental prototype); not validated for research or moderation decisions."
)

# Normalized language for analysis routing (transcript or pasted ``language`` hint).
AnalysisLanguage = Literal["en", "fa", "other"]

_LLM_FALLACY_OTHER_LANG_NOTE = (
    "Fallacy LLM uses English prompt instructions; results may be less reliable for this "
    "transcript language."
)


def normalize_analysis_language(lang: Optional[str]) -> AnalysisLanguage:
    """
    Map caption pipeline codes or display names (``en``, ``en-US``, ``fa``, ``Persian``, …)
    to a coarse analysis locale. Unknown or missing values become ``other`` (do not assume English).
    """
    if not lang or not isinstance(lang, str):
        return "other"
    s = lang.strip().lower()
    if not s:
        return "other"
    if s == "en" or s.startswith("en-") or s.startswith("en_") or s.startswith("english"):
        return "en"
    if (
        s == "fa"
        or s.startswith("fa-")
        or s.startswith("fa_")
        or s == "fas"
        or "persian" in s
        or "farsi" in s
    ):
        return "fa"
    return "other"


# Fallacy detection backend when mode == "fallacies"
FALLACY_METHOD_HEURISTIC = "heuristic"
FALLACY_METHOD_CLASSIFIER = "classifier"
FALLACY_METHOD_LLM = "llm"
FALLACY_METHODS = frozenset(
    {FALLACY_METHOD_HEURISTIC, FALLACY_METHOD_CLASSIFIER, FALLACY_METHOD_LLM}
)


def _normalize_fallacy_method(method: Optional[str]) -> str:
    m = (method or FALLACY_METHOD_HEURISTIC).strip().lower()
    if m not in FALLACY_METHODS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported fallacy method: {method!r}. "
                f"Use one of: {', '.join(sorted(FALLACY_METHODS))}."
            ),
        )
    return m


def _chunks_passthrough_basic(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Echo chunks with timing and text only (no heuristic labels)."""
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        out.append(
            {
                "start": ch.get("start"),
                "end": ch.get("end"),
                "text": str(ch.get("text", "") or ""),
                "segment_count": ch.get("segment_count", 0),
            }
        )
    return out


def _merge_analysis_notes(*parts: Optional[str]) -> Optional[str]:
    bits = [p.strip() for p in parts if p and str(p).strip()]
    return " ".join(bits) if bits else None


# --- "frames" mode: simple substring triggers (English, case-insensitive) ---
FRAME_KEYWORDS_EN: dict[str, tuple[str, ...]] = {
    "praise": (
        "praise",
        "commend",
        "applaud",
        "brilliant",
        "hero",
        "proud of",
        "well done",
        "thank you",
        "grateful",
        "fantastic job",
    ),
    "geopolitics": (
        "nato",
        "ukraine",
        "russia",
        "china",
        "iran",
        "israel",
        "sanctions",
        "military",
        "alliance",
        "embassy",
        "nuclear",
        "missile",
        "geopolit",
        "border",
        "invasion",
    ),
    "conspiracy": (
        "conspiracy",
        "cover-up",
        "cover up",
        "false flag",
        "deep state",
        "they don't want you",
        "cabal",
        "hidden agenda",
        "mainstream media",
        "controlled opposition",
    ),
    "moral_outrage": (
        "outrageous",
        "disgusting",
        "shameful",
        "appalling",
        "horrifying",
        "how dare",
        "sickening",
        "abhorrent",
        "despicable",
    ),
    "policy_analysis": (
        "policy",
        "legislation",
        "bill",
        "senate",
        "congress",
        "regulation",
        "gdp",
        "inflation",
        "tax",
        "budget",
        "statute",
        "ballot",
        "mandate",
        "fiscal",
    ),
    "culture_war": (
        "woke",
        "wokeism",
        "cancel culture",
        "traditional values",
        "crt",
        "pronouns",
        "dei",
        "cultural marxism",
        "culture war",
    ),
}

# Placeholder for future Persian frame cues (do not run English frame keywords on Persian text).
FRAME_KEYWORDS_FA: dict[str, tuple[str, ...]] = {}

# --- "fallacies" mode: guarded phrase + cue heuristics (see module docstring) ---
_FALLACY_LABEL_ORDER: tuple[str, ...] = (
    "ad_hominem",
    "appeal_to_fear",
    "burden_shifting",
    "false_dilemma",
    "straw_man",
    "whataboutism",
)

_PERSON_TARGET = re.compile(
    r"\b(you|your|yours|you're|you've|he|him|his|she|her|they|them|their)\b",
    re.I,
)


# Insult tokens for ad_hominem (word-boundary); all matches are collected for label_matches.
_AD_HOMINEM_INSULTS: tuple[str, ...] = (
    "clown",
    "dishonest",
    "fool",
    "idiot",
    "liar",
    "moron",
    "nonsense",
    "pathetic",
    "stupid",
)

_AD_HOMINEM_TIER_A: tuple[str, ...] = (
    "ad hominem",
    "attack the person",
    "attack the messenger",
    "intellectually dishonest",
    "discredit the source",
    "look at who",
    "you're just a",
)


def _matching_insult_keywords(low: str, insults: tuple[str, ...]) -> list[str]:
    """Return every insult token that matches ``low`` (word-boundary), sorted, de-duplicated."""
    found: list[str] = []
    for w in insults:
        if re.search(rf"\b{re.escape(w)}\b", low):
            found.append(w)
    return sorted(set(found))


def _det_ad_hominem(low: str) -> Optional[tuple[list[str], str]]:
    """Explicit attack phrases, or person-target + one or more insults (not insult alone)."""
    tier_hits = [p for p in _AD_HOMINEM_TIER_A if p in low]
    if tier_hits:
        matches = sorted(set(tier_hits))
        st = "strong" if len(matches) >= 2 else "weak"
        return matches, st

    insult_hits = _matching_insult_keywords(low, _AD_HOMINEM_INSULTS)
    if not insult_hits:
        return None
    if not _PERSON_TARGET.search(low):
        return None
    # 1 insult → weak; 2+ distinct insult tokens → strong
    st = "strong" if len(insult_hits) >= 2 else "weak"
    return insult_hits, st


# Conversational straw-man reframes (ASCII apostrophe; input normalized first).
_STRAW_MAN_CORE: tuple[str, ...] = (
    "so you're saying",
    "so you are saying",
    "so you're basically saying",
    "so what you're saying is",
)

# With a core phrase present, these exaggeration cues bump strength to strong.
_STRAW_MAN_EXAGGERATION: tuple[str, ...] = (
    "do nothing",
    "let it collapse",
    "let the country collapse",
    "just let",
    "completely",
    "nothing at all",
)

_STRAW_MAN_OTHER: tuple[str, ...] = (
    "straw man",
    "strawman",
    "they want us to believe",
    "according to you",
    "you mean that",
    "that's not what i said",
    "twist my words",
    "never said that",
    "distort what",
)


def _normalize_straw_man_text(low: str) -> str:
    """Map common Unicode apostrophes to ASCII so ``you're`` patterns match typographic quotes."""
    return low.replace("\u2019", "'").replace("\u2018", "'").replace("\u2032", "'")


def _det_straw_man(low: str) -> Optional[tuple[list[str], str]]:
    """
    Reframing / misrepresentation cues. Core ``so you're saying``-style phrases alone → weak;
    same chunk plus exaggeration cues → strong. ``misrepresent`` still needs an extra anchor.
    """
    s = _normalize_straw_man_text(low)
    core_hits = [f"phrase:{p}" for p in _STRAW_MAN_CORE if p in s]
    exag_hits = [f"phrase:{p}" for p in _STRAW_MAN_EXAGGERATION if p in s]
    other_ms = [f"phrase:{p}" for p in _STRAW_MAN_OTHER if p in s]

    ms: list[str] = []
    if "misrepresent" in s:
        if core_hits or other_ms or re.search(
            r"\b(my words|your position|the argument|what i said|said that|my position)\b", s
        ):
            ms.append("phrase:misrepresent")

    ms.extend(other_ms)
    ms.extend(core_hits)
    if core_hits:
        # Only attach exaggeration hits when a core straw-man reframe is present.
        ms.extend(exag_hits)

    if not ms:
        return None

    ms = sorted(set(ms))

    if core_hits:
        st = "strong" if exag_hits else "weak"
    else:
        st = "strong" if len(ms) >= 2 else "weak"
    return ms, st


def _det_false_dilemma(low: str) -> Optional[tuple[list[str], str]]:
    """Explicit binary / only-two-options framing."""
    phrases = (
        "false dilemma",
        "false dichotomy",
        "either you're with us",
        "either or",
        "only two choices",
        "no middle ground",
        "black and white",
        "no other option",
        "no other choice",
        "must choose",
        "must pick",
    )
    ms = [f"phrase:{p}" for p in phrases if p in low]
    # Binary framing: either we … or we … / either you … or you … (common false-dilemma surface form)
    if re.search(r"\beither\s+we\b.{0,160}?\bor\s+we\b", low):
        ms.append("regex:either_we_or_we")
    if re.search(r"\beither\s+you\b.{0,160}?\bor\s+you\b", low):
        ms.append("regex:either_you_or_you")
    if not ms:
        return None
    ms = sorted(set(ms))
    st = "strong" if len(ms) >= 2 else "weak"
    return ms, st


def _det_whataboutism(low: str) -> Optional[tuple[list[str], str]]:
    """Phrase-led deflection patterns."""
    phrases = (
        "what about",
        "whataboutism",
        "but what about",
        "and what about",
        "and yet",
        "but when",
        "why don't you talk about",
        "why dont you talk about",
    )
    ms = [f"phrase:{p}" for p in phrases if p in low]
    if not ms:
        return None
    st = "strong" if len(ms) >= 2 else "weak"
    return ms, st


def _det_appeal_to_fear(low: str) -> Optional[tuple[list[str], str]]:
    """Avoid lone ``danger`` / ``threat`` / ``destroy``; prefer compounds or pairs."""
    ms: list[str] = []
    for p in (
        "appeal to fear",
        "be very afraid",
        "they're coming for",
        "existential threat",
        "wake up before it's too late",
        "wake up before it is too late",
        "millions will die",
        "lose the entire region",
        "never be safe",
        "will be destroyed",
    ):
        if p in low:
            ms.append(f"phrase:{p}")
    # "will die" only with mass-casualty or conditional framing (narrower than bare "die")
    if "will die" in low and (
        "million" in low or "thousand" in low or "if we" in low or "if you" in low or "don't stop" in low
    ):
        ms.append("phrase:will_die_conditional_or_mass")
    if "catastrophic" in low:
        ms.append("cue:catastrophic")
    if re.search(r"\bdanger\b", low) and re.search(
        r"\b(fear|warning|catastrophic|panic|terrifying|afraid)\b", low
    ):
        ms.append("combo:danger+fear_or_warning")
    if re.search(r"\bthreat\b", low) and re.search(
        r"\b(imminent|existential|grave|serious)\b", low
    ):
        ms.append("combo:threat+severity")
    if re.search(r"\bdestroy(ed)?\b", low) and re.search(
        r"\b(us|our|country|world|future|planet|america|democracy|nation|family)\b", low
    ):
        ms.append("combo:destroy+scope")
    if not ms:
        return None
    st = "strong" if len(ms) >= 2 else "weak"
    return ms, st


def _det_burden_shifting(low: str) -> Optional[tuple[list[str], str]]:
    """Explicit proof / evidence demands — not bare ``evidence``."""
    phrases = (
        "burden of proof",
        "prove it",
        "prove that",
        "where is your evidence",
        "where's your evidence",
        "show me the evidence",
        "you need to prove",
        "you have to prove",
        "you have to show",
        "onus is on",
    )
    ms = [f"phrase:{p}" for p in phrases if p in low]
    if not ms:
        return None
    st = "strong" if len(ms) >= 2 else "weak"
    return ms, st


_FALLACY_DETECTORS: dict[str, Any] = {
    "ad_hominem": _det_ad_hominem,
    "straw_man": _det_straw_man,
    "false_dilemma": _det_false_dilemma,
    "whataboutism": _det_whataboutism,
    "appeal_to_fear": _det_appeal_to_fear,
    "burden_shifting": _det_burden_shifting,
}

# Aggregated English cue phrases per label (documentation + future parity with FA scaffolding).
# Detectors above remain the source of truth for matching logic (regex + guards).
FALLACY_KEYWORDS_EN: dict[str, tuple[str, ...]] = {
    "ad_hominem": _AD_HOMINEM_TIER_A + _AD_HOMINEM_INSULTS,
    "straw_man": _STRAW_MAN_CORE + _STRAW_MAN_EXAGGERATION + _STRAW_MAN_OTHER,
    "false_dilemma": (
        "false dilemma",
        "false dichotomy",
        "either you're with us",
        "either or",
        "only two choices",
        "no middle ground",
        "black and white",
        "no other option",
        "no other choice",
        "must choose",
        "must pick",
    ),
    "whataboutism": (
        "what about",
        "whataboutism",
        "but what about",
        "and what about",
        "and yet",
        "but when",
        "why don't you talk about",
        "why dont you talk about",
    ),
    "appeal_to_fear": (
        "appeal to fear",
        "be very afraid",
        "they're coming for",
        "existential threat",
        "wake up before it's too late",
        "wake up before it is too late",
        "millions will die",
        "lose the entire region",
        "never be safe",
        "will be destroyed",
    ),
    "burden_shifting": (
        "burden of proof",
        "prove it",
        "prove that",
        "where is your evidence",
        "where's your evidence",
        "show me the evidence",
        "you need to prove",
        "you have to prove",
        "you have to show",
        "onus is on",
    ),
}

# Placeholder: Persian heuristic cues (not yet wired into detectors).
FALLACY_KEYWORDS_FA: dict[str, tuple[str, ...]] = {}


def _fallacy_analysis_for_text_en(text: str) -> tuple[list[str], dict[str, list[str]], dict[str, str]]:
    """
    Run all fallacy detectors on lowercased text. Labels sorted; ``label_matches`` holds
    human-readable rule hits for debugging.
    """
    if not text or not text.strip():
        return [], {}, {}
    low = text.lower()
    label_matches: dict[str, list[str]] = {}
    label_strengths: dict[str, str] = {}
    for label in _FALLACY_LABEL_ORDER:
        fn = _FALLACY_DETECTORS.get(label)
        if not fn:
            continue
        got = fn(low)
        if not got:
            continue
        matches, strength = got
        label_matches[label] = sorted(set(matches))
        label_strengths[label] = strength
    labels = sorted(label_matches.keys())
    matches_sorted = {k: label_matches[k] for k in labels}
    strengths_sorted = {k: label_strengths[k] for k in labels}
    return labels, matches_sorted, strengths_sorted


def _keyword_matches(low: str, kw: str) -> bool:
    """Substring match for phrases; word-boundary match for short single-token keywords."""
    k = kw.lower().strip()
    if not k:
        return False
    if " " in k:
        return k in low
    if len(k) <= 3:
        return bool(re.search(rf"\b{re.escape(k)}\b", low))
    return k in low


def _matching_keywords(low: str, keywords: tuple[str, ...]) -> list[str]:
    """Return sorted unique rule strings from ``keywords`` that match ``low``."""
    matched: list[str] = []
    for kw in keywords:
        if _keyword_matches(low, kw):
            matched.append(kw)
    return sorted(set(matched))


def _labels_and_matches(
    text: str,
    keyword_map: dict[str, tuple[str, ...]],
) -> tuple[list[str], dict[str, list[str]]]:
    """
    For each label, collect every keyword rule that fired (debugging / calibration).
    ``labels`` sorted; ``label_matches`` keys are those labels only.
    """
    if not text or not text.strip():
        return [], {}
    low = text.lower()
    label_matches: dict[str, list[str]] = {}
    for label, keywords in keyword_map.items():
        m = _matching_keywords(low, keywords)
        if m:
            label_matches[label] = m
    labels = sorted(label_matches.keys())
    # Stable JSON: keys sorted
    matches_sorted = {k: label_matches[k] for k in labels}
    return labels, matches_sorted


def _fallacy_summary_from_chunks(chunks: list[dict[str, Any]]) -> dict[str, int]:
    """
    Video-level fallacy summary: number of chunks tagged with each label (omit labels with
    zero counts for a compact JSON object).
    """
    counts: dict[str, int] = {}
    for ch in chunks:
        for lab in ch.get("labels") or []:
            counts[lab] = counts.get(lab, 0) + 1
    return dict(sorted((k, v) for k, v in counts.items() if v > 0))


def label_chunk_frames(text: str) -> list[str]:
    """
    Assign zero or more frame labels to a chunk using keyword substring rules.
    Labels are returned sorted alphabetically for stable output.

    English keyword lists only; callers analyzing non-English text should skip this
    (see ``normalize_analysis_language`` and ``_execute_transcript_analysis``).
    """
    labels, _ = _labels_and_matches(text, FRAME_KEYWORDS_EN)
    return labels


def label_chunk_fallacies(text: str) -> list[str]:
    """
    Prototype fallacy-style labels via guarded heuristics (experimental, not definitive).

    English detectors only; do not use for Persian text — use language-aware entry points instead.
    """
    labels, _, _ = _fallacy_analysis_for_text_en(text)
    return labels


def annotate_chunks_frames(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return new chunk dicts with ``labels`` and ``label_matches`` (frames mode)."""
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        labels, label_matches = _labels_and_matches(text, FRAME_KEYWORDS_EN)
        row = {
            "start": ch.get("start"),
            "end": ch.get("end"),
            "text": text,
            "segment_count": ch.get("segment_count", 0),
            "labels": labels,
            "label_matches": label_matches,
        }
        out.append(row)
    return out


def annotate_chunks_frames_skipped(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Same shape as frames mode without running English keyword rules (unsupported language)."""
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        out.append(
            {
                "start": ch.get("start"),
                "end": ch.get("end"),
                "text": text,
                "segment_count": ch.get("segment_count", 0),
                "labels": [],
                "label_matches": {},
            }
        )
    return out


def annotate_chunks_fallacies_skipped(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Same chunk shape as fallacies mode, but no English rules run (unsupported language).
    """
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        out.append(
            {
                "start": ch.get("start"),
                "end": ch.get("end"),
                "text": text,
                "segment_count": ch.get("segment_count", 0),
                "labels": [],
                "label_matches": {},
                "label_strengths": {},
            }
        )
    return out


def annotate_chunks_fallacies(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Fallacies mode: each chunk has ``labels``, ``label_matches``, and ``label_strengths``
    (``weak`` / ``strong`` from rule cues; see per-label detectors). Heuristic prototype only.
    """
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        labels, label_matches, label_strengths = _fallacy_analysis_for_text_en(text)
        row = {
            "start": ch.get("start"),
            "end": ch.get("end"),
            "text": text,
            "segment_count": ch.get("segment_count", 0),
            "labels": labels,
            "label_matches": label_matches,
            "label_strengths": label_strengths,
        }
        out.append(row)
    return out


def annotate_chunks_fallacies_llm(
    chunks: list[dict[str, Any]],
    *,
    analysis_language: AnalysisLanguage = "en",
) -> tuple[list[dict[str, Any]], Optional[str]]:
    """
    Per-chunk Groq LLM fallacy detection. Chunk shape matches ``annotate_chunks_fallacies``:
    ``labels``, ``label_matches`` (explanation text per label), ``label_strengths`` (low / medium / high).

    ``analysis_language`` selects the system prompt (English vs Persian vs default English for ``other``).

    On API or parse failure for a chunk, that chunk gets empty labels and an optional top-level note
    aggregates failures.
    """
    out: list[dict[str, Any]] = []
    failed = 0
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        base = {
            "start": ch.get("start"),
            "end": ch.get("end"),
            "text": text,
            "segment_count": ch.get("segment_count", 0),
        }
        if not text.strip():
            out.append(
                {
                    **base,
                    "labels": [],
                    "label_matches": {},
                    "label_strengths": {},
                }
            )
            continue
        raw = groq_fallacy_chunk_json(text, analysis_language=analysis_language)
        if not raw:
            failed += 1
            out.append(
                {
                    **base,
                    "labels": [],
                    "label_matches": {},
                    "label_strengths": {},
                }
            )
            continue
        labels, explanation, conf = normalize_fallacy_llm_response(raw)
        label_matches: dict[str, list[str]] = {}
        for lab in labels:
            label_matches[lab] = [explanation] if explanation else []
        label_strengths = {lab: conf for lab in labels}
        out.append(
            {
                **base,
                "labels": labels,
                "label_matches": label_matches,
                "label_strengths": label_strengths,
            }
        )

    note: Optional[str] = None
    if failed:
        note = (
            f"LLM request failed for {failed} chunk(s); those chunks have empty labels."
        )
    return out, note


def _execute_transcript_analysis(
    mode: str,
    *,
    analysis_lang: AnalysisLanguage,
    chunks_in: list[dict[str, Any]],
    full_transcript_text: str,
    fallacy_method: Optional[str],
) -> dict[str, Any]:
    """
    Core dispatch on ``mode`` × fallacy ``method`` × ``analysis_lang`` (``en`` / ``fa`` / ``other``).
    Returns chunk list, summary, support flags, and optional LLM payloads.
    """
    analysis_supported = True
    analysis_note: Optional[str] = None
    llm_summarize: Optional[dict[str, Any]] = None
    speaker_blocks: Optional[list[dict[str, Any]]] = None
    method_effective: Optional[str] = None
    chunks_out: list[dict[str, Any]]
    summary: dict[str, int]

    if mode == "frames":
        if analysis_lang == "en":
            chunks_out = annotate_chunks_frames(chunks_in)
        else:
            chunks_out = annotate_chunks_frames_skipped(chunks_in)
            analysis_supported = False
            analysis_note = (
                "Frame keyword analysis is not implemented for Persian yet."
                if analysis_lang == "fa"
                else "Frame keyword analysis is only available for English transcripts."
            )
        summary = {}
    elif mode == "fallacies":
        fm = _normalize_fallacy_method(fallacy_method)
        method_effective = fm
        if fm == FALLACY_METHOD_HEURISTIC:
            if analysis_lang == "en":
                chunks_out = annotate_chunks_fallacies(chunks_in)
                summary = _fallacy_summary_from_chunks(chunks_out)
            else:
                chunks_out = annotate_chunks_fallacies_skipped(chunks_in)
                summary = {}
                analysis_supported = False
                analysis_note = (
                    "Heuristic fallacy analysis is not implemented for Persian yet."
                    if analysis_lang == "fa"
                    else "Heuristic fallacy analysis is only available for English transcripts."
                )
        elif fm == FALLACY_METHOD_LLM:
            require_groq_api_key()
            chunks_out, llm_note = annotate_chunks_fallacies_llm(
                chunks_in, analysis_language=analysis_lang
            )
            summary = _fallacy_summary_from_chunks(chunks_out)
            extra = (
                _LLM_FALLACY_OTHER_LANG_NOTE if analysis_lang == "other" else None
            )
            analysis_note = _merge_analysis_notes(_LLM_MODE_NOTE, llm_note, extra)
        elif fm == FALLACY_METHOD_CLASSIFIER:
            chunks_out = annotate_chunks_fallacies_skipped(chunks_in)
            summary = {}
            analysis_supported = False
            analysis_note = "Classifier method is not implemented yet."
    elif mode == "summarize_llm":
        require_groq_api_key()
        llm_summarize, trunc_note = run_summarize_llm(
            full_text=full_transcript_text,
            analysis_language=analysis_lang,
        )
        chunks_out = _chunks_passthrough_basic(chunks_in)
        summary = {}
        analysis_note = _merge_analysis_notes(_LLM_MODE_NOTE, trunc_note)
    elif mode == "speaker_guess_llm":
        require_groq_api_key()
        speaker_blocks, sp_note, trunc_note = run_speaker_guess_llm(
            chunks_in, analysis_language=analysis_lang
        )
        chunks_out = _chunks_passthrough_basic(chunks_in)
        summary = {}
        analysis_note = _merge_analysis_notes(_LLM_MODE_NOTE, sp_note, trunc_note)
    else:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported analysis mode: {mode!r}. Supported: 'frames', 'fallacies', "
                "'summarize_llm', 'speaker_guess_llm'."
            ),
        )

    return {
        "chunks": chunks_out,
        "summary": summary,
        "analysis_supported": analysis_supported,
        "analysis_note": analysis_note,
        "llm_summarize": llm_summarize,
        "speaker_blocks": speaker_blocks,
        "method": method_effective,
    }


def run_transcript_analysis(
    url: str,
    mode: str,
    *,
    fallacy_method: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fetch transcript (cache-first), chunk, and run the requested analysis mode.

    When ``mode`` is ``fallacies``, ``fallacy_method`` selects ``heuristic``, ``classifier``, or
    ``llm`` (see module docstring). Ignored for other modes.

    Heuristic fallacies add per-chunk ``label_strengths`` and top-level ``summary`` (chunk counts
    per fallacy label). Routing uses ``normalize_analysis_language`` on the transcript language.
    """
    from signalmap.services.youtube_transcripts import get_transcript_for_url

    data = get_transcript_for_url(url)
    chunks_in = data.get("chunks") or []
    if not isinstance(chunks_in, list):
        chunks_in = []

    transcript_lang = data.get("language")
    if isinstance(transcript_lang, str):
        transcript_lang = transcript_lang.strip() or None
    else:
        transcript_lang = None

    analysis_lang = normalize_analysis_language(transcript_lang)
    exec_result = _execute_transcript_analysis(
        mode,
        analysis_lang=analysis_lang,
        chunks_in=chunks_in,
        full_transcript_text=str(data.get("transcript_text") or ""),
        fallacy_method=fallacy_method,
    )

    return {
        "video_id": data["video_id"],
        "title": data.get("title"),
        "language": data.get("language"),
        "cached": bool(data.get("_cached")),
        "chunks": exec_result["chunks"],
        "summary": exec_result["summary"],
        "fallback_used": bool(data.get("fallback_used")),
        "analysis_supported": exec_result["analysis_supported"],
        "analysis_note": exec_result["analysis_note"],
        "llm_summarize": exec_result["llm_summarize"],
        "speaker_blocks": exec_result["speaker_blocks"],
        "method": exec_result["method"],
    }


def run_transcript_analysis_from_text(
    text: str,
    mode: str,
    language: Optional[str],
    *,
    fallacy_method: Optional[str] = None,
) -> dict[str, Any]:
    """
    Analyze pasted transcript text: chunk with ``plain_text_to_analysis_chunks``, then the same
    logic as ``run_transcript_analysis``. No YouTube fetch; ``video_id`` is empty and ``cached``
    is false.
    """
    from signalmap.services.transcript_chunks import plain_text_to_analysis_chunks

    raw = (text or "").strip()
    if len(raw) < 50:
        raise HTTPException(
            status_code=422,
            detail="Transcript text is too short (minimum ~50 characters).",
        )

    lang = (language or "").strip() or None
    chunks_in = plain_text_to_analysis_chunks(raw)
    if not chunks_in:
        raise HTTPException(
            status_code=422,
            detail="Transcript text could not be chunked into usable segments.",
        )

    analysis_lang = normalize_analysis_language(lang)
    exec_result = _execute_transcript_analysis(
        mode,
        analysis_lang=analysis_lang,
        chunks_in=chunks_in,
        full_transcript_text=raw,
        fallacy_method=fallacy_method,
    )

    return {
        "video_id": "",
        "title": None,
        "language": lang,
        "cached": False,
        "chunks": exec_result["chunks"],
        "summary": exec_result["summary"],
        "fallback_used": False,
        "analysis_supported": exec_result["analysis_supported"],
        "analysis_note": exec_result["analysis_note"],
        "llm_summarize": exec_result["llm_summarize"],
        "speaker_blocks": exec_result["speaker_blocks"],
        "method": exec_result["method"],
    }

"""
Experimental chunk-level transcript analysis (playground).

This layer will later support:
- Cognitive bias / fallacy detection (per-chunk or span-level classifiers)
- Political-direction clustering (embeddings + labels as weak supervision)
- Discourse-study ingestion (aligned spans into study schemas)

Modes ``frames`` and ``fallacies`` use keyword heuristics only: they are experimental
prototypes, not definitive classifiers, and are unsuitable for research claims without validation.

``fallacies`` mode uses English-only, hand-tuned pattern checks with context guards. It is a
heuristic prototype (not a validated logical-fallacy classifier) and will miss real fallacies
and occasionally misfire; use ``label_matches`` for internal rule debugging only.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import HTTPException

# --- "frames" mode: simple substring triggers (English, case-insensitive) ---
_FRAME_KEYWORDS: dict[str, tuple[str, ...]] = {
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


def _matching_insult_keywords(low: str, insults: tuple[str, ...]) -> list[str]:
    """Return every insult token that matches ``low`` (word-boundary), sorted, de-duplicated."""
    found: list[str] = []
    for w in insults:
        if re.search(rf"\b{re.escape(w)}\b", low):
            found.append(w)
    return sorted(set(found))


def _det_ad_hominem(low: str) -> Optional[tuple[list[str], str]]:
    """Explicit attack phrases, or person-target + one or more insults (not insult alone)."""
    tier_a = (
        "ad hominem",
        "attack the person",
        "attack the messenger",
        "intellectually dishonest",
        "discredit the source",
        "look at who",
        "you're just a",
    )
    tier_hits = [p for p in tier_a if p in low]
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
    if not ms:
        return None
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
    ):
        if p in low:
            ms.append(f"phrase:{p}")
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
    if re.search(r"\bdestroy\b", low) and re.search(
        r"\b(us|our|country|world|future|planet|america|democracy|nation)\b", low
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


def _fallacy_analysis_for_text(text: str) -> tuple[list[str], dict[str, list[str]], dict[str, str]]:
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


def _language_is_english_for_fallacy_analysis(lang: Optional[str]) -> bool:
    """
    Fallacy heuristics are English-only. ``language`` is the transcript language code
    or display name from the caption pipeline (e.g. ``en``, ``en-US``, ``English``).
    """
    if not lang or not isinstance(lang, str):
        return False
    s = lang.strip().lower()
    if not s:
        return False
    if s == "en" or s.startswith("en-") or s.startswith("en_"):
        return True
    return s.startswith("english")


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
    """
    labels, _ = _labels_and_matches(text, _FRAME_KEYWORDS)
    return labels


def label_chunk_fallacies(text: str) -> list[str]:
    """
    Prototype fallacy-style labels via guarded heuristics (experimental, not definitive).
    """
    labels, _, _ = _fallacy_analysis_for_text(text)
    return labels


def annotate_chunks_frames(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return new chunk dicts with ``labels`` and ``label_matches`` (frames mode)."""
    out: list[dict[str, Any]] = []
    for ch in chunks:
        if not isinstance(ch, dict):
            continue
        text = str(ch.get("text", "") or "")
        labels, label_matches = _labels_and_matches(text, _FRAME_KEYWORDS)
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
        labels, label_matches, label_strengths = _fallacy_analysis_for_text(text)
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


def run_transcript_analysis(url: str, mode: str) -> dict[str, Any]:
    """
    Fetch transcript (cache-first), chunk, and run the requested analysis mode.

    Fallacies mode also adds per-chunk ``label_strengths`` and top-level ``summary`` (chunk counts
    per fallacy label, non-zero counts only).
    English-only fallacy heuristics are skipped for non-English transcripts (see ``analysis_supported``).
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

    analysis_supported = True
    analysis_note: Optional[str] = None

    if mode == "frames":
        chunks_out = annotate_chunks_frames(chunks_in)
        summary: dict[str, int] = {}
    elif mode == "fallacies":
        if _language_is_english_for_fallacy_analysis(transcript_lang):
            chunks_out = annotate_chunks_fallacies(chunks_in)
            summary = _fallacy_summary_from_chunks(chunks_out)
        else:
            chunks_out = annotate_chunks_fallacies_skipped(chunks_in)
            summary = {}
            analysis_supported = False
            analysis_note = (
                "Fallacies mode is currently implemented only for English transcripts."
            )
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported analysis mode: {mode!r}. Supported: 'frames', 'fallacies'.",
        )

    return {
        "video_id": data["video_id"],
        "title": data.get("title"),
        "language": data.get("language"),
        "cached": bool(data.get("_cached")),
        "chunks": chunks_out,
        "summary": summary,
        "fallback_used": bool(data.get("fallback_used")),
        "analysis_supported": analysis_supported,
        "analysis_note": analysis_note,
    }


def run_transcript_analysis_from_text(
    text: str,
    mode: str,
    language: Optional[str],
) -> dict[str, Any]:
    """
    Analyze pasted transcript text: chunk with ``plain_text_to_analysis_chunks``, then the same
    frames/fallacies heuristics as ``run_transcript_analysis``. No YouTube fetch; ``video_id``
    is empty and ``cached`` is false.
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

    analysis_supported = True
    analysis_note: Optional[str] = None

    if mode == "frames":
        chunks_out = annotate_chunks_frames(chunks_in)
        summary: dict[str, int] = {}
    elif mode == "fallacies":
        if _language_is_english_for_fallacy_analysis(lang):
            chunks_out = annotate_chunks_fallacies(chunks_in)
            summary = _fallacy_summary_from_chunks(chunks_out)
        else:
            chunks_out = annotate_chunks_fallacies_skipped(chunks_in)
            summary = {}
            analysis_supported = False
            analysis_note = (
                "Fallacies mode is currently implemented only for English transcripts."
            )
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported analysis mode: {mode!r}. Supported: 'frames', 'fallacies'.",
        )

    return {
        "video_id": "",
        "title": None,
        "language": lang,
        "cached": False,
        "chunks": chunks_out,
        "summary": summary,
        "fallback_used": False,
        "analysis_supported": analysis_supported,
        "analysis_note": analysis_note,
    }

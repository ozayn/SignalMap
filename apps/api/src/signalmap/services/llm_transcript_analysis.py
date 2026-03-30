"""
Experimental Groq-backed transcript analysis (prototype).

Uses ``GROQ_API_KEY`` and the OpenAI-compatible Chat Completions API at Groq. Outputs are
**not** ground truth: models can hallucinate labels, miss content, or mis-attribute speakers.
All behavior is intended for internal exploration only.

If ``GROQ_API_KEY`` is unset, callers must surface a clear error (see ``require_groq_api_key``).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import httpx
from fastapi import HTTPException

log = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
# Per-chunk fallacy detection (explicit product default; override with GROQ_FALLACY_MODEL).
FALLACY_GROQ_MODEL = (os.getenv("GROQ_FALLACY_MODEL") or "llama-3.1-70b-versatile").strip() or "llama-3.1-70b-versatile"

FALLACY_LLM_SYSTEM_PROMPT = """You are a precise analyst of argumentation and logical fallacies.
Identify whether the given text contains any of the following fallacies:

- ad_hominem
- straw_man
- false_dilemma
- whataboutism
- appeal_to_fear
- burden_shifting

Return ONLY valid JSON in this format:
{
  "labels": ["..."],
  "explanation": "...",
  "confidence": "low" | "medium" | "high"
}

Examples of clear cases (when the text is plainly like this, it usually warrants a label):
- direct personal attacks on someone instead of engaging their argument → ad_hominem
- "so you're saying..." style reframing that exaggerates or misstates an opponent's position → straw_man
- explicit either/or framing that limits the situation to only two options → false_dilemma
- redirecting criticism or changing the subject with "what about..." → whataboutism
- exaggerated catastrophic predictions clearly meant to provoke fear (not calm risk analysis) → appeal_to_fear
- demanding the other side prove your claim for you, or shifting the burden of proof unfairly → burden_shifting

If a chunk clearly matches one of these patterns, assign the label rather than defaulting to no labels.

Rules:
- Only assign a fallacy label if there is clear and explicit evidence in the text.
- If the text is neutral, analytical, or ambiguous, return no labels.
- Do not over-interpret or infer intent beyond what is clearly stated.
- Do not label general warnings, predictions, or risk discussions as appeal_to_fear unless they are exaggerated, emotionally manipulative, or clearly intended to provoke fear.
- Do not label structured comparisons or policy framing as false_dilemma unless the text explicitly limits the situation to only two choices.
- Only include labels that are clearly present
- If none are present, return an empty list
- Do not invent new labels
- For each label, provide a short, specific explanation referencing the exact phrase or reasoning in the text that triggered the label.
- Avoid generic explanations such as 'this is a fallacy' — instead explain what in the text makes it a fallacy.
- Be conservative"""

# Fallacies LLM: only these labels (subset of heuristic set; no "extra" labels).
FALLACY_LLM_LABELS: tuple[str, ...] = (
    "ad_hominem",
    "straw_man",
    "false_dilemma",
    "whataboutism",
    "appeal_to_fear",
    "burden_shifting",
)
FALLACY_LLM_LABEL_SET = frozenset(FALLACY_LLM_LABELS)

# Speaker inference: transcript-only roles (not diarization).
SPEAKER_ROLE_SET = frozenset(
    {
        "HOST",
        "GUEST",
        "MODERATOR",
        "SPEAKER_A",
        "SPEAKER_B",
    }
)

CONFIDENCE_WORDS = frozenset({"low", "medium", "high"})

# Rough transcript cap per request (chars) to stay within context limits; prototype only.
_MAX_TRANSCRIPT_CHARS = 80_000

# --- Temporary LLM fallacy debug (set GROQ_FALLACY_LLM_DEBUG=1). Remove when no longer needed. ---
def _fallacy_llm_debug_enabled() -> bool:
    return (os.getenv("GROQ_FALLACY_LLM_DEBUG") or "").strip().lower() in ("1", "true", "yes")


_fallacy_debug_chunk_seq = 0


def require_groq_api_key() -> str:
    """Return a non-empty Groq API key or raise ``HTTPException`` with a clear message."""
    key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not set. Set it in the environment for LLM transcript modes.",
        )
    return key


def _groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if len(lines) >= 2 and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def _parse_json_object(content: str) -> Optional[dict[str, Any]]:
    """Parse JSON object from model output; return None on failure."""
    try:
        s = _strip_code_fence(content)
        data = json.loads(s)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def groq_chat_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 8192,
    model: Optional[str] = None,
    fallacy_debug: bool = False,
) -> dict[str, Any]:
    """
    Call Groq chat completions and parse a JSON object from the assistant message.
    On HTTP/parse error, returns ``{}`` (caller should treat as empty/safe default).

    ``fallacy_debug``: when True, log raw assistant text and parse outcome (see GROQ_FALLACY_LLM_DEBUG).
    """
    key = require_groq_api_key()
    model_name = (model or "").strip() or _groq_model()
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.RequestError as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] httpx.RequestError: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq request failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"Groq request failed: {e!s}",
        ) from e

    if r.status_code >= 400:
        try:
            err_body = r.json()
            msg = err_body.get("error", {}).get("message") if isinstance(err_body, dict) else None
        except Exception:
            msg = None
        detail = msg or r.text[:500] or f"HTTP {r.status_code}"
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] Groq HTTP error %s: %s",
                r.status_code,
                detail,
            )
        log.warning("Groq API error %s: %s", r.status_code, detail)
        raise HTTPException(status_code=502, detail=f"Groq API error: {detail}")

    try:
        body = r.json()
        choices = body.get("choices") or []
        if not choices:
            if fallacy_debug:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] empty choices[] in Groq response body")
            return {}
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content")
        if not isinstance(content, str):
            if fallacy_debug:
                log.warning(
                    "[GROQ_FALLACY_LLM_DEBUG] assistant content missing or not str (type=%s)",
                    type(content).__name__,
                )
            return {}
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] raw assistant content (%s chars):\n%s",
                len(content),
                content,
            )
        parsed = _parse_json_object(content)
        if fallacy_debug:
            if parsed is None or not isinstance(parsed, dict):
                log.warning(
                    "[GROQ_FALLACY_LLM_DEBUG] _parse_json_object failed or non-dict; got %r",
                    parsed,
                )
            else:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] parsed JSON object: %s", parsed)
        return parsed if isinstance(parsed, dict) else {}
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] exception reading/parsing Groq response: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq response parse failed: %s", e)
        return {}


def groq_chat_json_safe(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    max_tokens: int = 1024,
    model: Optional[str] = None,
    fallacy_debug: bool = False,
) -> dict[str, Any]:
    """
    Like ``groq_chat_json`` but never raises: returns ``{}`` on HTTP errors or ``HTTPException``.
    """
    try:
        return groq_chat_json(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            model=model,
            fallacy_debug=fallacy_debug,
        )
    except HTTPException as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] groq_chat_json_safe caught HTTPException: %s: %s",
                type(e).__name__,
                e.detail,
            )
        log.warning("Groq safe-mode failure: %s", e.detail)
        return {}
    except Exception as e:
        if fallacy_debug:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] groq_chat_json_safe caught unexpected: %s: %s",
                type(e).__name__,
                e,
            )
        log.warning("Groq safe-mode unexpected failure: %s", e)
        return {}


# Per-chunk fallacy prompt; keep under Groq context limits.
_MAX_FALLACY_CHUNK_CHARS = 12_000


def groq_fallacy_chunk_json(chunk_text: str) -> dict[str, Any]:
    """
    One Groq chat completion per chunk using ``FALLACY_LLM_SYSTEM_PROMPT``.
    Returns parsed JSON object or ``{}`` on failure / empty input.

    Set env ``GROQ_FALLACY_LLM_DEBUG=1`` for verbose logging (temporary; see module header).
    """
    global _fallacy_debug_chunk_seq
    t = (chunk_text or "").strip()
    if not t:
        return {}
    if len(t) > _MAX_FALLACY_CHUNK_CHARS:
        t = t[:_MAX_FALLACY_CHUNK_CHARS]
    user = f"Text:\n{t}"

    dbg = _fallacy_llm_debug_enabled()
    if dbg:
        _fallacy_debug_chunk_seq += 1
        if _fallacy_debug_chunk_seq == 1:
            log.warning("[GROQ_FALLACY_LLM_DEBUG] --- first chunk INPUT text ---\n%s", t)

    raw = groq_chat_json_safe(
        system=FALLACY_LLM_SYSTEM_PROMPT,
        user=user,
        temperature=0.2,
        max_tokens=1024,
        model=FALLACY_GROQ_MODEL,
        fallacy_debug=dbg,
    )

    if dbg:
        labels, explanation, conf = normalize_fallacy_llm_response(raw)
        if _fallacy_debug_chunk_seq == 1:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] --- first chunk NORMALIZED --- labels=%s confidence=%s explanation_len=%s",
                labels,
                conf,
                len(explanation),
            )
            if explanation:
                log.warning("[GROQ_FALLACY_LLM_DEBUG] normalized explanation: %s", explanation)
        else:
            log.warning(
                "[GROQ_FALLACY_LLM_DEBUG] chunk #%s normalized labels=%s",
                _fallacy_debug_chunk_seq,
                labels,
            )

    return raw


def normalize_fallacy_llm_response(raw: dict[str, Any]) -> tuple[list[str], str, str]:
    """
    Map model JSON to ``labels`` (allowed set only), ``explanation`` string, and
    ``confidence`` in ``low`` | ``medium`` | ``high``.
    """
    labels: list[str] = []
    for x in raw.get("labels") or []:
        if isinstance(x, str):
            lab = x.strip()
            if lab in FALLACY_LLM_LABEL_SET and lab not in labels:
                labels.append(lab)
    labels.sort()
    exp_raw = raw.get("explanation")
    if isinstance(exp_raw, list):
        explanation = " ".join(str(x).strip() for x in exp_raw if str(x).strip())
    elif isinstance(exp_raw, str):
        explanation = exp_raw.strip()
    else:
        explanation = str(exp_raw or "").strip()
    c = raw.get("confidence")
    if isinstance(c, str) and c.strip().lower() in CONFIDENCE_WORDS:
        conf = c.strip().lower()
    else:
        conf = "low"
    return labels, explanation, conf


def _truncate_for_llm(text: str) -> tuple[str, bool]:
    t = text or ""
    if len(t) <= _MAX_TRANSCRIPT_CHARS:
        return t, False
    return t[:_MAX_TRANSCRIPT_CHARS], True


def _build_chunk_manifest(chunks: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for i, ch in enumerate(chunks):
        if not isinstance(ch, dict):
            continue
        start = ch.get("start")
        end = ch.get("end")
        t = str(ch.get("text", "") or "")
        lines.append(f"--- Chunk index {i} (start={start!r}, end={end!r}) ---\n{t}\n")
    return "\n".join(lines)


def validate_summarize_output(obj: Any) -> dict[str, Any]:
    """Return a dict with summary_short, summary_bullets, main_topics (safe defaults)."""
    out: dict[str, Any] = {
        "summary_short": "",
        "summary_bullets": [],
        "main_topics": [],
    }
    if not isinstance(obj, dict):
        return out
    ss = obj.get("summary_short")
    out["summary_short"] = ss.strip() if isinstance(ss, str) else ""
    bullets = obj.get("summary_bullets")
    if isinstance(bullets, list):
        out["summary_bullets"] = [str(x).strip() for x in bullets if str(x).strip()][:20]
    topics = obj.get("main_topics")
    if isinstance(topics, list):
        out["main_topics"] = [str(x).strip() for x in topics if str(x).strip()][:20]
    return out


def run_summarize_llm(
    *,
    full_text: str,
) -> tuple[dict[str, Any], Optional[str]]:
    """
    Produce a short summary, bullets, and main topics. Returns ``(llm_summarize_dict, note_extra)``.
    """
    text, truncated = _truncate_for_llm(full_text)
    note = None
    if truncated:
        note = "Transcript truncated for LLM context (prototype limit)."

    system = (
        "You are a careful assistant for internal transcript review. "
        "Respond with a single JSON object only (no markdown, no prose outside JSON). "
        "Keys: summary_short (string, 2-4 sentences), summary_bullets (array of 3-8 short strings), "
        "main_topics (array of 3-8 short topic strings). "
        "Be faithful to the transcript; do not invent facts."
    )
    user = (
        "Summarize the following transcript text for internal analysis.\n\n"
        f"TRANSCRIPT:\n{text}"
    )
    raw = groq_chat_json(system=system, user=user, temperature=0.25, max_tokens=2048)
    validated = validate_summarize_output(raw)
    return validated, note


def _validate_speaker_block(row: Any) -> Optional[dict[str, Any]]:
    if not isinstance(row, dict):
        return None
    sp = row.get("speaker")
    if not isinstance(sp, str):
        return None
    speaker = sp.strip().upper().replace(" ", "_").replace("-", "_")
    if speaker not in SPEAKER_ROLE_SET:
        return None
    text = row.get("text")
    if not isinstance(text, str) or not text.strip():
        return None
    conf_raw = row.get("confidence")
    conf: str | float
    if isinstance(conf_raw, str) and conf_raw.strip().lower() in CONFIDENCE_WORDS:
        conf = conf_raw.strip().lower()
    elif isinstance(conf_raw, (int, float)) and 0.0 <= float(conf_raw) <= 1.0:
        conf = float(conf_raw)
    else:
        conf = "medium"
    return {"speaker": speaker, "text": text.strip(), "confidence": conf}


def validate_speaker_guess_output(obj: Any) -> tuple[list[dict[str, Any]], str]:
    """Return speaker_blocks and analysis_note (default note if missing)."""
    default_note = "Speaker roles inferred from transcript text only; not audio diarization."
    blocks: list[dict[str, Any]] = []
    if isinstance(obj, dict):
        raw_blocks = obj.get("speaker_blocks")
        if isinstance(raw_blocks, list):
            for row in raw_blocks[:200]:
                vb = _validate_speaker_block(row)
                if vb:
                    blocks.append(vb)
        note = obj.get("analysis_note")
        if isinstance(note, str) and note.strip():
            return blocks, note.strip()
    return blocks, default_note


def run_speaker_guess_llm(chunks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str, Optional[str]]:
    """
    Infer approximate speaker roles from text only. Returns ``speaker_blocks``, ``analysis_note``, truncation note.
    """
    manifest = _build_chunk_manifest(chunks)
    manifest, truncated = _truncate_for_llm(manifest)
    trunc_note = "Transcript truncated for LLM context (prototype limit)." if truncated else None

    system = (
        "You are helping with an internal prototype: infer likely speaker roles from transcript text ONLY. "
        "This is NOT diarization and NOT ground truth. "
        "Respond with a single JSON object: "
        '{"speaker_blocks": [ {"speaker": "HOST"|"GUEST"|"MODERATOR"|"SPEAKER_A"|"SPEAKER_B", '
        '"text": "<verbatim or lightly edited excerpt from transcript>", "confidence": "low"|"medium"|"high" } ], '
        '"analysis_note": "<one sentence explaining uncertainty>" } '
        "Use only the listed speaker values. If unsure, use lower confidence. "
        "Do not claim certainty about who spoke when."
    )
    user = (
        "Infer approximate speaker blocks from the following transcript chunks. "
        "Text-only; no audio.\n\n" + manifest
    )
    raw = groq_chat_json(system=system, user=user, temperature=0.3, max_tokens=8192)
    blocks, note = validate_speaker_guess_output(raw)
    return blocks, note, trunc_note

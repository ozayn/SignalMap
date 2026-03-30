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
) -> dict[str, Any]:
    """
    Call Groq chat completions and parse a JSON object from the assistant message.
    On HTTP/parse error, returns ``{}`` (caller should treat as empty/safe default).
    """
    key = require_groq_api_key()
    model = _groq_model()
    payload: dict[str, Any] = {
        "model": model,
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
        log.warning("Groq API error %s: %s", r.status_code, detail)
        raise HTTPException(status_code=502, detail=f"Groq API error: {detail}")

    try:
        body = r.json()
        choices = body.get("choices") or []
        if not choices:
            return {}
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content")
        if not isinstance(content, str):
            return {}
        parsed = _parse_json_object(content)
        return parsed if isinstance(parsed, dict) else {}
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
        log.warning("Groq response parse failed: %s", e)
        return {}


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


def _normalize_confidence(val: Any) -> dict[str, Any]:
    """Return a small object for JSON: prefer float 0-1, else string label."""
    if isinstance(val, (int, float)):
        c = float(val)
        if 0.0 <= c <= 1.0:
            return {"confidence": round(c, 4)}
    if isinstance(val, str):
        s = val.strip().lower()
        if s in CONFIDENCE_WORDS:
            return {"confidence": s}
        return {"confidence": s}
    return {"confidence": 0.0}


def _validate_evidence_spans(val: Any) -> list[str]:
    if not isinstance(val, list):
        return []
    out: list[str] = []
    for x in val[:12]:
        if isinstance(x, str) and x.strip():
            out.append(x.strip()[:2000])
    return out


def validate_fallacy_chunk_row(row: Any) -> dict[str, Any]:
    """Normalize one chunk's LLM fallacy output."""
    out: dict[str, Any] = {
        "labels": [],
        "reasoning": "",
        "evidence_spans": [],
        "confidence": 0.0,
    }
    if not isinstance(row, dict):
        return out
    labels = row.get("labels")
    if isinstance(labels, list):
        clean: list[str] = []
        for x in labels:
            if not isinstance(x, str):
                continue
            lab = x.strip()
            if lab in FALLACY_LLM_LABEL_SET and lab not in clean:
                clean.append(lab)
        clean.sort()
        out["labels"] = clean
    r = row.get("reasoning")
    out["reasoning"] = r.strip() if isinstance(r, str) else ""
    out["evidence_spans"] = _validate_evidence_spans(row.get("evidence_spans"))
    conf = _normalize_confidence(row.get("confidence"))
    out["confidence"] = conf.get("confidence", 0.0)
    return out


def run_fallacies_llm(chunks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int], Optional[str]]:
    """
    Per-chunk fallacy labels via LLM. Returns annotated chunks (merged with timing/text),
    summary counts per label, and optional note if truncated.
    """
    manifest = _build_chunk_manifest(chunks)
    manifest, truncated = _truncate_for_llm(manifest)
    note = "Transcript truncated for LLM context (prototype limit)." if truncated else None

    allowed = ", ".join(FALLACY_LLM_LABELS)
    system = (
        "You are an assistant for experimental rhetorical tagging on transcripts (internal prototype only). "
        "Classify each chunk using ONLY these labels when clearly supported by the chunk text: "
        f"{allowed}. "
        "Use an empty labels array when none apply. Do not invent fallacies. "
        "Respond with a single JSON object: "
        '{"chunks": [ {"chunk_index": <int>, "labels": [...], "reasoning": "<short string>", '
        '"evidence_spans": ["<short quote from chunk>", ...], "confidence": <number 0-1> } ] } '
        "chunk_index must match the chunk index provided. "
        "evidence_spans must be short fragments copied from that chunk only."
    )
    user = (
        "Analyze each chunk below. Return JSON only.\n\n" + manifest
    )
    raw = groq_chat_json(system=system, user=user, temperature=0.15, max_tokens=8192)
    rows_out: list[dict[str, Any]] = []
    by_index: dict[int, dict[str, Any]] = {}

    chunks_arr = raw.get("chunks") if isinstance(raw, dict) else None
    if isinstance(chunks_arr, list):
        for row in chunks_arr:
            if not isinstance(row, dict):
                continue
            idx = row.get("chunk_index")
            if isinstance(idx, float) and idx == int(idx):
                idx = int(idx)
            if isinstance(idx, int) and 0 <= idx < len(chunks):
                by_index[idx] = validate_fallacy_chunk_row(row)

    for i, ch in enumerate(chunks):
        if not isinstance(ch, dict):
            continue
        base = {
            "start": ch.get("start"),
            "end": ch.get("end"),
            "text": str(ch.get("text", "") or ""),
            "segment_count": ch.get("segment_count", 0),
        }
        extra = by_index.get(i) or validate_fallacy_chunk_row({})
        merged = {
            **base,
            "labels": extra["labels"],
            "reasoning": extra["reasoning"],
            "evidence_spans": extra["evidence_spans"],
            "confidence": extra["confidence"],
        }
        rows_out.append(merged)

    summary: dict[str, int] = {}
    for ch in rows_out:
        for lab in ch.get("labels") or []:
            if isinstance(lab, str):
                summary[lab] = summary.get(lab, 0) + 1
    summary = dict(sorted((k, v) for k, v in summary.items() if v > 0))

    return rows_out, summary, note


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

"""
Time-window chunking for YouTube transcript segments.

Downstream uses:
- Cognitive bias / fallacy detection (manageable spans per classifier)
- Political-direction clustering (embedding-friendly units)
- Discourse-study ingestion (aligned spans with optional audio overlap)
"""

from __future__ import annotations

import re
from typing import Any

_WS_RE = re.compile(r"\s+")


def clean_chunk_text(text: str) -> str:
    """Normalize whitespace: strip, collapse runs of spaces, trim."""
    if not text:
        return ""
    text = text.strip()
    text = _WS_RE.sub(" ", text)
    return text.strip()


def _segment_start(seg: dict[str, Any], index: int) -> float:
    """Parse segment start time, or use ordered synthetic times when missing."""
    raw = seg.get("start")
    if raw is not None:
        try:
            return float(raw)
        except (TypeError, ValueError):
            pass
    return float(index)


def chunk_transcript_segments(segments: list[dict], window_seconds: int = 45) -> list[dict[str, Any]]:
    """
    Group transcript segments into fixed, non-overlapping time windows on the timeline.

    Each segment is assigned to bucket ``floor(start // window_seconds)`` using its
    ``start`` time (seconds). Segments without ``start`` use synthetic times ``index``
    so order is preserved. Text within a bucket is joined in chronological order,
    then cleaned; buckets with no text after cleaning are omitted.

    Output chunk ``start`` / ``end`` are the window boundaries ``[k*ws, (k+1)*ws)``.
    """
    if window_seconds <= 0:
        raise ValueError("window_seconds must be positive")
    ws = float(window_seconds)
    if not segments:
        return []

    buckets: dict[int, list[tuple[float, dict[str, Any]]]] = {}
    for i, seg in enumerate(segments):
        if not isinstance(seg, dict):
            continue
        start = _segment_start(seg, i)
        b = int(start // ws)
        buckets.setdefault(b, []).append((start, seg))

    for b in buckets:
        buckets[b].sort(key=lambda x: x[0])

    out: list[dict[str, Any]] = []
    for b in sorted(buckets.keys()):
        pieces: list[str] = []
        for _, seg in buckets[b]:
            t = seg.get("text")
            if t is not None and str(t).strip():
                pieces.append(str(t))
        joined = clean_chunk_text(" ".join(pieces))
        if not joined:
            continue
        chunk_start = float(b) * ws
        chunk_end = float(b + 1) * ws
        out.append(
            {
                "start": chunk_start,
                "end": chunk_end,
                "text": joined,
                "segment_count": len(buckets[b]),
            }
        )
    return out


def plain_text_to_analysis_chunks(text: str, window_seconds: int = 45) -> list[dict[str, Any]]:
    """
    Chunk arbitrary pasted transcript text (no video timestamps) using the same time-window
    grouping as YouTube segments: paragraphs are placed on a synthetic timeline so
    ``chunk_transcript_segments`` can merge windows identically to the caption pipeline.
    """
    text = clean_chunk_text(text)
    if not text:
        return []
    parts = re.split(r"\n\s*\n+", text.strip())
    parts = [clean_chunk_text(p) for p in parts if clean_chunk_text(p)]
    if not parts:
        parts = [text]
    max_chars = 2500
    expanded: list[str] = []
    for p in parts:
        if len(p) <= max_chars:
            expanded.append(p)
        else:
            for i in range(0, len(p), max_chars):
                expanded.append(p[i : i + max_chars])
    segments: list[dict[str, Any]] = []
    ws = float(window_seconds)
    for i, p in enumerate(expanded):
        segments.append({"text": p, "start": float(i) * ws})
    return chunk_transcript_segments(segments, window_seconds=window_seconds)

"""Language-aware routing for transcript analysis (no Groq)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from signalmap.services.transcript_analysis import (  # noqa: E402
    normalize_analysis_language,
    run_transcript_analysis_from_text,
)


def test_normalize_analysis_language() -> None:
    assert normalize_analysis_language("en") == "en"
    assert normalize_analysis_language("en-US") == "en"
    assert normalize_analysis_language("English") == "en"
    assert normalize_analysis_language("fa") == "fa"
    assert normalize_analysis_language("fa-IR") == "fa"
    assert normalize_analysis_language("Persian") == "fa"
    assert normalize_analysis_language("Farsi") == "fa"
    assert normalize_analysis_language(None) == "other"
    assert normalize_analysis_language("") == "other"
    assert normalize_analysis_language("de") == "other"


def test_heuristic_fallacy_persian_not_run() -> None:
    text = "x" * 80
    result = run_transcript_analysis_from_text(
        text,
        "fallacies",
        "fa",
        fallacy_method="heuristic",
    )
    assert result["analysis_supported"] is False
    assert "Persian" in (result.get("analysis_note") or "")
    for ch in result.get("chunks") or []:
        assert ch.get("labels") == []


def test_frames_persian_not_run() -> None:
    text = "x" * 80
    result = run_transcript_analysis_from_text(
        text,
        "frames",
        "fa-IR",
        fallacy_method="heuristic",
    )
    assert result["analysis_supported"] is False
    assert "Frame" in (result.get("analysis_note") or "")
    for ch in result.get("chunks") or []:
        assert ch.get("labels") == []

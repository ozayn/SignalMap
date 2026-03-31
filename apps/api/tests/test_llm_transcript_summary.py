"""Unit tests for Groq transcript summarization (summarize_llm). Groq is mocked — no API key required."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import signalmap.services.llm_transcript_analysis as _lta  # noqa: E402
import signalmap.services.transcript_analysis as _ta  # noqa: E402

from fastapi import HTTPException  # noqa: E402

from signalmap.services.llm_transcript_summary import (  # noqa: E402
    LLM_SUMMARY_TRUNCATION_NOTE,
    run_transcript_summary_llm,
    validate_summarize_output,
)


def test_validate_summarize_output_parses_expected_keys() -> None:
    raw = {
        "summary_short": "  One sentence. ",
        "summary_bullets": [" a ", "b", "", 3],
        "summary_paragraphs": [" Para one ", "Para two"],
        "main_topics": ["Topic A", "Topic B"],
    }
    out = validate_summarize_output(raw)
    assert out["summary_short"] == "One sentence."
    assert out["summary_bullets"] == ["a", "b", "3"]
    assert out["summary_paragraphs"] == ["Para one", "Para two"]
    assert out["main_topics"] == ["Topic A", "Topic B"]


def test_validate_summarize_output_non_dict_returns_empty() -> None:
    assert validate_summarize_output(None) == {
        "summary_short": "",
        "summary_bullets": [],
        "summary_paragraphs": [],
        "main_topics": [],
    }


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_english_path(mock_groq: MagicMock) -> None:
    mock_groq.return_value = {
        "summary_short": "English gist.",
        "summary_bullets": ["Point one"],
        "summary_paragraphs": [],
        "main_topics": ["Topic"],
    }
    text = "Hello world. " * 30
    out, note = run_transcript_summary_llm(full_text=text, analysis_language="en")
    mock_groq.assert_called_once()
    call_kw = mock_groq.call_args.kwargs
    assert "Format: BULLETS" in call_kw["system"]
    assert "You are a careful assistant for transcript summarization" in call_kw["system"]
    assert "TEXT:\n" in call_kw["user"]
    assert "Hello world." in call_kw["user"]
    assert call_kw["temperature"] == 0.2
    assert out["summary_short"] == "English gist."
    assert out["summary_format"] == "bullets"
    assert out["summary_length"] == "medium"
    assert out["input_truncated"] is False
    assert out["truncation_note"] is None
    assert note is None


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_paragraphs_long_uses_prompt_and_tokens(mock_groq: MagicMock) -> None:
    mock_groq.return_value = {
        "summary_short": "Gist",
        "summary_bullets": [],
        "summary_paragraphs": ["P1", "P2"],
        "main_topics": ["T"],
    }
    out, _ = run_transcript_summary_llm(
        full_text="Hello. " * 50,
        analysis_language="en",
        summary_format="paragraphs",
        summary_length="long",
    )
    call_kw = mock_groq.call_args.kwargs
    assert "Format: PARAGRAPHS" in call_kw["system"]
    assert "Verbosity: LONG" in call_kw["system"]
    assert call_kw["max_tokens"] == 6144
    assert out["summary_format"] == "paragraphs"
    assert out["summary_length"] == "long"


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_persian_path(mock_groq: MagicMock) -> None:
    mock_groq.return_value = {
        "summary_short": "خلاصه",
        "summary_bullets": ["نکته"],
        "summary_paragraphs": [],
        "main_topics": ["موضوع"],
    }
    text = "سلام این یک متن آزمایشی است. " * 20
    out, note = run_transcript_summary_llm(full_text=text, analysis_language="fa")
    mock_groq.assert_called_once()
    call_kw = mock_groq.call_args.kwargs
    assert "قالب: نکات" in call_kw["system"]
    assert "شما یک دستیار دقیق برای خلاصه‌سازی" in call_kw["system"]
    assert "متن:\n" in call_kw["user"]
    assert "سلام" in call_kw["user"]
    assert out["summary_short"] == "خلاصه"
    assert out["input_truncated"] is False
    assert out["truncation_note"] is None
    assert note is None


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_truncation_sets_metadata_and_note(mock_groq: MagicMock) -> None:
    mock_groq.return_value = {
        "summary_short": "Short.",
        "summary_bullets": [],
        "summary_paragraphs": [],
        "main_topics": [],
    }
    from signalmap.services import llm_transcript_summary as _sum

    cap = _sum._MAX_SUMMARY_INPUT_CHARS
    long_text = "x" * (cap + 1)
    out, note = run_transcript_summary_llm(full_text=long_text, analysis_language="en")
    mock_groq.assert_called_once()
    user = mock_groq.call_args.kwargs["user"]
    marker = "TEXT:\n"
    body = user[user.index(marker) + len(marker) :]
    assert body == "x" * cap
    assert out["input_truncated"] is True
    assert out["truncation_note"] == LLM_SUMMARY_TRUNCATION_NOTE
    assert note == LLM_SUMMARY_TRUNCATION_NOTE


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_maps_groq_token_limit_to_friendly_422(mock_groq: MagicMock) -> None:
    mock_groq.side_effect = HTTPException(
        status_code=502,
        detail=(
            "Groq API error: Request too large for model `llama-3.3-70b-versatile` "
            "TPM limit 12000, Requested 28504"
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        run_transcript_summary_llm(full_text="hello " * 100, analysis_language="en")
    assert exc_info.value.status_code == 422
    assert "too long" in str(exc_info.value.detail).lower()
    assert "chunked" in str(exc_info.value.detail).lower()


@patch.object(_lta, "groq_chat_json")
def test_run_transcript_summary_llm_other_language_uses_english_prompt(mock_groq: MagicMock) -> None:
    mock_groq.return_value = {
        "summary_short": "S",
        "summary_bullets": [],
        "summary_paragraphs": [],
        "main_topics": [],
    }
    out, _ = run_transcript_summary_llm(full_text="Some German text hier.", analysis_language="de")
    system = mock_groq.call_args.kwargs["system"]
    assert "You are a careful assistant for transcript summarization" in system
    assert out["input_truncated"] is False


@patch.object(
    _ta,
    "run_summarize_llm",
    return_value=(
        {
            "summary_short": "ok",
            "summary_bullets": [],
            "summary_paragraphs": [],
            "main_topics": [],
            "summary_format": "bullets",
            "summary_length": "medium",
            "input_truncated": True,
            "truncation_note": LLM_SUMMARY_TRUNCATION_NOTE,
        },
        LLM_SUMMARY_TRUNCATION_NOTE,
    ),
)
@patch.object(_ta, "require_groq_api_key", return_value="test-key")
def test_summarize_llm_mode_passes_through_llm_payload(
    _mock_req: MagicMock,
    _mock_run: MagicMock,
) -> None:
    text = "y" * 80
    result = _ta.run_transcript_analysis_from_text(
        text,
        "summarize_llm",
        "en",
        fallacy_method="heuristic",
    )
    ls = result.get("llm_summarize")
    assert isinstance(ls, dict)
    assert ls.get("input_truncated") is True
    assert ls.get("truncation_note") == LLM_SUMMARY_TRUNCATION_NOTE
    assert LLM_SUMMARY_TRUNCATION_NOTE in (result.get("analysis_note") or "")

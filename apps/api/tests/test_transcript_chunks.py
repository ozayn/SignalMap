"""Unit tests for plain-text chunking (including heuristic fallacy sentence units)."""

from __future__ import annotations

import sys
from pathlib import Path

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from signalmap.services.transcript_chunks import (  # noqa: E402
    plain_text_to_analysis_chunks,
    plain_text_to_fallacy_heuristic_chunks,
)


def test_fallacy_heuristic_splits_sentences_inside_one_paragraph() -> None:
    """Single pasted paragraph (no blank lines) should become multiple heuristic chunks."""
    text = (
        "I disagree with his foreign policy because the sanctions failed and oil exports increased. "
        "So you're saying we should just let the country collapse and do nothing. "
        "You shouldn't listen to him; he's an idiot and a clown."
    )
    standard = plain_text_to_analysis_chunks(text)
    heuristic = plain_text_to_fallacy_heuristic_chunks(text)
    assert len(standard) == 1
    assert len(heuristic) >= 3
    assert all(isinstance(c.get("text"), str) and c["text"].strip() for c in heuristic)


def test_fallacy_heuristic_preserves_double_newline_paragraphs() -> None:
    """Paragraph breaks are still respected before sentence splitting."""
    text = (
        "First paragraph with one sentence.\n\n"
        "Second paragraph starts here. It has two sentences."
    )
    chunks = plain_text_to_fallacy_heuristic_chunks(text)
    assert len(chunks) == 3
    joined = " ".join(c["text"] for c in chunks)
    assert "First paragraph" in joined
    assert "Second paragraph" in joined

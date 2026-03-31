"""
Heuristic transcript fallacy regression tests.

Uses tests/fixtures/fallacy_test_cases.json, including positives and negatives for
relative_privation, hasty_generalization, appeal_to_authority, slippery_slope, and other labels.
Each case mirrors a request to
POST /api/transcript/analyze-text with mode=fallacies, language=en, method=heuristic
by calling the same underlying function (run_transcript_analysis_from_text).

Run from repo root:
  cd apps/api && PYTHONPATH=src pytest tests/test_transcript_fallacies.py -v

Or with pytest-pythonpath / editable install if your environment sets src automatically.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from signalmap.services.transcript_analysis import run_transcript_analysis_from_text

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "fallacy_test_cases.json"


def _load_cases() -> list[dict]:
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("fallacy_test_cases.json must be a JSON array")
    return data


def _labels_from_result(result: dict) -> list[str]:
    seen: set[str] = set()
    for ch in result.get("chunks") or []:
        if not isinstance(ch, dict):
            continue
        for lab in ch.get("labels") or []:
            if isinstance(lab, str) and lab:
                seen.add(lab)
    return sorted(seen)


@pytest.mark.parametrize("case", _load_cases(), ids=lambda c: str(c.get("name", "?")))
def test_heuristic_fallacy_matches_fixture(case: dict) -> None:
    text = case.get("text") or ""
    raw_expected = case.get("expected")
    if not isinstance(raw_expected, list):
        raw_expected = []
    expected = sorted({str(x) for x in raw_expected if x})

    result = run_transcript_analysis_from_text(
        text,
        "fallacies",
        "en",
        fallacy_method="heuristic",
    )
    actual = _labels_from_result(result)
    assert actual == expected


def test_heuristic_long_paragraph_sentence_level_labels() -> None:
    """
    Multi-sentence pasted text (one paragraph) should yield multiple chunks so different
    fallacies attach to the sentences that contain them, not only to toy single-sentence inputs.
    """
    text = (
        "I disagree with his foreign policy because the sanctions failed and oil exports increased. "
        "So you're saying we should just let the country collapse and do nothing. "
        "You shouldn't listen to him; he's an idiot and a clown."
    )
    assert len(text) >= 50
    result = run_transcript_analysis_from_text(
        text,
        "fallacies",
        "en",
        fallacy_method="heuristic",
    )
    chunks = result.get("chunks") or []
    assert len(chunks) >= 3
    assert result.get("summary") == {"ad_hominem": 1, "straw_man": 1}
    labels_by_chunk = [sorted(ch.get("labels") or []) for ch in chunks if isinstance(ch, dict)]
    assert [] in labels_by_chunk
    assert ["ad_hominem"] in labels_by_chunk
    assert ["straw_man"] in labels_by_chunk

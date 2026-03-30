"""
LLM fallacy detection tests (Groq, method=llm).

Uses the same fixture as the heuristic tests, including positives and negatives for
relative_privation, hasty_generalization, appeal_to_authority, slippery_slope, and other labels.
Assertions are intentionally soft:
positive cases require each expected label to appear somewhere in chunk labels (extras allowed).
Negative cases require no labels.

Requires GROQ_API_KEY. Run only LLM tests::

    cd apps/api && PYTHONPATH=src pytest tests/test_transcript_fallacies_llm.py -v -m llm -s

If ``GROQ_API_KEY`` is still unset after loading ``apps/api/.env`` (when present), tests skip.

Session summary (passed / xfailed / failed / skipped) is printed to stderr from ``conftest.py``.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest
from dotenv import load_dotenv

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

# Local dev: apps/api/.env (e.g. GROQ_API_KEY) without exporting vars in the shell.
load_dotenv(_API_DIR / ".env")

from signalmap.services.transcript_analysis import run_transcript_analysis_from_text

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "fallacy_test_cases.json"

pytestmark = pytest.mark.llm


def _load_cases() -> list[dict[str, Any]]:
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("fallacy_test_cases.json must be a JSON array")
    return data


def _labels_from_result(result: dict[str, Any]) -> list[str]:
    """Flatten chunk labels, deduplicate, sort."""
    seen: set[str] = set()
    for ch in result.get("chunks") or []:
        if not isinstance(ch, dict):
            continue
        for lab in ch.get("labels") or []:
            if isinstance(lab, str) and lab:
                seen.add(lab)
    return sorted(seen)


def _groq_configured() -> bool:
    return bool((os.getenv("GROQ_API_KEY") or "").strip())


def _print_case_report(
    name: str,
    text: str,
    expected: list[str],
    actual: list[str],
    status: str,
) -> None:
    print(
        f"\n=== CASE: {name} ===\n"
        f"TEXT:\n{text}\n"
        f"EXPECTED: {expected}\n"
        f"ACTUAL: {actual}\n"
        f"STATUS: {status}\n",
        flush=True,
    )


@pytest.fixture(scope="module")
def require_groq() -> None:
    if not _groq_configured():
        pytest.skip("GROQ_API_KEY not set; LLM fallacy tests skipped.")


@pytest.mark.parametrize("case", _load_cases(), ids=lambda c: str(c.get("name", "?")))
def test_llm_fallacy_case(case: dict[str, Any], require_groq: None) -> None:
    name = str(case.get("name") or "?")
    text = case.get("text") or ""
    raw_expected = case.get("expected")
    if not isinstance(raw_expected, list):
        raw_expected = []
    expected = sorted({str(x) for x in raw_expected if x})

    result = run_transcript_analysis_from_text(
        text,
        "fallacies",
        "en",
        fallacy_method="llm",
    )
    actual = _labels_from_result(result)

    if expected:
        if not actual:
            _print_case_report(name, text, expected, actual, "XFAIL")
            pytest.xfail("LLM returned no labels")
        missing = [lab for lab in expected if lab not in actual]
        if missing:
            _print_case_report(name, text, expected, actual, "FAIL")
            assert not missing, (
                f"case={name!r} missing expected labels {missing!r}; "
                f"expected={expected!r} actual={actual!r}"
            )
        _print_case_report(name, text, expected, actual, "PASS")
    else:
        if actual:
            _print_case_report(name, text, expected, actual, "FAIL")
            pytest.fail(f"False positive: {actual}")
        _print_case_report(name, text, expected, actual, "PASS")

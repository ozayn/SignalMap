"""
Pytest hooks for optional diagnostics (LLM fallacy tests session summary).
"""

from __future__ import annotations

import sys
from typing import Any

import pytest

_llm_collected: int = 0


def pytest_collection_modifyitems(config: Any, items: list[Any]) -> None:
    global _llm_collected
    _llm_collected = sum(1 for item in items if item.get_closest_marker("llm"))


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: Any) -> None:
    """Summarize outcomes for tests in ``test_transcript_fallacies_llm.py`` (``@pytest.mark.llm``)."""
    if _llm_collected == 0:
        return
    passed = failed = xfailed = skipped = 0
    for rep in terminalreporter.stats.get("passed", []):
        if _is_llm_fallacy_test(rep):
            passed += 1
    for rep in terminalreporter.stats.get("failed", []):
        if _is_llm_fallacy_test(rep):
            failed += 1
    for rep in terminalreporter.stats.get("xfailed", []):
        if _is_llm_fallacy_test(rep):
            xfailed += 1
    for rep in terminalreporter.stats.get("skipped", []):
        if _is_llm_fallacy_test(rep):
            skipped += 1
    for rep in terminalreporter.stats.get("xpassed", []):
        if _is_llm_fallacy_test(rep):
            passed += 1

    total_out = passed + failed + xfailed + skipped
    print(
        f"\n=== LLM fallacy test run summary ===\n"
        f"  total cases (collected, @llm): {_llm_collected}\n"
        f"  passed:      {passed}\n"
        f"  xfailed:     {xfailed}\n"
        f"  failed:      {failed}\n"
        f"  skipped:     {skipped}\n"
        f"  (outcomes counted: {total_out})\n",
        file=sys.stderr,
        flush=True,
    )


def _is_llm_fallacy_test(rep: Any) -> bool:
    nodeid = getattr(rep, "nodeid", "") or ""
    return "test_llm_fallacy_case" in nodeid and "test_transcript_fallacies_llm" in nodeid

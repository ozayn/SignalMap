#!/usr/bin/env python3
"""
Smoke-test fallacy detection via the local transcript analyze-text API.

Loads cases from tests/fixtures/fallacy_test_cases.json, POSTs each to
/api/transcript/analyze-text with mode=fallacies and a chosen method, then
compares sorted unique chunk labels to the expected list (written for heuristic).

Usage (API must be running, e.g. uvicorn on port 8000):

  python apps/api/scripts/run_fallacy_smoke_tests.py
  python apps/api/scripts/run_fallacy_smoke_tests.py --method heuristic
  python apps/api/scripts/run_fallacy_smoke_tests.py --method llm

From apps/api:

  python scripts/run_fallacy_smoke_tests.py [--method heuristic|llm]

LLM runs need GROQ_API_KEY on the server. Fixture expectations may not match LLM output.

Optional: set SIGNALMAP_API_BASE to override the server origin (default http://localhost:8000).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def _fixture_path() -> Path:
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent / "tests" / "fixtures" / "fallacy_test_cases.json"


def _api_url() -> str:
    base = (os.environ.get("SIGNALMAP_API_BASE") or "http://localhost:8000").rstrip("/")
    return f"{base}/api/transcript/analyze-text"


def _collect_labels(chunks: list) -> list[str]:
    seen: set[str] = set()
    for ch in chunks or []:
        if not isinstance(ch, dict):
            continue
        for lab in ch.get("labels") or []:
            if isinstance(lab, str) and lab:
                seen.add(lab)
    return sorted(seen)


def _post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run fallacy_test_cases.json against /api/transcript/analyze-text",
    )
    p.add_argument(
        "--method",
        choices=("heuristic", "llm"),
        default="heuristic",
        help="Fallacy detection method (default: heuristic)",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    method: str = args.method

    fixture = _fixture_path()
    if not fixture.is_file():
        print(f"Fixture not found: {fixture}", file=sys.stderr)
        return 2

    with open(fixture, encoding="utf-8") as f:
        cases = json.load(f)

    if not isinstance(cases, list):
        print("Fixture must be a JSON array.", file=sys.stderr)
        return 2

    url = _api_url()
    failed = 0

    print(f"method: {method}")
    print()

    for case in cases:
        if not isinstance(case, dict):
            continue
        name = case.get("name", "?")
        text = case.get("text", "")
        expected = case.get("expected")
        if not isinstance(expected, list):
            expected = []

        expected_sorted = sorted({str(x) for x in expected if x})

        print(f"== {name} ==")

        payload = {
            "text": text,
            "mode": "fallacies",
            "language": "en",
            "method": method,
        }

        try:
            body = _post_json(url, payload)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"expected: {expected_sorted!r}")
            print(f"actual:   <HTTP {e.code}>")
            print(f"FAIL ({err_body[:500]})")
            print()
            failed += 1
            continue
        except urllib.error.URLError as e:
            print(f"expected: {expected_sorted!r}")
            print(f"actual:   <connection error: {e}>")
            print("FAIL")
            print()
            failed += 1
            continue
        except Exception as e:
            print(f"expected: {expected_sorted!r}")
            print(f"actual:   <error: {e}>")
            print("FAIL")
            print()
            failed += 1
            continue

        chunks = body.get("chunks")
        if not isinstance(chunks, list):
            chunks = []
        actual_sorted = _collect_labels(chunks)

        print(f"expected: {expected_sorted!r}")
        print(f"actual:   {actual_sorted!r}")
        if actual_sorted == expected_sorted:
            print("PASS")
        else:
            print("FAIL")
            failed += 1
        print()

    if failed:
        print(f"Summary: {failed} case(s) failed.", file=sys.stderr)
        return 1
    print("Summary: all cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

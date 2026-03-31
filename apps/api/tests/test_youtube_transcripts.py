"""Tests for YouTube URL → video id extraction.

Run: cd apps/api && PYTHONPATH=src pytest tests/test_youtube_transcripts.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_API_DIR = Path(__file__).resolve().parent.parent
_SRC = _API_DIR / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from signalmap.services.youtube_transcripts import extract_video_id

VID = "dQw4w9WgXcQ"  # 11-char id


@pytest.mark.parametrize(
    "url",
    [
        f"https://www.youtube.com/watch?v={VID}",
        f"https://youtu.be/{VID}",
        f"https://www.youtube.com/embed/{VID}",
        f"https://www.youtube.com/v/{VID}",
        f"https://www.youtube.com/shorts/{VID}",
        f"https://www.youtube.com/live/{VID}",
        f"https://www.youtube.com/live/{VID}?si=abc",
        f"https://m.youtube.com/live/{VID}",
        f"https://m.youtube.com/live/{VID}/",
    ],
)
def test_extract_video_id_supported_urls(url: str) -> None:
    assert extract_video_id(url) == VID


def test_extract_video_id_bare_id() -> None:
    assert extract_video_id(VID) == VID


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/live/",
        "https://www.youtube.com/live/short",
        "https://www.youtube.com/live/notavalididatall",
        "https://example.com/live/abcdefghijk",
    ],
)
def test_extract_video_id_rejects_malformed_live(url: str) -> None:
    assert extract_video_id(url) is None

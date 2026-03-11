"""
Resolve a YouTube channel identifier (handle, URL, or channel ID) to canonical channel ID.
"""

import os
import re

import httpx

CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
TIMEOUT = 15.0


def resolve_channel_id(identifier: str) -> str:
    """
    Resolve handle, URL, or channel ID to canonical channel ID.
    Raises ValueError if API key missing or channel not found.
    """
    raw = (identifier or "").strip()
    if not raw:
        raise ValueError("Identifier is required.")

    # If contains /channel/, extract channel ID directly (before normalization)
    if "/channel/" in raw.lower():
        match = re.search(r"/channel/(UC[\w-]+)", raw, re.IGNORECASE)
        if match:
            return match.group(1)

    # Normalize: strip common URL prefixes and @
    s = raw
    for prefix in (
        "https://youtube.com/",
        "https://www.youtube.com/",
        "http://youtube.com/",
        "http://www.youtube.com/",
        "youtube.com/",
        "www.youtube.com/",
    ):
        if s.lower().startswith(prefix):
            s = s[len(prefix) :].lstrip("/")
            break
    s = s.lstrip("@").split("/")[0].split("?")[0].strip()

    if not s:
        raise ValueError("Identifier is empty after normalization.")

    # If already looks like channel ID (starts with UC)
    if s.startswith("UC"):
        return s

    # Otherwise treat as handle: call YouTube API
    key = (os.getenv("YOUTUBE_API_KEY") or "").strip()
    if not key:
        raise ValueError("YOUTUBE_API_KEY is not set.")

    params = {
        "part": "id",
        "forHandle": s,
        "key": key,
    }

    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(CHANNELS_URL, params=params)

    if resp.status_code == 200:
        try:
            from db import record_youtube_quota_usage
            record_youtube_quota_usage(1)  # channels.list = 1 unit
        except Exception:
            pass

    if resp.status_code != 200:
        raise ValueError(f"YouTube API error: {resp.text[:300]}")

    data = resp.json()
    items = data.get("items") or []
    if not items:
        raise ValueError(f"No channel found for: {identifier}")

    cid = (items[0].get("id") or "").strip()
    if not cid:
        raise ValueError(f"Channel not found for: {identifier}")

    return cid

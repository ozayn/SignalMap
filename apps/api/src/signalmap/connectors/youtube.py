"""
YouTube Data API v3 connector for channel-level stats.
Calls channels.list; supports lookup by channel_id (preferred) or handle.
"""

import os
from typing import Any, Optional

import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
TIMEOUT = 15.0


def _require_key() -> str:
    key = (YOUTUBE_API_KEY or "").strip()
    if not key:
        raise ValueError("YOUTUBE_API_KEY is not set. Set it in the environment for YouTube Data API v3.")
    return key


def _normalize_handle(handle: str) -> str:
    """Strip @ and whitespace for forUsername."""
    return (handle or "").strip().lstrip("@").split("/")[0].split("?")[0] or ""


def fetch_channel(
    *,
    channel_id: Optional[str] = None,
    handle: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fetch one channel from YouTube Data API v3 channels.list.
    Prefer channel_id if provided; otherwise use handle (forUsername).
    Returns normalized dict: channel_id, handle, subscriber_count, view_count, video_count, raw.
    Raises ValueError if API key missing; HTTP 502-style for quota/auth errors.
    """
    key = _require_key()
    channel_id = (channel_id or "").strip()
    handle = _normalize_handle(handle or "")

    if not channel_id and not handle:
        raise ValueError("Either channel_id or handle is required.")

    params: dict[str, str] = {
        "part": "statistics,snippet",
        "key": key,
    }
    if channel_id:
        params["id"] = channel_id
    else:
        # forHandle supports @handles (e.g. bpluspodcast); forUsername is legacy.
        params["forHandle"] = handle

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.get(CHANNELS_URL, params=params)
    except Exception as e:
        raise RuntimeError(f"YouTube API request failed: {e}") from e

    if resp.status_code == 401:
        raise RuntimeError("YouTube API key invalid or unauthorized (401). Check YOUTUBE_API_KEY.")
    if resp.status_code == 403:
        try:
            body = resp.json()
            err = body.get("error", {})
            reason = (err.get("errors") or [{}])[0].get("reason", "") or err.get("message", "")
        except Exception:
            reason = resp.text or "403 Forbidden"
        raise RuntimeError(f"YouTube API quota or access denied (403): {reason}")
    if resp.status_code != 200:
        raise RuntimeError(f"YouTube API returned {resp.status_code}: {resp.text[:500]}")

    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"YouTube API invalid JSON: {e}") from e

    items = data.get("items") or []
    if not items:
        return {
            "channel_id": channel_id or "",
            "handle": handle or "",
            "subscriber_count": None,
            "view_count": None,
            "video_count": None,
            "raw": data,
        }

    item = items[0]
    snippet = item.get("snippet") or {}
    statistics = item.get("statistics") or {}
    cid = item.get("id") or channel_id or ""
    custom_url = (snippet.get("customUrl") or "").strip().lstrip("@")
    title = (snippet.get("title") or "").strip()
    handle_resolved = custom_url or _normalize_handle(title) or handle or ""

    def _int(val: Any) -> Optional[int]:
        if val is None:
            return None
        try:
            return int(val)
        except (TypeError, ValueError):
            return None

    return {
        "channel_id": cid,
        "handle": handle_resolved,
        "subscriber_count": _int(statistics.get("subscriberCount")),
        "view_count": _int(statistics.get("viewCount")),
        "video_count": _int(statistics.get("videoCount")),
        "raw": item,
    }

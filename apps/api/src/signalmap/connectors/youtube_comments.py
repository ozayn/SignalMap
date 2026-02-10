"""
Fetch top comments for a YouTube channel's videos via Data API v3.
Uses channels.list (contentDetails) -> playlistItems.list -> commentThreads.list.
"""

from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from signalmap.connectors.youtube import (
    CHANNELS_URL,
    TIMEOUT,
    _normalize_handle,
    _require_key,
    fetch_channel,
)

PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems"
COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"


def get_uploads_playlist_id(
    *,
    channel_id: Optional[str] = None,
    handle: Optional[str] = None,
) -> tuple[str, str]:
    """
    Resolve channel to channel_id and get its uploads playlist ID.
    Returns (channel_id, uploads_playlist_id). Uses handle if channel_id not given.
    """
    if (channel_id or "").strip() and not (handle or "").strip():
        cid = (channel_id or "").strip()
    else:
        handle = _normalize_handle(handle or "")
        if not handle and not (channel_id or "").strip():
            raise ValueError("Either channel_id or handle is required.")
        ch = fetch_channel(channel_id=channel_id or None, handle=handle or None)
        cid = (ch.get("channel_id") or "").strip()
        if not cid:
            raise ValueError("Could not resolve channel.")
    key = _require_key()
    params = {"part": "contentDetails", "id": cid, "key": key}
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(CHANNELS_URL, params=params)
    if resp.status_code != 200:
        raise RuntimeError(f"YouTube channels.list returned {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    items = data.get("items") or []
    if not items:
        raise ValueError(f"Channel not found: {cid}")
    details = (items[0].get("contentDetails") or {}).get("relatedPlaylists") or {}
    uploads = (details.get("uploads") or "").strip()
    if not uploads:
        raise ValueError(f"No uploads playlist for channel {cid}")
    return cid, uploads


def list_recent_video_ids(
    uploads_playlist_id: str,
    *,
    published_after: Optional[str] = None,
    max_results: int = 30,
) -> list[dict[str, Any]]:
    """
    List recent videos from an uploads playlist. Each item: {video_id, published_at}.
    published_after: ISO 8601 datetime (e.g. 2024-01-01T00:00:00Z).
    """
    key = _require_key()
    params = {
        "part": "snippet",
        "playlistId": uploads_playlist_id,
        "maxResults": min(max(max_results, 1), 50),
        "key": key,
    }
    if published_after:
        params["publishedAfter"] = published_after
    out = []
    page_token = None
    while len(out) < max_results:
        if page_token:
            params["pageToken"] = page_token
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.get(PLAYLIST_ITEMS_URL, params=params)
        if resp.status_code != 200:
            raise RuntimeError(f"YouTube playlistItems.list returned {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        for item in data.get("items") or []:
            sn = item.get("snippet") or {}
            vid = (sn.get("resourceId") or {}).get("videoId") or ""
            pub = sn.get("publishedAt") or ""
            if vid:
                out.append({"video_id": vid, "published_at": pub})
        page_token = data.get("nextPageToken")
        if not page_token:
            break
        if len(out) >= max_results:
            break
    return out[:max_results]


def list_top_comments_for_video(
    video_id: str,
    *,
    max_results: int = 100,
    order: str = "relevance",
) -> list[dict[str, Any]]:
    """
    Fetch top-level comment threads for a video. Each item: {comment_id, text, published_at, video_id}.
    order: 'relevance' or 'time'.
    """
    key = _require_key()
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": min(max(max_results, 1), 100),
        "order": order if order in ("relevance", "time") else "relevance",
        "textFormat": "plainText",
        "key": key,
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(COMMENT_THREADS_URL, params=params)
    if resp.status_code == 403:
        try:
            body = resp.json()
            err = (body.get("error") or {}).get("errors") or [{}]
            reason = (err[0].get("reason"), err[0].get("message"))
        except Exception:
            reason = (None, resp.text[:200])
        if "commentsDisabled" in str(reason):
            return []
        raise RuntimeError(f"YouTube commentThreads.list 403: {reason}")
    if resp.status_code != 200:
        return []
    data = resp.json()
    out = []
    for thread in data.get("items") or []:
        sn = (thread.get("snippet") or {}).get("topLevelComment", {}).get("snippet") or {}
        cid = (thread.get("id") or "").strip()
        text = (sn.get("textDisplay") or sn.get("textOriginal") or "").strip()
        pub = sn.get("publishedAt") or ""
        if text:
            out.append({
                "comment_id": cid,
                "text": text,
                "published_at": pub,
                "video_id": video_id,
            })
    return out


def fetch_channel_comments(
    *,
    channel_id: Optional[str] = None,
    handle: Optional[str] = None,
    published_after: Optional[str] = None,
    max_videos: int = 20,
    max_comments_per_video: int = 100,
    order: str = "relevance",
) -> tuple[str, list[dict[str, Any]]]:
    """
    Fetch top comments for a channel's recent videos.
    Returns (channel_id, list of {channel_id, video_id, comment_id, comment_text, published_at}).
    published_after: ISO 8601 (e.g. 2024-01-01T00:00:00Z) to limit videos by upload date.
    """
    cid, uploads_id = get_uploads_playlist_id(channel_id=channel_id, handle=handle)
    videos = list_recent_video_ids(uploads_id, published_after=published_after, max_results=max_videos)
    comments = []
    for v in videos:
        vid = v.get("video_id") or ""
        if not vid:
            continue
        try:
            threads = list_top_comments_for_video(
                vid,
                max_results=max_comments_per_video,
                order=order,
            )
        except RuntimeError:
            continue
        for t in threads:
            comments.append({
                "channel_id": cid,
                "video_id": t.get("video_id") or vid,
                "comment_id": t.get("comment_id") or "",
                "comment_text": t.get("text") or "",
                "published_at": t.get("published_at") or "",
            })
    return cid, comments

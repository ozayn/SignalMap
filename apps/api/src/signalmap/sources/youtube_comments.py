"""
YouTube comment source: fetch recent videos from a channel.
First step toward collecting comments for discourse analysis.
Uses YouTube Data API v3 search.
Excludes Shorts by using videoDuration=medium (4–20 min) or long (>20 min) at search time.
"""

import os

import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
BASE_URL = "https://www.googleapis.com/youtube/v3"
COMMENT_THREADS_URL = f"{BASE_URL}/commentThreads"


def get_video_comments(video_id: str, max_results: int = 50):
    """
    Fetch top-level comments for a YouTube video.
    """
    if not YOUTUBE_API_KEY:
        raise RuntimeError("YOUTUBE_API_KEY not configured")

    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": max_results,
        "textFormat": "plainText",
        "key": YOUTUBE_API_KEY,
    }

    r = httpx.get(COMMENT_THREADS_URL, params=params, timeout=15.0)

    if r.status_code != 200:
        raise RuntimeError(f"YouTube API error: {r.text}")

    try:
        from db import record_youtube_quota_usage
        record_youtube_quota_usage(1)  # commentThreads.list = 1 unit
    except Exception:
        pass

    data = r.json()

    comments = []

    for item in data.get("items", []):
        snippet = item["snippet"]["topLevelComment"]["snippet"]

        comments.append({
            "video_id": video_id,
            "author": snippet["authorDisplayName"],
            "comment_text": snippet["textDisplay"],
            "like_count": snippet["likeCount"],
            "published_at": snippet["publishedAt"],
        })

    return comments


def _search_videos(channel_id: str, max_results: int, video_duration: str | None) -> list[dict]:
    """Run search.list; video_duration: 'short'|'medium'|'long' or None for any."""
    url = f"{BASE_URL}/search"
    params = {
        "part": "snippet",
        "channelId": channel_id,
        "maxResults": max_results,
        "order": "date",
        "type": "video",
        "key": YOUTUBE_API_KEY,
    }
    if video_duration:
        params["videoDuration"] = video_duration
    r = httpx.get(url, params=params, timeout=15.0)
    if r.status_code != 200:
        raise RuntimeError(f"YouTube API error: {r.text}")
    try:
        from db import record_youtube_quota_usage
        record_youtube_quota_usage(100)  # search.list = 100 units
    except Exception:
        pass
    videos = []
    for item in r.json().get("items", []):
        videos.append({
            "video_id": item["id"]["videoId"],
            "title": item["snippet"]["title"],
            "published_at": item["snippet"]["publishedAt"],
        })
    return videos


def get_channel_videos(channel_id: str, max_results: int = 10, exclude_shorts: bool = True):
    """
    Fetch recent videos from a YouTube channel.
    Excludes Shorts by using videoDuration at search time (no extra API call).
    Tries 'long' (>20 min) first, then 'medium' (4–20 min) if needed.
    """
    if not YOUTUBE_API_KEY:
        raise RuntimeError("YOUTUBE_API_KEY not configured")

    if not exclude_shorts:
        return _search_videos(channel_id, max_results, video_duration=None)

    # Try long first (typical for commentary/news), then medium if few results
    videos = _search_videos(channel_id, max_results, video_duration="long")
    if len(videos) < max_results:
        more = _search_videos(channel_id, 50, video_duration="medium")
        seen = {v["video_id"] for v in videos}
        for v in more:
            if v["video_id"] not in seen:
                videos.append(v)
                seen.add(v["video_id"])
        videos.sort(key=lambda x: x["published_at"], reverse=True)
    return videos[:max_results]

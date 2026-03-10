"""
YouTube comment source: fetch recent videos from a channel.
First step toward collecting comments for discourse analysis.
Uses YouTube Data API v3 search.
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


def get_channel_videos(channel_id: str, max_results: int = 10):
    """
    Fetch recent videos from a YouTube channel.
    """
    if not YOUTUBE_API_KEY:
        raise RuntimeError("YOUTUBE_API_KEY not configured")

    url = f"{BASE_URL}/search"

    params = {
        "part": "snippet",
        "channelId": channel_id,
        "maxResults": max_results,
        "order": "date",
        "type": "video",
        "key": YOUTUBE_API_KEY,
    }

    r = httpx.get(url, params=params, timeout=15.0)

    if r.status_code != 200:
        raise RuntimeError(f"YouTube API error: {r.text}")

    data = r.json()

    videos = []

    for item in data.get("items", []):
        videos.append({
            "video_id": item["id"]["videoId"],
            "title": item["snippet"]["title"],
            "published_at": item["snippet"]["publishedAt"],
        })

    return videos

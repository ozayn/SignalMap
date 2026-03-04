"""
Sentiment for YouTube comment snapshots, per video.
Uses comment_text from youtube_comment_snapshots; sentiment is English-oriented (TextBlob).
"""

from signalmap.utils.sentiment import aggregate_sentiment


def get_comments_for_video(cursor, channel_id: str, video_id: str) -> list[str]:
    """Return list of comment_text for the given channel and video_id."""
    cursor.execute(
        """
        SELECT comment_text FROM youtube_comment_snapshots
        WHERE channel_id = %s AND video_id = %s AND comment_text IS NOT NULL AND comment_text != ''
        ORDER BY published_at ASC NULLS LAST, id ASC
        """,
        (channel_id.strip(), video_id.strip()),
    )
    rows = cursor.fetchall()
    return [r["comment_text"] or "" for r in rows if r.get("comment_text")]


def get_sentiment_for_video(
    cursor,
    channel_id: str,
    video_id: str,
    *,
    include_polarities: bool = False,
) -> dict:
    """
    Get comments for the video, run sentiment, return aggregate.
    Returns: video_id, channel_id, count, avg_polarity, positive_pct, neutral_pct, negative_pct,
             and optionally polarities (list of per-comment scores).
    """
    texts = get_comments_for_video(cursor, channel_id, video_id)
    agg = aggregate_sentiment(texts)
    out = {
        "video_id": video_id.strip(),
        "channel_id": channel_id.strip(),
        "count": agg["count"],
        "avg_polarity": agg["avg_polarity"],
        "positive_pct": agg["positive_pct"],
        "neutral_pct": agg["neutral_pct"],
        "negative_pct": agg["negative_pct"],
    }
    if include_polarities:
        out["polarities"] = agg["polarities"]
    return out

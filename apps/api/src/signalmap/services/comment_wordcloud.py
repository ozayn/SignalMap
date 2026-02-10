"""
Word frequency from YouTube comment snapshots. Observational only; no topic or sentiment.
"""

from collections import Counter
from typing import Optional

from signalmap.utils.comment_preprocess import preprocess

# Default top N tokens
DEFAULT_TOP_N = 80

# In-memory fallback when DB has no rows for the sample channel (no seed script required)
SAMPLE_CHANNEL_ID = "UC-test-wordcloud"
SAMPLE_COMMENTS_FALLBACK = [
    "This video was really helpful thanks for sharing",
    "I have been waiting for this kind of content for a long time",
    "Great explanation and the examples made it clear",
    "Could you do more videos like this please",
    "The quality of the content is always good here",
    "Thanks for the update and the detailed explanation",
    "This is exactly what I needed for my project",
    "Really helpful content as always",
    "The examples in this video are very clear",
    "More content like this would be amazing",
    "Thanks for making this so easy to understand",
    "Helpful and clear as always",
    "This video helped me understand the topic",
    "Great content thanks for sharing",
    "The explanation was clear and the examples helped",
]

# Second demo channel: Bplus Podcast (by handle). No DB required. Mixed English/Farsi demo.
BPLUS_HANDLE_NORMALIZED = "bpluspodcast"
BPLUS_SAMPLE_COMMENTS = [
    "عالی بود این اپیزود ممنون",
    "Great episode really enjoyed the conversation",
    "همیشه منتظر اپیزودهای جدیدتون هستم",
    "Thanks for having this guest on the show",
    "خیلی جالب بود این بحث",
    "The podcast just gets better every week",
    "دستتون درد نکنه",
    "Such an interesting discussion thanks for sharing",
    "من هر هفته گوش میدم",
    "Love the energy and the topics you cover",
    "یکی از بهترین اپیزودها بود",
    "Really appreciate the depth of the conversation",
    "بیشتر از این موضوعات بذارید",
    "More episodes like this please",
    "ممنون از شما و مهمون خوبتون",
]


def _normalize_handle_for_fallback(value: str) -> str:
    """Strip @ and whitespace, lowercase, for matching demo handles."""
    return (value or "").strip().lstrip("@").lower().split("/")[0].split("?")[0] or ""


def get_comments_for_window(
    cursor,
    channel_id: str,
    window_start: str,
    window_end: str,
    by: str = "published_at",
) -> list[str]:
    """
    Fetch comment_text from youtube_comment_snapshots for the given channel and date window.
    by: 'published_at' (when comment was posted) | 'captured_at' (when we ingested)
    """
    col = "published_at" if by == "published_at" else "captured_at"
    cursor.execute(
        f"""
        SELECT comment_text FROM youtube_comment_snapshots
        WHERE channel_id = %s AND {col} IS NOT NULL
          AND {col} >= %s::timestamptz AND {col} <= %s::timestamptz
        ORDER BY {col}
        """,
        (channel_id.strip(), window_start, window_end),
    )
    rows = cursor.fetchall()
    return [r["comment_text"] or "" for r in rows if r.get("comment_text")]


def token_frequencies(
    texts: list[str],
    *,
    stopwords: Optional[frozenset] = None,
    channel_terms: Optional[set[str]] = None,
    min_length: int = 3,
) -> Counter:
    """Aggregate token counts from preprocessed comment texts."""
    counter: Counter = Counter()
    for text in texts:
        tokens = preprocess(
            text,
            stopwords=stopwords,
            channel_terms=channel_terms,
            min_length=min_length,
        )
        counter.update(tokens)
    return counter


def get_wordcloud_data_from_texts(
    texts: list[str],
    window_start: str,
    window_end: str,
    top_n: int = DEFAULT_TOP_N,
    channel_terms: Optional[set[str]] = None,
) -> dict:
    """Build wordcloud response from a list of comment strings (no DB). Same shape as get_wordcloud_data."""
    top_n = min(max(top_n, 1), 200)
    counts = token_frequencies(texts, channel_terms=channel_terms)
    most = counts.most_common(top_n)
    return {
        "items": [{"token": t, "count": c} for t, c in most],
        "window_start": window_start,
        "window_end": window_end,
    }


def get_wordcloud_data(
    cursor,
    channel_id: str,
    window_start: str,
    window_end: str,
    by: str = "published_at",
    top_n: int = DEFAULT_TOP_N,
    channel_terms: Optional[set[str]] = None,
) -> dict:
    """
    Returns:
    {
      "items": [ {"token": str, "count": int}, ... ],
      "window_start": str,
      "window_end": str
    }
    """
    top_n = min(max(top_n, 1), 200)
    texts = get_comments_for_window(cursor, channel_id, window_start, window_end, by=by)
    # Fallback: sample channel with no DB rows → use in-memory sample so "try sample data" works without seed
    if not texts and channel_id.strip() == SAMPLE_CHANNEL_ID:
        texts = SAMPLE_COMMENTS_FALLBACK
    # Fallback: Bplus Podcast by handle (bpluspodcast) with no DB rows
    if not texts and _normalize_handle_for_fallback(channel_id) == BPLUS_HANDLE_NORMALIZED:
        texts = BPLUS_SAMPLE_COMMENTS
    counts = token_frequencies(texts, channel_terms=channel_terms)
    most = counts.most_common(top_n)
    return {
        "items": [{"token": t, "count": c} for t, c in most],
        "window_start": window_start,
        "window_end": window_end,
    }

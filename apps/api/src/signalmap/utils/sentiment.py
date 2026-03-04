"""
Simple sentiment for comment text. English-oriented (TextBlob); other languages may score neutral.
Returns polarity in [-1, 1]; we treat >0.1 as positive, <-0.1 as negative, else neutral.
"""

from typing import Optional


def _polarity(text: str) -> float:
    """Return polarity in [-1, 1] or 0.0 if unavailable (e.g. TextBlob not installed or non-English)."""
    try:
        from textblob import TextBlob
        blob = TextBlob((text or "").strip())
        return float(blob.sentiment.polarity)
    except Exception:
        return 0.0


def available() -> bool:
    """Return True if sentiment backend (TextBlob) is available."""
    try:
        from textblob import TextBlob
        TextBlob("test").sentiment.polarity
        return True
    except Exception:
        return False


def sentiment_for_comment(text: str) -> float:
    """Single comment polarity. Empty or non-English often returns 0."""
    if not text or not isinstance(text, str):
        return 0.0
    return _polarity(text)


def aggregate_sentiment(
    texts: list[str],
    *,
    positive_threshold: float = 0.1,
    negative_threshold: float = -0.1,
) -> dict:
    """
    Run sentiment on each text and aggregate.
    Returns: count, avg_polarity, positive_pct, neutral_pct, negative_pct, polarities (list of floats).
    """
    polarities = [_polarity(t) for t in (texts or []) if t]
    n = len(polarities)
    if n == 0:
        return {
            "count": 0,
            "avg_polarity": 0.0,
            "positive_pct": 0.0,
            "neutral_pct": 0.0,
            "negative_pct": 0.0,
            "polarities": [],
        }
    positive = sum(1 for p in polarities if p > positive_threshold)
    negative = sum(1 for p in polarities if p < negative_threshold)
    neutral = n - positive - negative
    return {
        "count": n,
        "avg_polarity": round(sum(polarities) / n, 4),
        "positive_pct": round(100.0 * positive / n, 1),
        "neutral_pct": round(100.0 * neutral / n, 1),
        "negative_pct": round(100.0 * negative / n, 1),
        "polarities": [round(p, 3) for p in polarities],
    }

"""
Preprocess comment text for word-frequency / word cloud.
Observational only: no topic or sentiment inference.
Supports English and Farsi (and other Unicode letters via \\w); Farsi tokens are preserved.
"""

import re
from typing import Optional

# Minimal English stopwords (descriptive word cloud only)
STOPWORDS = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
        "her", "hers", "herself", "him", "himself", "his", "i", "if", "in", "into",
        "is", "it", "its", "me", "my", "myself", "of", "on", "or", "our", "ours",
        "ourselves", "she", "that", "the", "their", "theirs", "them", "themselves",
        "they", "this", "to", "was", "we", "were", "what", "when", "where", "which",
        "who", "will", "with", "you", "your", "yours", "yourself", "yourselves",
    }
)

# Minimal Farsi stopwords (common function words so they don't dominate the cloud)
STOPWORDS_FA = frozenset(
    {
        "و", "در", "به", "از", "این", "که", "را", "با", "است", "برای", "آن",
        "هم", "یک", "ما", "او", "شده", "خود", "تا", "یا", "اگر", "همه", "هر",
    }
)

URL_PATTERN = re.compile(
    r"https?://[^\s]+|www\.[^\s]+",
    re.IGNORECASE,
)
# Remove punctuation (keep apostrophe inside words for don't -> dont then we strip)
PUNCTUATION = re.compile(r"[^\w\s]|\d+")
# Simple emoji / non-BMP strip: remove codepoints outside basic multilingual plane or common punctuation
EMOJI_AND_EXTRA = re.compile(
    r"[\U0001F300-\U0001F9FF]|[\u2600-\u26FF]|[\u2700-\u27BF]|[\uFE00-\uFE0F]",
)


def preprocess(
    text: str,
    *,
    stopwords: Optional[frozenset[str]] = None,
    channel_terms: Optional[set[str]] = None,
    min_length: int = 3,
    include_farsi_stopwords: bool = True,
) -> list[str]:
    """
    Remove URLs/punctuation/emojis, stopwords, channel terms, tokens shorter than min_length.
    Lowercases ASCII only so Farsi and other scripts are preserved.
    Returns list of tokens (no topic or sentiment).
    """
    if not text or not isinstance(text, str):
        return []
    stop = stopwords or STOPWORDS
    if include_farsi_stopwords:
        stop = stop | STOPWORDS_FA
    channel = channel_terms or set()
    # Lowercase only ASCII so Farsi/Arabic etc. are unchanged
    s = text.strip()
    s = "".join(c.lower() if ord(c) < 128 else c for c in s)
    s = URL_PATTERN.sub(" ", s)
    s = EMOJI_AND_EXTRA.sub(" ", s)
    s = PUNCTUATION.sub(" ", s)
    tokens = s.split()
    out = []
    for t in tokens:
        t = t.strip()
        if len(t) < min_length:
            continue
        if t in stop:
            continue
        if channel and t in channel:
            continue
        out.append(t)
    return out

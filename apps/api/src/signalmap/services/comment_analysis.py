# -*- coding: utf-8 -*-
import json
import logging
import math
import os
import re
import threading
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

# Set DEBUG_CLUSTER_LABELS=1 to force DEBUG_LABEL for all clusters (verify pipeline recomputes)
DEBUG_CLUSTER_LABELS = os.environ.get("DEBUG_CLUSTER_LABELS") == "1"
from collections import Counter
from textblob import TextBlob

# Lazy imports for sklearn/umap to speed up API startup (healthcheck passes faster)

# Serialize UMAP execution to avoid Numba "Concurrent access" errors when multiple requests run
_umap_lock = threading.Lock()


def load_cached_snapshot(channel_id: str) -> dict | None:
    """Load precomputed analysis from JSON snapshot. Returns None if file does not exist."""
    base = Path(__file__).resolve().parent.parent.parent.parent
    path = base / "data" / "youtube_cache" / f"{channel_id}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def load_cached_dataset(cache_dict: dict) -> dict | None:
    """
    Extract comments and video metadata from a cache snapshot.
    Used to reuse cached data while recomputing embeddings and clustering.
    Returns ONLY comments and videos. Never returns cluster_labels or other
    derived fields—those must always be recomputed.
    """
    comments = cache_dict.get("comments")
    if not comments or not isinstance(comments, list):
        return None
    return {
        "comments": comments,
        "videos": cache_dict.get("videos", []),
    }


def load_persian_stopwords():
    path = Path(__file__).parent.parent / "data" / "persian_stopwords.txt"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}
    return set()


# Curated base Persian stopwords (prepositions, pronouns, common verbs, adverbs)
PERSIAN_BASE_STOPWORDS = {
    "و", "در", "به", "از", "که", "این", "آن", "با", "برای", "تا", "یا", "اما",
    "اگر", "هم", "همه", "هر", "هیچ", "چند", "چرا", "چطور", "کجا", "کی",
    "من", "تو", "او", "ما", "شما", "آنها", "ایشان",
    "است", "هست", "بود", "بودند", "بوده", "باشه", "باشید", "باشد",
    "شد", "شده", "میشود", "میشه", "می‌شود", "شود",
    "کرد", "کرده", "کردند", "میکرد", "میکردند",
    "میکنم", "میکنی", "میکنه", "میکنیم", "میکنن",
    "دارم", "داری", "داره", "داریم", "دارید", "دارند",
    "میدانم", "میدانی", "میداند", "میدانیم", "میدانید", "میدانند",
    "میدونم", "میدونی", "میدونه", "میدونیم", "میدونید", "میدونن",
    "گفت", "گفته", "میگوید", "میگه",
    "باید", "میتوان", "میتونه", "نمیتوان", "نمیشه",
    "خیلی", "زیاد", "کم", "دیگه", "الان", "قبلا", "بعد", "قبل",
    "چیزی", "کسی", "چند", "چنین", "همین", "همان",
    "واقعا", "اصلا", "تقریبا",
    "سلام", "مرسی", "ممنون", "تشکر",
}

# Merge file-loaded stopwords with curated base
PERSIAN_STOPWORDS = load_persian_stopwords().union(PERSIAN_BASE_STOPWORDS)


TOPIC_KEYWORDS = {
    "geopolitics": [
        "ایران", "آمریکا", "چین", "روسیه", "جهان", "کشور"
    ],
    "war_conflict": [
        "جنگ", "حمله", "بمب", "قتل", "نسل", "صلیبی"
    ],
    "religion": [
        "اسلام", "اسلامی", "دین"
    ],
    "monarchy_iran": [
        "شاه", "پهلوی", "جاوید شاه"
    ],
    "history": [
        "تاریخ", "انقلاب", "امپراتوری"
    ],
}


def normalize_persian(text: str) -> str:
    # 1) Normalize Arabic → Persian characters
    text = text.replace("ي", "ی")
    text = text.replace("ك", "ک")

    # 2) Normalize half-space (ZWNJ)
    text = text.replace("\u200c", " ")

    # 3) Normalize Heh variants
    text = text.replace("ة", "ه")
    text = text.replace("ۀ", "ه")

    # 4) Normalize verb prefixes
    text = text.replace("می ", "می")
    text = text.replace("نمی ", "نمی")

    # 5) Remove punctuation (keep Persian letters)
    text = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text)

    # 6) Collapse multiple spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()


STOPWORDS = {
    "the", "and", "to", "of", "in", "that", "is", "it", "for", "on", "with",
    "this", "be", "are", "was", "at", "as", "an", "or", "by", "from"
}

CUSTOM_STOPWORDS = {
    "مثلا", "مثل", "ولی", "اما", "بعد", "چرا", "باید", "فکر", "بسیار",
    "واقعا", "خیلی", "حتما", "اصلا", "دقیقا", "احتمالا", "فقط", "البته",
    "دیگه", "حالا", "الان", "بعدا",
    "هست", "هستیم", "نیست", "بود", "بوده", "باشه", "باشد",
    "شده", "شد", "شدن", "شدی", "شدیم", "شدید",
    "می", "میشه", "نمیشه", "می‌شود", "می‌کنه", "می‌کنم", "می‌کنند", "می‌کنید",
    "کرد", "کردن", "کرده", "کردیم", "کنه", "کنیم", "کنند",
    "گفت", "میگه", "گفتم", "گفتن",
    "دادم", "داد", "دادن",
    "اون", "این", "آن", "همین", "همون", "اونجا", "اینجا",
    "یکی", "چند", "چیزی", "چقدر", "وقتی", "زمان", "شرایط",
    "کاری", "کار", "زندگی", "حرف", "دوست", "بریم", "نداره",
    "لطفا", "آقای", "ممنون", "درود",
    "علی", "بندری", "ویدیو", "کانال", "اپیزود", "پادکست",
    "thank", "you",
    "these", "nativity", "scene",
}
CUSTOM_STOPWORDS.update({
    "های", "داره", "درست", "سال", "توی", "دست", "نمی",
    "سلام", "نگاه", "اگه", "کاش", "بشه", "تشکر", "جالب",
    "امروز", "باشید", "کنی",
})
CUSTOM_STOPWORDS.update({
    "جناب", "دارید", "مرسی", "خودت", "چطور",
    "دارم", "دارن", "میگن", "امیدوارم",
    "اینه", "جان",
})
CUSTOM_STOPWORDS.update({
    "انجام", "ادامه", "یاد", "میکنن",
    "عزیز", "عده", "داشتم",
    "گرم", "برامون", "گفتی", "داری",
})
CUSTOM_STOPWORDS.update([
    "میکنم",
    "میکنی",
    "میکنه",
    "میکنیم",
    "میکنن",
    "میدونم",
    "میدونی",
    "میدونه",
    "میکنید",
    "میکند",
    "می‌کند",
    "می‌کنه",
    "می‌کنیم",
    "گفتند",
    "کردند",
])

CHANNEL_STOPWORDS = {
    "ویدئو",
    "ویدیوی",
    "برنامه های",
    "تیم پلاس",
}

PHRASE_STOPWORDS = {
    "تشکر تشکر",
    "خسته نباشید",
    "دمتون گرم",
    "خواهش میکنم",
    "یاد گرفتم",
}
PHRASE_STOPWORDS.update({
    "ببخشید ببخشید",
    "مرسی هستین",
    "جناب عزیز",
})
PHRASE_STOPWORDS.update({
    "دمت گرم",
    "خسته نباشید",
    "well done",
    "well done ali",
    "great video",
    "thank you",
    "مرسی",
    "دمت گرم علی",
})
PHRASE_STOPWORDS.update({
    "these nativitiy scene",
    "these nativity scene",
})

PRAISE_WORDS = {
    "دمت", "گرم", "خسته", "نباشید",
    "thank", "thanks", "great",
    "well", "done", "ali", "jan",
    "مرسی", "تشکر",
}

ALL_STOPWORDS = (
    STOPWORDS
    .union(PERSIAN_STOPWORDS)
    .union(CUSTOM_STOPWORDS)
    .union(CHANNEL_STOPWORDS)
    .union(PRAISE_WORDS)
)

VERB_SUFFIXES = [
    "دم", "دی", "دیم", "دید", "دن"
]

# Verbs to exclude from cluster labels (not meaningful topics)
VERB_STOPWORDS = {
    "گفتند", "گفت", "گفتم", "گفتی",
    "کردند", "کرد", "کردم", "کردی",
    "داشتند", "داشت", "دارند",
    "میگن", "میگه", "میکنه", "میکنن",
}

# Verb endings that make a token unsuitable as label
LABEL_VERB_SUFFIXES = ("ند", "یم", "ید")

# Conversational markers: reject phrases starting with these (sentence fragments)
CONVERSATIONAL_WORDS = {
    "به", "باید", "گفتند", "میگن", "فکر", "نظرم",
}

# Additional tokens to filter in TF-IDF centroid labeling
LABEL_TOKEN_FILTER = {
    "باید", "نباید", "به", "نظرم", "گفتند", "مگه",
    "کردند", "میکند", "میکنم", "میکنی",
}

# Praise tokens: if top tokens are mostly these, use "تحسین"
PRAISE_LABEL_TOKENS = {"مرسی", "عالی", "ممنون"}


def looks_like_verb(word):
    return any(word.endswith(suffix) for suffix in VERB_SUFFIXES)


def _is_verb_like_phrase(phrase: str) -> bool:
    """Reject phrases that are verbs or verb-like (start with می, end with verb suffixes)."""
    if not phrase or phrase in VERB_STOPWORDS:
        return True
    tokens = phrase.split()
    for t in tokens:
        if t in VERB_STOPWORDS:
            return True
        if t.startswith("می"):
            return True
        if any(t.endswith(s) for s in LABEL_VERB_SUFFIXES):
            return True
    return False


def _starts_with_conversational_marker(phrase: str) -> bool:
    """Reject phrases that start with conversational markers (sentence fragments)."""
    if not phrase:
        return False
    first = phrase.split()[0] if phrase.split() else ""
    return first.lower() in CONVERSATIONAL_WORDS


def clean_text(text: str):
    text = re.sub(r"http\S+", "", text)  # remove URLs before normalization
    text = normalize_persian(text)
    text = text.lower()
    return text


def tokenize(text: str):
    text = clean_text(text)
    tokens = text.split()
    result = []
    for w in tokens:
        if w.startswith("ایران"):
            w = "ایران"
        if any(c.isdigit() for c in w):
            continue  # skip timestamps, numbers
        if w not in ALL_STOPWORDS and len(w) > 2 and not looks_like_verb(w):
            result.append(w)
    return result


def generate_bigrams(tokens):
    return [
        f"{tokens[i]} {tokens[i+1]}"
        for i in range(len(tokens) - 1)
    ]


def generate_trigrams(tokens):
    return [
        f"{tokens[i]} {tokens[i+1]} {tokens[i+2]}"
        for i in range(len(tokens) - 2)
    ]


def _normalize_phrase_for_match(phrase: str) -> str:
    """Normalize phrase for consistent matching (handles half-spaces, etc.)."""
    return normalize_persian(phrase).lower().strip()


# Arabic/Persian combining diacritics (fatha, kasra, damma, shadda, etc.)
_DIACRITICS_RE = re.compile(r"[\u064B-\u0652\u0670\u06D6-\u06ED]+")


def _normalize_title_for_phrases(title: str) -> str:
    """Normalize a video title before extracting phrases. Handles Persian character
    variants (ي→ی, ك→ک), diacritics, half-space (ZWNJ→space), and whitespace.
    Example: 'جنگهاي صليبي' and 'جنگ‌های صلیبی' both normalize to comparable form."""
    text = normalize_persian(title)
    text = _DIACRITICS_RE.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def extract_title_phrases(comments: list) -> frozenset[str]:
    """Extract bigrams and trigrams from video titles. Used to filter title phrases from
    discourse analysis (e.g. cluster labels, PMI, word cloud) without removing individual words.
    Example: title 'جنگ صلیبی چیست' -> {'جنگ صلیبی', 'صلیبی چیست', 'جنگ صلیبی چیست'}.
    Normalizes titles before extraction so variants (جنگ‌های/جنگ های/جنگهاي صليبي) match."""
    phrases: set[str] = set()
    seen_normalized: set[str] = set()
    for c in comments:
        if not isinstance(c, dict):
            continue
        title = c.get("video_title") or c.get("title") or ""
        if not title or not isinstance(title, str):
            continue
        normalized_title = _normalize_title_for_phrases(title)
        if not normalized_title or normalized_title in seen_normalized:
            continue
        seen_normalized.add(normalized_title)
        tokens = [
            t
            for t in normalized_title.split()
            if len(t) >= 2 and not any(ch.isdigit() for ch in t)
        ]
        if len(tokens) >= 2:
            for bg in generate_bigrams(tokens):
                phrases.add(_normalize_phrase_for_match(bg))
        if len(tokens) >= 3:
            for tg in generate_trigrams(tokens):
                phrases.add(_normalize_phrase_for_match(tg))
    return frozenset(phrases)


def compute_bigram_pmi(bigram_counter, word_counter, total_tokens, title_phrase_stopwords: frozenset[str] | None = None):
    title_stop = title_phrase_stopwords or frozenset()
    pmi_scores = []
    for phrase, count in bigram_counter.items():
        if phrase in PHRASE_STOPWORDS or phrase in CHANNEL_STOPWORDS or _normalize_phrase_for_match(phrase) in title_stop:
            continue
        parts = phrase.split()
        if len(parts) != 2:
            continue
        w1, w2 = parts[0], parts[1]
        p_w1 = word_counter.get(w1, 0) / total_tokens
        p_w2 = word_counter.get(w2, 0) / total_tokens
        p_w1w2 = count / total_tokens

        if p_w1w2 > 0 and p_w1 > 0 and p_w2 > 0:
            pmi = math.log(p_w1w2 / (p_w1 * p_w2))
            if count >= 3:
                pmi_scores.append((phrase, pmi, count))

    pmi_scores.sort(key=lambda x: x[1], reverse=True)
    return pmi_scores[:20]


def compute_trigram_pmi(trigram_counter, word_counter, total_tokens, title_phrase_stopwords: frozenset[str] | None = None):
    title_stop = title_phrase_stopwords or frozenset()
    pmi_scores = []
    for phrase, count in trigram_counter.items():
        if count < 2:
            continue
        if _normalize_phrase_for_match(phrase) in title_stop:
            continue
        parts = phrase.split()
        if len(parts) != 3:
            continue
        w1, w2, w3 = parts[0], parts[1], parts[2]
        p_w1 = word_counter.get(w1, 0) / total_tokens
        p_w2 = word_counter.get(w2, 0) / total_tokens
        p_w3 = word_counter.get(w3, 0) / total_tokens
        p_w1w2w3 = count / total_tokens

        if p_w1w2w3 > 0 and p_w1 > 0 and p_w2 > 0 and p_w3 > 0:
            pmi = math.log(p_w1w2w3 / (p_w1 * p_w2 * p_w3))
            pmi_scores.append((phrase, pmi, count))

    pmi_scores.sort(key=lambda x: x[1], reverse=True)
    return pmi_scores[:15]


def _dedupe_phrase(phrase: str) -> str:
    """Remove repeated tokens: 'ایران ایران ایران' → 'ایران', 'جاوید شاه جاوید' → 'جاوید شاه'."""
    tokens = phrase.split()
    seen: list[str] = []
    for t in tokens:
        if t not in seen:
            seen.append(t)
    return " ".join(seen)


def _phrase_stopword_ratio(phrase: str) -> float:
    """Return fraction of tokens that are stopwords or praise words. >0.5 means reject."""
    tokens = phrase.split()
    if not tokens:
        return 0.0
    bad = ALL_STOPWORDS | PRAISE_WORDS
    bad_count = sum(1 for t in tokens if t.lower() in bad)
    return bad_count / len(tokens)


def _has_numeric_tokens(phrase: str) -> bool:
    """Reject phrases/words that contain digits (e.g. timestamps like 31:29, 4430)."""
    for t in phrase.split():
        if any(c.isdigit() for c in t):
            return True
    return False


def _is_mostly_ascii(phrase: str) -> bool:
    """Reject labels that are predominantly ASCII letters (likely English)."""
    letters = [c for c in phrase if c.isalpha()]
    if not letters:
        return False
    ascii_count = sum(1 for c in letters if ord(c) < 128)
    return ascii_count >= len(letters) / 2


def _has_persian(phrase: str) -> bool:
    """Require at least one Persian character (reject pure ASCII)."""
    return any("\u0600" <= c <= "\u06FF" for c in phrase)


def _valid_token(t: str) -> bool:
    """Token passes: no digits, len>=3, not mixed-language."""
    if not t or len(t) < 3:
        return False
    if any(c.isdigit() for c in t):
        return False
    if _is_mostly_ascii(t):
        return False
    return True


def classify_comment_topics(tokens: list[str]) -> set[str]:
    topics = set()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in tokens:
                topics.add(topic)
                break
    return topics


PRAISE_KEYWORDS = [
    "دمت", "مرسی", "تشکر", "خسته", "دمت گرم",
    "عالی", "مثل همیشه عالی", "دمت گرم علی",
    "خسته نباشید", "دمتون گرم", "thank", "thanks", "great", "well done",
]

# Keywords for collapsing praise clusters (40% threshold)
PRAISE_CLUSTER_KEYWORDS = [
    "عالی",
    "مرسی",
    "دمت",
    "خسته نباشید",
    "مثل همیشه عالی",
]

PRAISE_CLUSTER_THRESHOLD = 0.4


def is_praise_comment(text: str) -> bool:
    """Return True if text contains any praise keyword/phrase."""
    if not text or not isinstance(text, str):
        return False
    t = normalize_persian(text)
    for kw in PRAISE_KEYWORDS:
        if kw in t:
            return True
    return False


def _contains_praise_keyword(text: str, keywords: list[str]) -> bool:
    """Return True if text contains any of the given keywords (for cluster detection)."""
    if not text or not isinstance(text, str):
        return False
    t = normalize_persian(text)
    for kw in keywords:
        if kw in t:
            return True
    return False


PRAISE_LABEL_FILTER = frozenset({
    "دمت", "مرسی", "تشکر", "خسته", "دمت گرم", "دمت گرم علی",
    "عالی", "مثل همیشه عالی", "خسته نباشید", "دمتون گرم",
    "thank", "thanks", "great", "well done", "well done ali",
    "thank you", "great video", "مرسی هستین",
})


def _is_praise_cluster(comment_texts: list[str]) -> bool:
    """A cluster is labeled 'praise / appreciation' if >= 40% of comments contain praise keywords."""
    if not comment_texts:
        return False
    valid_texts = [t for t in comment_texts if t and isinstance(t, str)]
    if not valid_texts:
        return False
    praise_count = sum(1 for t in valid_texts if _contains_praise_keyword(t, PRAISE_CLUSTER_KEYWORDS))
    return praise_count / len(valid_texts) >= PRAISE_CLUSTER_THRESHOLD


def compute_cluster_label(
    comment_texts: list[str],
    all_texts: list[str] | None = None,
    raw_texts_for_praise: list[str] | None = None,
    title_phrase_stopwords: frozenset[str] | None = None,
) -> str:
    """TF-IDF centroid labeling: top tokens from cluster centroid, filtered.
    Produces topic labels (تاریخ ایران, دین اسلام) instead of sentence fragments.
    Fallback: 'تحسین' if tokens are mostly praise words."""
    if DEBUG_CLUSTER_LABELS:
        return "DEBUG_LABEL"
    texts_for_praise = raw_texts_for_praise if raw_texts_for_praise is not None else comment_texts
    if _is_praise_cluster(texts_for_praise):
        return "praise / appreciation"

    texts = [t for t in comment_texts if t and isinstance(t, str)]
    if len(texts) < 1:
        return "(cluster)"

    from sklearn.feature_extraction.text import TfidfVectorizer

    stop_list = list(PERSIAN_STOPWORDS | STOPWORDS | CUSTOM_STOPWORDS | LABEL_TOKEN_FILTER)
    corpus = all_texts if (all_texts and len(all_texts) >= 2) else texts

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 1),
        min_df=1,
        stop_words=stop_list,
        token_pattern=r"(?u)\b[\u0600-\u06FFa-zA-Z]{3,}\b",
    )
    try:
        X_corpus = vectorizer.fit_transform(corpus)
        X_cluster = vectorizer.transform(texts)
    except ValueError:
        return "(cluster)"

    if X_cluster.shape[1] == 0:
        return "(cluster)"

    feature_names = vectorizer.get_feature_names_out()
    centroid = X_cluster.mean(axis=0).A1

    # Top 5 tokens by centroid weight
    scored = [(feature_names[i], float(centroid[i])) for i in range(len(feature_names))]
    scored.sort(key=lambda x: -x[1])
    top5 = [t for t, _ in scored[:5] if _ > 0]

    # Filter: verb-like, conversational, digits
    filtered = []
    for t in top5:
        if _is_verb_like_phrase(t):
            continue
        if t.lower() in LABEL_TOKEN_FILTER:
            continue
        if any(c.isdigit() for c in t):
            continue
        if len(t) < 3:
            continue
        filtered.append(t)

    # Fallback: if mostly praise tokens, use "تحسین"
    praise_count = sum(1 for t in filtered if t.lower() in PRAISE_LABEL_TOKENS)
    if filtered and praise_count >= len(filtered) / 2:
        return "تحسین"

    # Select top 2 remaining tokens
    top2 = filtered[:2]
    if not top2:
        return "(cluster)"
    label = " ".join(top2)
    return _dedupe_phrase(label)[:40]


def _accept_phrase_for_label(phrase: str, title_stop: frozenset[str], stop_list: list) -> bool:
    """Shared phrase acceptance for semantic and TF-IDF labeling."""
    if not phrase or phrase in PHRASE_STOPWORDS or phrase in CHANNEL_STOPWORDS:
        return False
    if _is_verb_like_phrase(phrase):
        return False
    if _starts_with_conversational_marker(phrase):
        return False
    if _normalize_phrase_for_match(phrase) in title_stop:
        return False
    if phrase in PRAISE_LABEL_FILTER:
        return False
    if _has_numeric_tokens(phrase):
        return False
    for t in phrase.split():
        if len(t) < 3 or any(c.isdigit() for c in t):
            return False
        if t.lower() in stop_list:
            return False
    return True


def compute_cluster_label_semantic(
    comment_texts: list[str],
    embedding_indices: list[int],
    embeddings: np.ndarray,
    raw_texts_for_praise: list[str] | None = None,
    title_phrase_stopwords: frozenset[str] | None = None,
) -> str:
    """Label cluster by semantic similarity: phrase embedding vs cluster centroid.
    Falls back to 'discussion' if no good phrase."""
    if DEBUG_CLUSTER_LABELS:
        return "DEBUG_LABEL"
    if raw_texts_for_praise and _is_praise_cluster(raw_texts_for_praise):
        return "praise / appreciation"

    texts = [t for t in comment_texts if t and isinstance(t, str)]
    if len(texts) < 1 or embeddings is None or len(embedding_indices) < 1:
        return "discussion"

    model = _get_minilm_model()
    if model is None:
        return "discussion"

    title_stop = title_phrase_stopwords or frozenset()
    stop_list = list(PERSIAN_STOPWORDS | STOPWORDS | CUSTOM_STOPWORDS)

    # 1. Cluster centroid
    valid_idx = [i for i in embedding_indices if 0 <= i < len(embeddings)]
    if not valid_idx:
        return "discussion"
    centroid = np.mean(embeddings[valid_idx], axis=0)
    centroid_norm = centroid / (np.linalg.norm(centroid) + 1e-9)

    # 2. Extract candidate phrases (unigrams, bigrams, trigrams)
    phrase_counts: Counter[str] = Counter()
    for text in texts:
        tokens = tokenize(text)
        for t in tokens:
            if len(t) >= 3 and not any(c.isdigit() for c in t) and t.lower() not in stop_list and not _is_verb_like_phrase(t):
                phrase_counts[t] += 1
        for bg in generate_bigrams(tokens):
            if _accept_phrase_for_label(bg, title_stop, stop_list):
                phrase_counts[bg] += 1
        for tg in generate_trigrams(tokens):
            if _accept_phrase_for_label(tg, title_stop, stop_list):
                phrase_counts[tg] += 1

    # 3. Prefer bigrams, then trigrams only if no suitable bigram (noun-like labels)
    candidates = [p for p, _ in phrase_counts.most_common(80)]
    if not candidates:
        return "discussion"

    try:
        phrase_embeddings = model.encode(candidates, normalize_embeddings=True)
    except Exception:
        return "discussion"

    def best_in_tier(expected_ngram_len: int, min_sim: float = 0.1) -> tuple[str | None, float]:
        best_p, best_s = None, -1.0
        for i, phrase in enumerate(candidates):
            if len(phrase.split()) != expected_ngram_len:
                continue
            if i >= len(phrase_embeddings):
                break
            sim = float(np.dot(centroid_norm, phrase_embeddings[i]))
            if sim > best_s and sim >= min_sim:
                best_s = sim
                best_p = phrase
        return best_p, best_s

    for n in [2, 3, 1]:  # bigrams first, then trigrams, then unigrams
        best_phrase, best_sim = best_in_tier(n)
        if best_phrase and best_sim > 0.1:
            return _dedupe_phrase(best_phrase)[:40]
    return "discussion"


def _compute_tfidf_embeddings(to_map: list[str]):
    """Step 2: Compute TF-IDF embeddings from comment texts.
    norm='l2' and sublinear_tf reduce document-length bias for PCA."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        min_df=2,
        max_df=0.85,
        max_features=200,
        norm="l2",
        sublinear_tf=True,
        token_pattern=r"(?u)\b[\u0600-\u06FF]+\b",
    )
    X = vectorizer.fit_transform(to_map)
    return X.toarray()


def _run_umap(embeddings, random_state: int = 42):
    """Step 3: Run UMAP with fixed seed. Returns 2D coords or None. Uses lock to avoid Numba concurrent access.
    Deterministic: same embedding for identical inputs."""
    import umap
    with _umap_lock:
        reducer = umap.UMAP(
            n_neighbors=15,
            min_dist=0.1,
            n_components=2,
            metric="cosine",
            random_state=random_state,
        )
        return reducer.fit_transform(embeddings)


def _cluster_kmeans(
    coords, comments: list, to_map: list, title_phrase_stopwords: frozenset[str] | None = None,
    embeddings: np.ndarray | None = None,
) -> tuple[list[dict], dict, list[int]]:
    """Step 4: KMeans clustering for TF-IDF pipeline. Returns (labels, stats, cluster_assignments)."""
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=4, random_state=0)
    cluster_ids = kmeans.fit_predict(coords)
    labels, stats, assignments = _cluster_labels_from_coords(
        coords, cluster_ids, comments, to_map,
        title_phrase_stopwords=title_phrase_stopwords,
        embeddings=embeddings,
    )
    return labels, stats, assignments


def _cluster_hdbscan(
    coords, comments: list, to_map: list, min_cluster_size: int = 8, title_phrase_stopwords: frozenset[str] | None = None,
    embeddings: np.ndarray | None = None,
) -> tuple[list[dict], dict, list[int]]:
    """Step 4: HDBSCAN clustering. Returns (labels, stats, cluster_assignments)."""
    import hdbscan
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, min_samples=min(min_cluster_size // 2, 4))
    cluster_ids = clusterer.fit_predict(coords)
    labels, stats, assignments = _cluster_labels_from_coords(
        coords, cluster_ids, comments, to_map,
        title_phrase_stopwords=title_phrase_stopwords,
        embeddings=embeddings,
    )
    return labels, stats, assignments


def _compute_pca_points(X_dense, to_map: list, comments: list) -> list:
    """PCA projection of embeddings (linear dimensionality reduction). Computed before UMAP."""
    from sklearn.decomposition import PCA
    pca = PCA(n_components=2, random_state=42)
    coords_pca = pca.fit_transform(X_dense)
    return [
        {
            "x": round(float(coords_pca[i][0]), 2),
            "y": round(float(coords_pca[i][1]), 2),
            "text": comments[i].get("comment_text", "") or to_map[i] or "",
        }
        for i in range(len(to_map))
    ]


_MINILM_MODEL = None


def _get_minilm_model():
    """Lazy-load and cache MiniLM model for embeddings."""
    global _MINILM_MODEL
    if _MINILM_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            _MINILM_MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        except Exception as e:
            log.warning("MiniLM model load failed: %s", e)
    return _MINILM_MODEL


def _compute_minilm_embeddings(to_map: list, comments: list):
    """Step 2: Compute MiniLM sentence transformer embeddings."""
    model = _get_minilm_model()
    if model is None:
        return None
    try:
        raw_texts = [comments[i].get("comment_text", "") or to_map[i] or "" for i in range(len(to_map))]
        return model.encode(raw_texts)
    except Exception as e:
        log.warning("MiniLM embeddings failed: %s", e)
        return None


def _make_labels_unique(labels: list[dict]) -> list[dict]:
    """Ensure cluster labels are unique. If duplicate, append numeric suffix: تدی, تدی 2, تدی 3."""
    label_counts: dict[str, int] = {}
    result = []
    for item in labels:
        label = item.get("label", "(cluster)")
        count = label_counts.get(label, 0)
        label_counts[label] = count + 1
        if count > 0:
            label = f"{label} {count + 1}"
        result.append({**item, "label": label})
    return result


def _cluster_labels_from_coords(
    coords: list,
    cluster_ids: list,
    comments: list,
    to_map: list,
    title_phrase_stopwords: frozenset[str] | None = None,
    embeddings: np.ndarray | None = None,
) -> tuple[list[dict], dict, list[int]]:
    """Build cluster labels from coords and cluster assignments. Handles HDBSCAN (-1 = noise).
    Returns (labels, stats, cluster_assignments) where stats has clusters, noise_count, total.
    Labels are unique; duplicates get numeric suffix (e.g. تدی 2, تدی 3).
    When embeddings provided, uses semantic similarity (MiniLM) for labeling."""
    clusters: dict[int, list[int]] = {}
    noise_count = 0
    for i, cid in enumerate(cluster_ids):
        if cid < 0:
            noise_count += 1
            continue
        if cid not in clusters:
            clusters[cid] = []
        clusters[cid].append(i)
    total = len(cluster_ids)
    result = []
    use_semantic = embeddings is not None and len(embeddings) >= len(to_map)
    for cid, indices in sorted(clusters.items()):
        if not indices:
            continue
        cluster_texts = [to_map[i] for i in indices if i < len(to_map)]
        raw_texts = [comments[i].get("comment_text", "") for i in indices if i < len(comments)]
        if use_semantic:
            label = compute_cluster_label_semantic(
                cluster_texts,
                embedding_indices=indices,
                embeddings=embeddings,
                raw_texts_for_praise=raw_texts,
                title_phrase_stopwords=title_phrase_stopwords,
            )
        else:
            label = compute_cluster_label(
                cluster_texts,
                all_texts=to_map,
                raw_texts_for_praise=raw_texts,
                title_phrase_stopwords=title_phrase_stopwords,
            )
        x = float(sum(coords[i][0] for i in indices) / len(indices))
        y = float(sum(coords[i][1] for i in indices) / len(indices))
        result.append({"x": round(x, 2), "y": round(y, 2), "label": label, "cluster_id": int(cid)})
    result = _make_labels_unique(result)
    stats = {"clusters": len(result), "noise_count": noise_count, "total": total}
    cluster_assignments = [int(cid) for cid in cluster_ids]
    return result, stats, cluster_assignments


def _clusters_summary(
    cluster_labels: list[dict],
    cluster_assignments: list[int],
) -> list[dict]:
    """Build clusters_summary: [{label, size, percent}, ...] for API response."""
    if not cluster_labels or not cluster_assignments:
        return []
    total = len(cluster_assignments)
    if total == 0:
        return []
    counts: dict[int, int] = {}
    for cid in cluster_assignments:
        if cid >= 0:
            counts[cid] = counts.get(cid, 0) + 1
    summary = []
    for cl in cluster_labels:
        cid = cl.get("cluster_id", -1)
        if cid < 0:
            continue
        size = counts.get(cid, 0)
        if size == 0:
            continue
        percent = round(size / total * 100, 1)
        summary.append({"label": cl.get("label", ""), "size": size, "percent": percent})
    noise_count = sum(1 for cid in cluster_assignments if cid < 0)
    if noise_count > 0:
        summary.append({"label": "noise / unclustered", "size": noise_count, "percent": round(noise_count / total * 100, 1)})
    return summary


def _point_to_xy(p) -> tuple[float, float] | None:
    """Extract (x, y) from point in [x,y,i] or {x,y} format."""
    try:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            return (float(p[0]), float(p[1]))
        if isinstance(p, dict):
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                return (float(x), float(y))
    except (TypeError, ValueError):
        pass
    return None


def compute_cluster_labels_from_umap(
    points_umap: list,
    comments: list,
    k: int = 4,
) -> list[dict]:
    """
    Compute cluster labels from existing UMAP points and comments.
    Used when loading from cache that lacks cluster_labels.
    Uses semantic similarity (MiniLM) when embeddings available.
    """
    if not points_umap or len(points_umap) < 2 or not comments:
        return []
    try:
        from sklearn.cluster import KMeans
        title_phrase_stopwords = extract_title_phrases(comments)
        coords = []
        for p in points_umap:
            xy = _point_to_xy(p)
            if xy is not None:
                coords.append(list(xy))
        if len(coords) < 2:
            return []
        kmeans = KMeans(n_clusters=k, random_state=0)
        cluster_ids = kmeans.fit_predict(coords)
        clusters: dict[int, list[int]] = {i: [] for i in range(k)}
        for i, cid in enumerate(cluster_ids):
            clusters[cid].append(i)

        # Build to_map-like texts and embeddings for semantic labeling
        def _comment_idx(i: int) -> int:
            p = points_umap[i] if i < len(points_umap) else None
            if isinstance(p, (list, tuple)) and len(p) >= 3 and p[2] < len(comments):
                return p[2]
            return i if i < len(comments) else 0

        to_map = [comments[_comment_idx(i)].get("comment_text", "") or "" for i in range(len(points_umap))]
        embeddings = None
        if to_map:
            model = _get_minilm_model()
            if model is not None:
                try:
                    embeddings = model.encode(to_map, normalize_embeddings=True)
                except Exception:
                    pass

        cluster_labels = []
        for cid in range(k):
            indices = clusters[cid]
            if not indices:
                continue
            comment_texts = [comments[_comment_idx(i)].get("comment_text", "") for i in indices]
            raw_texts = comment_texts
            if embeddings is not None and len(embeddings) >= len(points_umap):
                label = compute_cluster_label_semantic(
                    comment_texts,
                    embedding_indices=indices,
                    embeddings=embeddings,
                    raw_texts_for_praise=raw_texts,
                    title_phrase_stopwords=title_phrase_stopwords,
                )
            else:
                all_texts = [c.get("comment_text", "") for c in comments]
                label = compute_cluster_label(
                    comment_texts, all_texts=all_texts, title_phrase_stopwords=title_phrase_stopwords
                )
            xs = [float(coords[i][0]) for i in indices]
            ys = [float(coords[i][1]) for i in indices]
            x = float(sum(xs) / len(xs))
            y = float(sum(ys) / len(ys))
            cluster_labels.append({"x": round(x, 2), "y": round(y, 2), "label": label})
        return _make_labels_unique(cluster_labels)
    except Exception:
        return []


def analyze_comments(comments):
    title_phrase_stopwords = extract_title_phrases(comments)
    word_counter = Counter()
    bigram_counter = Counter()
    trigram_counter = Counter()
    topic_counter = Counter()
    sentiments = []

    for c in comments:
        text = c.get("comment_text", "")

        # sentiment
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity

        sentiments.append(polarity)

        c["sentiment"] = polarity

        # words
        tokens = tokenize(text)
        word_counter.update(tokens)

        bigrams = generate_bigrams(tokens)
        bigram_counter.update(bigrams)

        trigrams = generate_trigrams(tokens)
        trigram_counter.update(trigrams)

        # topics (check tokens + bigrams for multi-word keywords like "جاوید شاه")
        terms = tokens + bigrams
        topics = classify_comment_topics(terms)
        for t in topics:
            topic_counter[t] += 1

    top_bigrams = [
        (phrase, count)
        for phrase, count in bigram_counter.items()
        if count >= 3
        and phrase not in PHRASE_STOPWORDS
        and phrase not in CHANNEL_STOPWORDS
        and _normalize_phrase_for_match(phrase) not in title_phrase_stopwords
    ]
    top_bigrams = sorted(top_bigrams, key=lambda x: x[1], reverse=True)[:30]

    top_trigrams = [
        (phrase, count)
        for phrase, count in trigram_counter.items()
        if count >= 2 and _normalize_phrase_for_match(phrase) not in title_phrase_stopwords
    ]
    top_trigrams = sorted(top_trigrams, key=lambda x: x[1], reverse=True)[:20]

    total_tokens = sum(word_counter.values()) or 1
    bigrams_pmi = compute_bigram_pmi(
        bigram_counter, word_counter, total_tokens, title_phrase_stopwords=title_phrase_stopwords
    )
    trigrams_pmi = compute_trigram_pmi(
        trigram_counter, word_counter, total_tokens, title_phrase_stopwords=title_phrase_stopwords
    )

    combined_terms = list(word_counter.most_common(40))
    combined_terms.extend(top_bigrams)
    top_words = combined_terms

    avg_sentiment = 0
    if sentiments:
        avg_sentiment = sum(sentiments) / len(sentiments)

    # 2D discourse maps: recompute embeddings and clustering from cached comments
    clean_comments = []
    for c in comments:
        tokens = tokenize(c.get("comment_text", ""))
        clean_comments.append(" ".join(tokens))

    discourse_comments = []
    points_pca = []
    points_tfidf = []
    points_minilm = []
    cluster_labels_tfidf: list[dict] = []
    cluster_labels_hdbscan: list[dict] = []
    cluster_labels_minilm: list[dict] = []
    cluster_assignments_tfidf: list[int] = []
    cluster_assignments_hdbscan: list[int] = []
    cluster_assignments_minilm: list[int] = []
    cluster_stats_tfidf: dict = {}
    cluster_stats_hdbscan: dict = {}
    cluster_stats_minilm: dict = {}
    MAX_DISCOURSE = 500  # cap for TF-IDF to keep response fast
    to_map = clean_comments[:MAX_DISCOURSE] if len(clean_comments) > MAX_DISCOURSE else clean_comments

    if len(to_map) >= 2:
        minilm_embeddings = _compute_minilm_embeddings(to_map, comments)

        try:
            # Step 2: Compute TF-IDF embeddings
            tfidf_embeddings = _compute_tfidf_embeddings(to_map)
            if tfidf_embeddings is None:
                raise ValueError("TF-IDF failed")

            # PCA (legacy) — compute early so it's not lost if UMAP/clustering fails
            try:
                points_pca = _compute_pca_points(tfidf_embeddings, to_map, comments)
            except Exception:
                points_pca = []

            # Step 3: Run UMAP for each embedding (random_state=42)
            umap_tfidf = _run_umap(tfidf_embeddings)
            if umap_tfidf is not None:
                for i, _ in enumerate(to_map):
                    display_text = (comments[i].get("comment_text", "") or to_map[i] or "")[:120]
                    display_text = display_text.strip() or "(no text)"
                    discourse_comments.append(display_text)
                    x = round(float(umap_tfidf[i][0]), 2)
                    y = round(float(umap_tfidf[i][1]), 2)
                    points_tfidf.append([x, y, i])

                # Step 4: Run clustering for TF-IDF pipeline (semantic labels when MiniLM available)
                cluster_labels_tfidf, cluster_stats_tfidf, cluster_assignments_tfidf = _cluster_kmeans(
                    umap_tfidf, comments, to_map, title_phrase_stopwords=title_phrase_stopwords,
                    embeddings=minilm_embeddings,
                )
                cluster_labels_hdbscan, cluster_stats_hdbscan, cluster_assignments_hdbscan = _cluster_hdbscan(
                    umap_tfidf, comments, to_map, title_phrase_stopwords=title_phrase_stopwords,
                    embeddings=minilm_embeddings,
                )

        except Exception:
            pass

        # MiniLM in its own try so TF-IDF failures don't block it
        try:
            if minilm_embeddings is not None:
                umap_minilm = _run_umap(minilm_embeddings)
                if umap_minilm is not None:
                    for i, _ in enumerate(to_map):
                        x = round(float(umap_minilm[i][0]), 2)
                        y = round(float(umap_minilm[i][1]), 2)
                        points_minilm.append([x, y, i])
                    cluster_labels_minilm, cluster_stats_minilm, cluster_assignments_minilm = _cluster_hdbscan(
                        umap_minilm, comments, to_map, min_cluster_size=5, title_phrase_stopwords=title_phrase_stopwords,
                        embeddings=minilm_embeddings,
                    )
        except Exception as e:
            log.warning("MiniLM pipeline failed: %s", e)

    # Backward compatibility: points_umap = points_tfidf, cluster_labels = cluster_labels_tfidf
    points_umap = points_tfidf
    cluster_labels = cluster_labels_tfidf

    clusters_summary_tfidf = _clusters_summary(cluster_labels_tfidf, cluster_assignments_tfidf)
    clusters_summary_hdbscan = _clusters_summary(cluster_labels_hdbscan, cluster_assignments_hdbscan)
    clusters_summary_minilm = _clusters_summary(cluster_labels_minilm, cluster_assignments_minilm)

    labels = [c.get("label", "") for c in cluster_labels_tfidf]
    print("[cluster_labels]", json.dumps(labels, ensure_ascii=False))

    return {
        "avg_sentiment": avg_sentiment,
        "top_words": top_words,
        "topics": topic_counter.most_common(),
        "trigrams": top_trigrams,
        "bigrams_pmi": bigrams_pmi,
        "trigrams_pmi": trigrams_pmi,
        "discourse_comments": discourse_comments,
        "points_pca": points_pca,
        "points_umap": points_umap,
        "points_tfidf": points_tfidf,
        "points_hdbscan": points_tfidf,  # same coords as TF-IDF
        "points_minilm": points_minilm,
        "cluster_labels": cluster_labels,
        "cluster_labels_tfidf": cluster_labels_tfidf,
        "cluster_labels_hdbscan": cluster_labels_hdbscan,
        "cluster_labels_minilm": cluster_labels_minilm,
        "cluster_assignments_tfidf": cluster_assignments_tfidf,
        "cluster_assignments_hdbscan": cluster_assignments_hdbscan,
        "cluster_assignments_minilm": cluster_assignments_minilm,
        "cluster_stats_tfidf": cluster_stats_tfidf,
        "cluster_stats_hdbscan": cluster_stats_hdbscan,
        "cluster_stats_minilm": cluster_stats_minilm,
        "clusters_summary_tfidf": clusters_summary_tfidf,
        "clusters_summary_hdbscan": clusters_summary_hdbscan,
        "clusters_summary_minilm": clusters_summary_minilm,
        "comments": comments
    }

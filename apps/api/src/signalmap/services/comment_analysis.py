# -*- coding: utf-8 -*-
import json
import math
import re
from pathlib import Path
from collections import Counter
from textblob import TextBlob

# Lazy imports for sklearn/umap to speed up API startup (healthcheck passes faster)


def load_cached_snapshot(channel_id: str) -> dict | None:
    """Load precomputed analysis from JSON snapshot. Returns None if file does not exist."""
    base = Path(__file__).resolve().parent.parent.parent.parent
    path = base / "data" / "youtube_cache" / f"{channel_id}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def load_persian_stopwords():
    path = Path(__file__).parent.parent / "data" / "persian_stopwords.txt"
    with open(path, encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip()}


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

PERSIAN_STOPWORDS = load_persian_stopwords()

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


def looks_like_verb(word):
    return any(word.endswith(suffix) for suffix in VERB_SUFFIXES)


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


def compute_bigram_pmi(bigram_counter, word_counter, total_tokens):
    pmi_scores = []
    for phrase, count in bigram_counter.items():
        if phrase in PHRASE_STOPWORDS or phrase in CHANNEL_STOPWORDS:
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


def compute_trigram_pmi(trigram_counter, word_counter, total_tokens):
    pmi_scores = []
    for phrase, count in trigram_counter.items():
        if count < 2:
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


def classify_comment_topics(tokens: list[str]) -> set[str]:
    topics = set()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in tokens:
                topics.add(topic)
                break
    return topics


def compute_cluster_label(comment_texts: list[str]) -> str:
    """Extract most frequent meaningful phrase; fallback to most common word."""
    word_counter = Counter()
    bigram_counter = Counter()
    trigram_counter = Counter()
    for text in comment_texts:
        if not text or not isinstance(text, str):
            continue
        tokens = tokenize(text)
        word_counter.update(tokens)
        bigram_counter.update(generate_bigrams(tokens))
        trigram_counter.update(generate_trigrams(tokens))
    # Priority: trigram (≥2) > bigram (≥2) > most frequent meaningful word
    for phrase, count in trigram_counter.most_common():
        if count >= 2 and phrase not in PHRASE_STOPWORDS and _phrase_stopword_ratio(phrase) <= 0.5:
            return _dedupe_phrase(phrase)
    for phrase, count in bigram_counter.most_common():
        if count >= 2 and phrase not in PHRASE_STOPWORDS and phrase not in CHANNEL_STOPWORDS and _phrase_stopword_ratio(phrase) <= 0.5:
            return _dedupe_phrase(phrase)
    if word_counter:
        word, _ = word_counter.most_common(1)[0]
        if word:
            return word
    return "(cluster)"


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
    """
    if not points_umap or len(points_umap) < 2 or not comments:
        return []
    try:
        from sklearn.cluster import KMeans
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
        cluster_labels = []
        for cid in range(k):
            indices = clusters[cid]
            if not indices:
                continue
            comment_texts = [
                comments[i].get("comment_text", "")
                for i in indices
                if i < len(comments)
            ]
            label = compute_cluster_label(comment_texts)
            xs = [float(coords[i][0]) for i in indices]
            ys = [float(coords[i][1]) for i in indices]
            x = float(sum(xs) / len(xs))
            y = float(sum(ys) / len(ys))
            cluster_labels.append({"x": round(x, 2), "y": round(y, 2), "label": label})
        return cluster_labels
    except Exception:
        return []


def analyze_comments(comments):
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
        if count >= 3 and phrase not in PHRASE_STOPWORDS and phrase not in CHANNEL_STOPWORDS
    ]
    top_bigrams = sorted(top_bigrams, key=lambda x: x[1], reverse=True)[:30]

    top_trigrams = [
        (phrase, count)
        for phrase, count in trigram_counter.items()
        if count >= 2
    ]
    top_trigrams = sorted(top_trigrams, key=lambda x: x[1], reverse=True)[:20]

    total_tokens = sum(word_counter.values()) or 1
    bigrams_pmi = compute_bigram_pmi(bigram_counter, word_counter, total_tokens)
    trigrams_pmi = compute_trigram_pmi(trigram_counter, word_counter, total_tokens)

    combined_terms = list(word_counter.most_common(40))
    combined_terms.extend(top_bigrams)
    top_words = combined_terms

    avg_sentiment = 0
    if sentiments:
        avg_sentiment = sum(sentiments) / len(sentiments)

    # 2D discourse map
    clean_comments = []
    for c in comments:
        tokens = tokenize(c.get("comment_text", ""))
        clean_comments.append(" ".join(tokens))

    discourse_comments = []
    points_pca = []
    points_umap = []
    cluster_labels: list[dict] = []
    MAX_DISCOURSE = 500  # cap for TF-IDF to keep response fast
    to_map = clean_comments[:MAX_DISCOURSE] if len(clean_comments) > MAX_DISCOURSE else clean_comments
    if len(to_map) >= 2:
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.decomposition import PCA
            from sklearn.cluster import KMeans
            import umap
            vectorizer = TfidfVectorizer(
                max_features=200,
                token_pattern=r"(?u)\b[\u0600-\u06FF]+\b"
            )
            X = vectorizer.fit_transform(to_map)
            X_dense = X.toarray()

            # PCA projection
            pca = PCA(n_components=2)
            coords_pca = pca.fit_transform(X_dense)
            for i, _ in enumerate(to_map):
                display_text = (comments[i].get("comment_text", "") or to_map[i] or "")[:120]
                display_text = display_text.strip() or "(no text)"
                discourse_comments.append(display_text)
                x = round(float(coords_pca[i][0]), 2)
                y = round(float(coords_pca[i][1]), 2)
                points_pca.append([x, y, i])

            # UMAP projection
            reducer = umap.UMAP(
                n_components=2,
                n_neighbors=15,
                min_dist=0.3,
                metric="cosine",
                random_state=42,
            )
            coords_umap = reducer.fit_transform(X_dense)
            for i, _ in enumerate(to_map):
                x = round(float(coords_umap[i][0]), 2)
                y = round(float(coords_umap[i][1]), 2)
                points_umap.append([x, y, i])

            # K-means clustering and cluster labels
            k = 4
            kmeans = KMeans(n_clusters=k, random_state=0)
            cluster_ids = kmeans.fit_predict(coords_umap)
            clusters = {i: [] for i in range(k)}
            for i, cid in enumerate(cluster_ids):
                clusters[cid].append(i)
            cluster_labels = []
            for cid in range(k):
                indices = clusters[cid]
                if not indices:
                    continue
                comment_texts = [
                    comments[i].get("comment_text", "")
                    for i in indices
                    if i < len(comments)
                ]
                label = compute_cluster_label(comment_texts)
                x = float(sum(coords_umap[i][0] for i in indices) / len(indices))
                y = float(sum(coords_umap[i][1] for i in indices) / len(indices))
                cluster_labels.append({"x": round(x, 2), "y": round(y, 2), "label": label})
        except Exception:
            cluster_labels = []
    else:
        cluster_labels = []

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
        "cluster_labels": cluster_labels,
        "comments": comments
    }

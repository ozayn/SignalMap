# -*- coding: utf-8 -*-
import json
import logging
import math
import re
import threading
from pathlib import Path

log = logging.getLogger(__name__)
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
    Does NOT modify the cache. Returns None if no comments.
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


PRAISE_INDICATORS = frozenset({
    "thank", "thanks", "great", "دمت", "مرسی", "خسته",
})
PRAISE_PHRASES = frozenset({"well done"})


def _is_praise_cluster(comment_texts: list[str]) -> bool:
    """Detect if cluster content is dominated by praise/appreciation.
    Requires praise in a majority of comments, not just any occurrence."""
    if not comment_texts:
        return False
    praise_count = 0
    for t in comment_texts:
        if not t or not isinstance(t, str):
            continue
        toks = t.lower().split()
        tokens_set = set(toks)
        bigrams = {f"{toks[i]} {toks[i+1]}" for i in range(len(toks) - 1)}
        if (tokens_set & PRAISE_INDICATORS) or (bigrams & PRAISE_PHRASES):
            praise_count += 1
    return praise_count >= len(comment_texts) / 2


def compute_cluster_label(comment_texts: list[str]) -> str:
    """Extract cluster label using TF-IDF within cluster. Prefer bigrams.
    Rules: no digits, len>=3 per token, no mixed-language, prefer bigrams."""
    if _is_praise_cluster(comment_texts):
        return "praise / appreciation"

    N = len([t for t in comment_texts if t and isinstance(t, str)])
    if N < 1:
        return "(cluster)"

    # Build per-document token lists
    doc_tokens: list[list[str]] = []

    for text in comment_texts:
        if not text or not isinstance(text, str):
            continue
        tokens = [t for t in tokenize(text) if _valid_token(t)]
        doc_tokens.append(tokens)

    def _accept_phrase(phrase: str) -> bool:
        if not phrase or phrase in PHRASE_STOPWORDS or phrase in CHANNEL_STOPWORDS:
            return False
        if _has_numeric_tokens(phrase) or _is_mostly_ascii(phrase) or not _has_persian(phrase):
            return False
        for t in phrase.split():
            if not _valid_token(t):
                return False
        if _phrase_stopword_ratio(phrase) > 0.5:
            return False
        return True

    # Build phrase TF (total count) and DF (documents containing phrase)
    phrase_tf: dict[str, int] = {}
    for toks in doc_tokens:
        for i in range(len(toks) - 1):
            bg = f"{toks[i]} {toks[i+1]}"
            if _accept_phrase(bg):
                phrase_tf[bg] = phrase_tf.get(bg, 0) + 1
        for w in toks:
            if _accept_phrase(w):
                phrase_tf[w] = phrase_tf.get(w, 0) + 1

    phrase_df: dict[str, int] = {}
    for phrase in phrase_tf:
        parts = phrase.split()
        df = 0
        for toks in doc_tokens:
            found = False
            if len(parts) == 1:
                found = phrase in toks
            else:
                for i in range(len(toks) - len(parts) + 1):
                    if toks[i : i + len(parts)] == parts:
                        found = True
                        break
            if found:
                df += 1
        phrase_df[phrase] = df

    def _score(phrase: str) -> float:
        tf = phrase_tf.get(phrase, 0)
        df = phrase_df.get(phrase, 0)
        if tf == 0:
            return 0.0
        return tf * math.log(N / (df + 1) + 1)

    # Prefer bigrams: collect from phrase_tf (already filtered)
    candidates: list[tuple[str, float]] = []
    for phrase in phrase_tf:
        score = _score(phrase)
        if score > 0:
            candidates.append((phrase, score))

    # Sort: bigrams first (by score), then unigrams
    def _key(item: tuple[str, float]) -> tuple[int, float]:
        is_bigram = 1 if " " in item[0] else 0
        return (-is_bigram, -item[1])  # bigrams first, then by score desc

    candidates.sort(key=_key)
    if candidates:
        label = _dedupe_phrase(candidates[0][0])[:40]
        if not _has_numeric_tokens(label):
            return label
    return "(cluster)"


def _compute_tfidf_embeddings(to_map: list[str]):
    """Step 2: Compute TF-IDF embeddings from comment texts."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    vectorizer = TfidfVectorizer(
        max_features=200,
        token_pattern=r"(?u)\b[\u0600-\u06FF]+\b"
    )
    X = vectorizer.fit_transform(to_map)
    return X.toarray()


def _run_umap(embeddings, random_state: int = 42):
    """Step 3: Run UMAP with fixed seed. Returns 2D coords or None. Uses lock to avoid Numba concurrent access."""
    import umap
    with _umap_lock:
        reducer = umap.UMAP(
            n_components=2,
            n_neighbors=15,
            min_dist=0.3,
            metric="cosine",
            random_state=random_state,
        )
        return reducer.fit_transform(embeddings)


def _cluster_kmeans(coords, comments: list, to_map: list) -> tuple[list[dict], dict, list[int]]:
    """Step 4: KMeans clustering for TF-IDF pipeline. Returns (labels, stats, cluster_assignments)."""
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=4, random_state=0)
    cluster_ids = kmeans.fit_predict(coords)
    labels, stats, assignments = _cluster_labels_from_coords(coords, cluster_ids, comments, to_map)
    return labels, stats, assignments


def _cluster_hdbscan(coords, comments: list, to_map: list, min_cluster_size: int = 8) -> tuple[list[dict], dict, list[int]]:
    """Step 4: HDBSCAN clustering. Returns (labels, stats, cluster_assignments)."""
    import hdbscan
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, min_samples=min(min_cluster_size // 2, 4))
    cluster_ids = clusterer.fit_predict(coords)
    labels, stats, assignments = _cluster_labels_from_coords(coords, cluster_ids, comments, to_map)
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


def _compute_minilm_embeddings(to_map: list, comments: list):
    """Step 2: Compute MiniLM sentence transformer embeddings."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        raw_texts = [comments[i].get("comment_text", "") or to_map[i] or "" for i in range(len(to_map))]
        return model.encode(raw_texts)
    except Exception as e:
        log.warning("MiniLM embeddings failed: %s", e)
        return None


def _cluster_labels_from_coords(
    coords: list,
    cluster_ids: list,
    comments: list,
    to_map: list,
) -> tuple[list[dict], dict, list[int]]:
    """Build cluster labels from coords and cluster assignments. Handles HDBSCAN (-1 = noise).
    Returns (labels, stats, cluster_assignments) where stats has clusters, noise_count, total."""
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
    for cid, indices in sorted(clusters.items()):
        if not indices:
            continue
        comment_texts = [
            comments[i].get("comment_text", "")
            for i in indices
            if i < len(comments)
        ]
        label = compute_cluster_label(comment_texts)
        x = float(sum(coords[i][0] for i in indices) / len(indices))
        y = float(sum(coords[i][1] for i in indices) / len(indices))
        result.append({"x": round(x, 2), "y": round(y, 2), "label": label, "cluster_id": int(cid)})
    stats = {"clusters": len(result), "noise_count": noise_count, "total": total}
    cluster_assignments = [int(cid) for cid in cluster_ids]
    return result, stats, cluster_assignments


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

                # Step 4: Run clustering for TF-IDF pipeline
                cluster_labels_tfidf, cluster_stats_tfidf, cluster_assignments_tfidf = _cluster_kmeans(umap_tfidf, comments, to_map)
                cluster_labels_hdbscan, cluster_stats_hdbscan, cluster_assignments_hdbscan = _cluster_hdbscan(umap_tfidf, comments, to_map)

        except Exception:
            pass

        # MiniLM in its own try so TF-IDF failures don't block it
        try:
            minilm_embeddings = _compute_minilm_embeddings(to_map, comments)
            if minilm_embeddings is not None:
                umap_minilm = _run_umap(minilm_embeddings)
                if umap_minilm is not None:
                    for i, _ in enumerate(to_map):
                        x = round(float(umap_minilm[i][0]), 2)
                        y = round(float(umap_minilm[i][1]), 2)
                        points_minilm.append([x, y, i])
                    cluster_labels_minilm, cluster_stats_minilm, cluster_assignments_minilm = _cluster_hdbscan(
                        umap_minilm, comments, to_map, min_cluster_size=5
                    )
        except Exception as e:
            log.warning("MiniLM pipeline failed: %s", e)

    # Backward compatibility: points_umap = points_tfidf, cluster_labels = cluster_labels_tfidf
    points_umap = points_tfidf
    cluster_labels = cluster_labels_tfidf

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
        "comments": comments
    }

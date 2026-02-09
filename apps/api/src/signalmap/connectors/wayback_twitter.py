"""
Wayback Machine connector for Twitter/X profile follower counts.
Only accesses web.archive.org. No Twitter API, no live scraping.
Conservative extraction: false positives worse than missing.

Example calls:
  GET /api/wayback/twitter?username=jack&sample=20
  GET /api/wayback/twitter?username=@nytimes&sample=20
  GET /api/wayback/twitter?username=jack&from_year=2009&to_year=2026&sample=40
"""

import logging
import random
import re
import time
from typing import Optional

import httpx

CDX_URL = "https://web.archive.org/cdx/search/cdx"
FETCH_TIMEOUT = 10.0
# Internet Archive: 15 req/min limit (archive.org/details/toomanyrequests_20191110)
REQUEST_DELAY_MS = (4500, 5500)  # ~11–13 req/min; matches Instagram/YouTube
EVIDENCE_MAX_LEN = 140

WAYBACK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignalMap/1.0; research tool)",
}

logger = logging.getLogger(__name__)


def normalize_username(username: str) -> tuple[str, str]:
    """
    Normalize "jack", "@jack", or URL to (username, canonical_url).
    Returns (username, "https://twitter.com/<username>").
    """
    s = (username or "").strip()
    if not s:
        return ("", "")

    # Full URL
    if "twitter.com" in s.lower() or "x.com" in s.lower():
        if not s.startswith("http"):
            s = "https://" + s
        s = s.rstrip("/")
        for sep in ["twitter.com/", "x.com/"]:
            if sep in s.lower():
                handle = s.split(sep)[-1].split("?")[0].rstrip("/").split("/")[0]
                if handle:
                    return (handle, f"https://twitter.com/{handle}")
        return ("", "")

    # Handle: @jack or jack
    handle = s.lstrip("@").split()[0].rstrip("/")
    if handle:
        return (handle, f"https://twitter.com/{handle}")
    return ("", "")


def list_snapshots(
    canonical_url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 2000,
) -> list[dict]:
    """
    Fetch CDX snapshots for Twitter/X profile.
    Queries both twitter.com and x.com variants; merges and dedupes by timestamp.
    """
    if not canonical_url or ("twitter.com" not in canonical_url.lower() and "x.com" not in canonical_url.lower()):
        return []

    handle = ""
    for sep in ["twitter.com/", "x.com/"]:
        if sep in canonical_url.lower():
            handle = canonical_url.split(sep)[-1].split("?")[0].rstrip("/").split("/")[0]
            break
    if not handle:
        return []

    all_snapshots: list[dict] = []
    seen_ts: set[str] = set()

    # Alternate URLs: twitter.com and x.com variants (Wayback coverage differs)
    urls_to_try: list[tuple[str, Optional[str]]] = [
        (f"twitter.com:80/{handle}", "prefix"),
        (f"twitter.com/{handle}/", "prefix"),
        (f"twitter.com/{handle}", "prefix"),
        (f"https://twitter.com/{handle}", None),
        (f"www.twitter.com/{handle}", "prefix"),
        (f"http://twitter.com:80/{handle}", "prefix"),
        (f"x.com:80/{handle}", "prefix"),
        (f"x.com/{handle}/", "prefix"),
        (f"x.com/{handle}", "prefix"),
        (f"https://x.com/{handle}", None),
        (f"www.x.com/{handle}", "prefix"),
    ]

    for url, match_type in urls_to_try:
        snaps = _fetch_cdx(
            url,
            from_year=from_year,
            to_year=to_year,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            match_type=match_type,
        )
        if match_type == "prefix":
            snaps = [s for s in snaps if _is_profile_url(s["original"], handle)]
        for s in snaps:
            if s["timestamp"] not in seen_ts:
                seen_ts.add(s["timestamp"])
                all_snapshots.append(s)

    return sorted(all_snapshots, key=lambda x: x["timestamp"])


def _is_profile_url(original: str, handle: str) -> bool:
    """
    True if URL is the profile page, not /handle/status/..., /handle/followers, etc.
    Profile: twitter.com/handle or twitter.com/handle/
    """
    if not original or not handle:
        return False
    path = original.split("?")[0].split("#")[0]
    for domain in ["twitter.com", "x.com"]:
        if domain in path.lower():
            path = path.split(domain)[-1]
            break
    path = re.sub(r":\d+", "", path)
    path = path.strip("/")
    parts = [p for p in path.split("/") if p and not p.startswith(":")]
    return len(parts) == 1 and parts[0].lower() == handle.lower()


def _fetch_cdx(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 2000,
    match_type: Optional[str] = None,
) -> list[dict]:
    """
    CDX API params: output=json, fl=timestamp,original,statuscode,mimetype,
    filter=statuscode:200, filter=mimetype:text/html, collapse=timestamp:8.
    When using prefix match, exclude /status/ and /statuses/ URLs (tweet pages).
    """
    params_list = [
        ("url", url),
        ("output", "json"),
        ("fl", "timestamp,original,statuscode,mimetype"),
        ("filter", "statuscode:200"),
        ("filter", "mimetype:text/html"),
        ("collapse", "timestamp:8"),
        ("limit", limit),
    ]
    if match_type:
        params_list.append(("matchType", match_type))
        # Exclude tweet/status pages; only want profile pages for follower extraction
        params_list.append(("filter", "!original:.*/status/"))
        params_list.append(("filter", "!original:.*/statuses/"))
    if from_date:
        params_list.append(("from", from_date))
    elif from_year is not None:
        params_list.append(("from", str(from_year)))
    if to_date:
        params_list.append(("to", to_date))
    elif to_year is not None:
        params_list.append(("to", str(to_year)))

    time.sleep(0.5)
    try:
        with httpx.Client(timeout=15.0, headers=WAYBACK_HEADERS) as client:
            resp = client.get(CDX_URL, params=params_list)
            if resp.status_code == 429:
                time.sleep(8.0)
                resp = client.get(CDX_URL, params=params_list)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("CDX fetch failed for %s: %s", url[:60], e)
        return []

    if not data or len(data) < 2:
        return []

    headers = data[0]
    rows = data[1:]
    ts_idx = headers.index("timestamp") if "timestamp" in headers else 0
    orig_idx = headers.index("original") if "original" in headers else 1
    return [{"timestamp": row[ts_idx], "original": row[orig_idx]} for row in rows]


def evenly_sample(snapshots: list[dict], sample: int = 40) -> list[dict]:
    """Sample evenly across time if many snapshots exist."""
    if not snapshots:
        return []
    sorted_snaps = sorted(snapshots, key=lambda s: s["timestamp"])
    if len(sorted_snaps) <= sample:
        return sorted_snaps
    step = max(1, len(sorted_snaps) // sample)
    indices = [j * step for j in range(sample)][:sample]
    return sorted([sorted_snaps[i] for i in indices if i < len(sorted_snaps)], key=lambda s: s["timestamp"])


def fetch_snapshot_html(timestamp: str, original_url: str) -> tuple[Optional[str], str]:
    """Fetch snapshot HTML. timeout=10s, follow_redirects=True. Continue on failure (return None)."""
    archived_url = f"https://web.archive.org/web/{timestamp}/{original_url}"
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=True, headers=WAYBACK_HEADERS) as client:
            resp = client.get(archived_url)
            if resp.status_code == 429:
                time.sleep(5.0)
                resp = client.get(archived_url)
            resp.raise_for_status()
            return resp.text, archived_url
    except Exception:
        return None, archived_url


def _parse_follower_number(raw: str, suffix: Optional[str]) -> int:
    """Convert K/M to int. e.g. 1.2M -> 1200000, 850K -> 850000."""
    s = raw.replace(",", "").replace(" ", "").strip()
    try:
        val = float(s)
    except (ValueError, TypeError):
        return 0
    if suffix:
        suf = suffix.upper().strip()
        if suf == "M":
            val *= 1_000_000
        elif suf == "K":
            val *= 1_000
    return int(val)


def extract_followers(html: str) -> dict:
    """
    Conservative follower extraction.
    Prefer meta[name="description"] and meta[property="og:description"].
    Patterns: "1,234 Followers", "1.2M Followers", "850K Followers".
    Meta + strong context => confidence 0.75.
    Visible text with strict proximity => confidence 0.5.
    Otherwise null, confidence 0.0. Evidence max 140 chars.
    """
    if not html or len(html) > 2_000_000:
        return {"value": None, "confidence": 0.0, "evidence": None}

    # Strategy 1: Meta tags
    meta_patterns = [
        re.compile(
            r'<meta[^>]+(?:name|property)=["\'](?:description|og:description)["\'][^>]+content=["\']([^"\']+)["\']',
            re.I,
        ),
        re.compile(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\'](?:description|og:description)["\']',
            re.I,
        ),
    ]
    for meta_pattern in meta_patterns:
        for m in meta_pattern.finditer(html):
            content = m.group(1)
            sub_match = re.search(
                r"([0-9][0-9,\.]*)\s*([KM])?\s*[Ff]ollowers?",
                content,
                re.I,
            )
            if sub_match:
                raw = sub_match.group(1)
                suffix = sub_match.group(2)
                val = _parse_follower_number(raw, suffix)
                if 0 < val < 10_000_000_000:
                    snippet = content[:EVIDENCE_MAX_LEN]
                    if len(content) > EVIDENCE_MAX_LEN:
                        snippet += "..."
                    return {"value": val, "confidence": 0.75, "evidence": snippet}

    # Strategy 2: Visible text with strict proximity
    sub_pattern = re.compile(
        r"([0-9][0-9,\.]*)\s*([KM])?\s*[Ff]ollowers?",
        re.I,
    )
    for m in sub_pattern.finditer(html):
        raw = m.group(1)
        suffix = m.group(2)
        val = _parse_follower_number(raw, suffix)
        if 0 < val < 10_000_000_000:
            start = max(0, m.start() - 20)
            end = min(len(html), m.end() + 30)
            snippet = html[start:end].replace("\n", " ").strip()[:EVIDENCE_MAX_LEN]
            return {"value": val, "confidence": 0.5, "evidence": snippet}

    return {"value": None, "confidence": 0.0, "evidence": None}


def get_twitter_archival_metrics(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 40,
) -> dict:
    """
    Fetch Wayback snapshots for Twitter/X and extract follower counts.
    Response shape:
    {
      "platform": "twitter",
      "username": "<u>",
      "canonical_url": "...",
      "snapshots_total": <int>,
      "snapshots_sampled": <int>,
      "results": [...],
      "notes": "..."
    }
    """
    norm_username, canonical_url = normalize_username(username)
    if not canonical_url:
        return {
            "platform": "twitter",
            "username": (username or "").strip(),
            "canonical_url": "",
            "snapshots_total": 0,
            "snapshots_sampled": 0,
            "results": [],
            "notes": "Sparse archival snapshots from Wayback. Treat as contextual signals only; missing values are expected.",
        }

    snapshots = list_snapshots(
        canonical_url,
        from_year=from_year,
        to_year=to_year,
        from_date=from_date,
        to_date=to_date,
        limit=2000,
    )
    snapshots_total = len(snapshots)
    sampled = evenly_sample(snapshots, sample=sample)
    snapshots_sampled = len(sampled)

    results: list[dict] = []

    for i, snap in enumerate(sampled):
        if i > 0:
            delay = random.uniform(
                REQUEST_DELAY_MS[0] / 1000.0,
                REQUEST_DELAY_MS[1] / 1000.0,
            )
            time.sleep(delay)

        html, archived_url = fetch_snapshot_html(snap["timestamp"], snap["original"])
        entry: dict = {
            "timestamp": snap["timestamp"],
            "original_url": snap["original"],
            "archived_url": archived_url,
            "followers": None,
            "confidence": 0.0,
            "evidence": None,
        }

        if html:
            extracted = extract_followers(html)
            if extracted["value"] is not None:
                entry["followers"] = extracted["value"]
                entry["confidence"] = extracted["confidence"]
                entry["evidence"] = extracted["evidence"]

        results.append(entry)

    return {
        "platform": "twitter",
        "username": norm_username,
        "canonical_url": canonical_url,
        "snapshots_total": snapshots_total,
        "snapshots_sampled": snapshots_sampled,
        "results": results,
        "notes": "Sparse archival snapshots from Wayback. Treat as contextual signals only; missing values are expected.",
    }


# --- Backward compatibility for jobs (accept input -> username) ---
def canonicalize_twitter_input(input_str: str) -> dict:
    """Accept @handle, username, or URL. Returns {canonical_url, username}."""
    username, canonical_url = normalize_username(input_str)
    return {"canonical_url": canonical_url, "username": username}

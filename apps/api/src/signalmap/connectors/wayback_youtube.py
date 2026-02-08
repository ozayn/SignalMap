"""
Wayback Machine connector for YouTube channel subscriber counts.
Only accesses web.archive.org. No YouTube API, no live scraping.
Conservative extraction: false positives worse than missing.
"""

import logging
import random
import re
import time
from typing import Optional

import httpx

CDX_URL = "https://web.archive.org/cdx/search/cdx"
FETCH_TIMEOUT = 15.0
# Internet Archive: 15 req/min limit (archive.org/details/toomanyrequests_20191110)
REQUEST_DELAY_MS = (4500, 5500)  # ~11–13 req/min
EVIDENCE_MAX_LEN = 140

WAYBACK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignalMap/1.0; research tool)",
}

logger = logging.getLogger(__name__)


def canonicalize_youtube_input(input_str: str) -> dict:
    """
    Accept either full URL or bare handle.
    Returns {"kind": str, "canonical_url": str}.
    """
    s = input_str.strip()
    if not s:
        return {"kind": "url", "canonical_url": ""}

    # Bare handle starting with @
    if s.startswith("@"):
        handle = s.lstrip("@").split()[0].rstrip("/")
        if handle:
            return {
                "kind": "handle",
                "canonical_url": f"https://www.youtube.com/@{handle}",
            }
        return {"kind": "handle", "canonical_url": ""}

    # Full URL
    if "youtube.com" in s.lower() or "youtu.be" in s.lower():
        # Normalize scheme
        if not s.startswith("http"):
            s = "https://" + s
        s = s.replace("http://", "https://", 1)
        s = s.rstrip("/")

        if "youtube.com/channel/" in s.lower():
            return {"kind": "channel", "canonical_url": s}
        if "youtube.com/user/" in s.lower():
            return {"kind": "user", "canonical_url": s}
        if "youtube.com/" in s.lower() or "youtu.be/" in s.lower():
            return {"kind": "url", "canonical_url": s}

    # Treat as handle (e.g. "somehandle" -> @somehandle)
    if s and not s.startswith("http"):
        handle = s.split()[0].rstrip("/")
        return {
            "kind": "handle",
            "canonical_url": f"https://www.youtube.com/@{handle}",
        }

    return {"kind": "url", "canonical_url": s if s.startswith("https://") else f"https://{s}"}


def _fetch_cdx(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 2000,
    match_type: Optional[str] = None,
) -> list[dict]:
    """Fetch CDX results for a single URL. from_date/to_date are YYYYMMDD."""
    params_list = [
        ("url", url),
        ("output", "json"),
        ("fl", "timestamp,original,statuscode,mimetype"),
        ("collapse", "timestamp:8"),
        ("limit", limit),
    ]
    params_list.append(("filter", "statuscode:200"))
    params_list.append(("filter", "mimetype:text/html"))
    if match_type:
        params_list.append(("matchType", match_type))
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

    return [
        {"timestamp": row[ts_idx], "original": row[orig_idx]}
        for row in rows
    ]


def list_snapshots(
    canonical_url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 2000,
    try_alternate_urls: bool = True,
) -> list[dict]:
    """
    Use Wayback CDX API to return snapshot timestamps + original URL.
    For @handle URLs, tries /user/ and /c/ variants when primary returns empty.
    Returns list of {"timestamp": str, "original": str}.
    """
    if not canonical_url or "youtube.com" not in canonical_url.lower():
        return []

    all_snapshots: list[dict] = []
    seen_ts: set[str] = set()

    # Build URL variants - archive often stores youtube.com:80/path or youtube.com/path
    urls_to_try: list[tuple[str, Optional[str]]] = [(canonical_url, None)]
    if try_alternate_urls and "youtube.com" in canonical_url.lower():
        handle = ""
        if "/@" in canonical_url.lower():
            handle = canonical_url.split("/@")[-1].split("?")[0].rstrip("/")
        elif "/user/" in canonical_url.lower():
            handle = canonical_url.split("/user/")[-1].split("?")[0].rstrip("/")
        elif "/c/" in canonical_url.lower():
            handle = canonical_url.split("/c/")[-1].split("?")[0].rstrip("/")
        if handle:
            # Prefix match - archive stores youtube.com:80/user/foo or youtube.com/user/foo/
            urls_to_try.extend([
                (f"youtube.com:80/user/{handle}", "prefix"),
                (f"youtube.com:80/c/{handle}", "prefix"),
                (f"youtube.com:80/@{handle}", "prefix"),
                (f"youtube.com/user/{handle}/", "prefix"),
                (f"youtube.com/c/{handle}/", "prefix"),
                (f"youtube.com/@{handle}/", "prefix"),
                (f"www.youtube.com/user/{handle}", "prefix"),
                (f"www.youtube.com/c/{handle}", "prefix"),
                (f"https://www.youtube.com/user/{handle}", None),
                (f"http://youtube.com:80/user/{handle}", "prefix"),
                (f"http://www.youtube.com:80/user/{handle}", "prefix"),
            ])

    for item in urls_to_try:
        url = item[0] if isinstance(item, tuple) else item
        match_type = item[1] if isinstance(item, tuple) and len(item) > 1 else None
        snaps = _fetch_cdx(
            url,
            from_year=from_year,
            to_year=to_year,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            match_type=match_type,
        )
        for s in snaps:
            if s["timestamp"] not in seen_ts:
                seen_ts.add(s["timestamp"])
                all_snapshots.append(s)
        if all_snapshots:
            break

    return sorted(all_snapshots, key=lambda s: s["timestamp"])


def evenly_sample(snapshots: list[dict], sample: int = 40) -> list[dict]:
    """Sample evenly across the full date range."""
    if not snapshots:
        return []
    sorted_snaps = sorted(snapshots, key=lambda s: s["timestamp"])
    if len(sorted_snaps) <= sample:
        return sorted_snaps

    step = max(1, len(sorted_snaps) // sample)
    indices = [j * step for j in range(sample)][:sample]
    result = [sorted_snaps[i] for i in indices if i < len(sorted_snaps)]
    return sorted(result, key=lambda s: s["timestamp"])


def fetch_snapshot_html(timestamp: str, original_url: str) -> tuple[Optional[str], str]:
    """
    Fetch HTML from archived URL.
    Returns (html_text, archived_url). html_text is None on failure.
    """
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


def _parse_subscriber_number(raw: str, suffix: Optional[str]) -> int:
    """Parse number with optional K/M suffix."""
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


def extract_subscribers(html: str) -> dict:
    """
    Extract subscriber count from HTML.
    Returns {"value": int|None, "confidence": float, "evidence": str|None}.
    """
    if not html or len(html) > 2_000_000:
        return {"value": None, "confidence": 0.0, "evidence": None}

    # Strategy 1: Meta tags (name/property before content, or content before name/property)
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
                r"([0-9][0-9,\.]*)\s*([KM])?\s*subscribers",
                content,
                re.I,
            )
            if sub_match:
                raw = sub_match.group(1)
                suffix = sub_match.group(2)
                val = _parse_subscriber_number(raw, suffix)
                if 0 < val < 10_000_000_000:
                    snippet = content[:EVIDENCE_MAX_LEN]
                    if len(content) > EVIDENCE_MAX_LEN:
                        snippet += "..."
                    return {"value": val, "confidence": 0.75, "evidence": snippet}

    # Strategy 2: Visible text fallback - "subscribers" within 50 chars of number
    sub_pattern = re.compile(
        r"([0-9][0-9,\.]*)\s*([KM])?\s*subscribers",
        re.I,
    )
    for m in sub_pattern.finditer(html):
        raw = m.group(1)
        suffix = m.group(2)
        val = _parse_subscriber_number(raw, suffix)
        if 0 < val < 10_000_000_000:
            start = max(0, m.start() - 20)
            end = min(len(html), m.end() + 30)
            snippet = html[start:end].replace("\n", " ").strip()[:EVIDENCE_MAX_LEN]
            return {"value": val, "confidence": 0.5, "evidence": snippet}

    # Reverse: "subscribers" then number within 50 chars
    rev = re.compile(
        r"subscribers\s*[^0-9]{0,50}?([0-9][0-9,\.]*)\s*([KM])?",
        re.I,
    )
    for m in rev.finditer(html):
        raw = m.group(1)
        suffix = m.group(2)
        val = _parse_subscriber_number(raw, suffix)
        if 0 < val < 10_000_000_000:
            start = max(0, m.start() - 10)
            end = min(len(html), m.end() + 20)
            snippet = html[start:end].replace("\n", " ").strip()[:EVIDENCE_MAX_LEN]
            return {"value": val, "confidence": 0.5, "evidence": snippet}

    return {"value": None, "confidence": 0.0, "evidence": None}


def get_youtube_archival_metrics(
    input_str: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 40,
) -> dict:
    """
    Fetch Wayback snapshots for a YouTube channel and extract subscriber counts.
    Returns API response structure.
    """
    canon = canonicalize_youtube_input(input_str)
    canonical_url = canon.get("canonical_url", "")
    if not canonical_url:
        return {
            "platform": "youtube",
            "input": input_str,
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
    parse_success = 0

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
            "subscribers": None,
            "confidence": 0.0,
            "evidence": None,
        }

        if html:
            extracted = extract_subscribers(html)
            if extracted["value"] is not None:
                entry["subscribers"] = extracted["value"]
                entry["confidence"] = extracted["confidence"]
                entry["evidence"] = extracted["evidence"]
                parse_success += 1

        results.append(entry)

    logger.info(
        "YouTube wayback: %s snapshots fetched, %d parse success",
        snapshots_sampled,
        parse_success,
    )

    return {
        "platform": "youtube",
        "input": input_str,
        "canonical_url": canonical_url,
        "snapshots_total": snapshots_total,
        "snapshots_sampled": snapshots_sampled,
        "results": results,
        "notes": "Sparse archival snapshots from Wayback. Treat as contextual signals only; missing values are expected.",
    }

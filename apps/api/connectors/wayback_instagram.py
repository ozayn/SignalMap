"""
Wayback Machine connector for Instagram profile archival metrics.
Only accesses Wayback public endpoints. No live scraping.
Conservative extraction: false positives worse than missing.
"""

import re
import time
from html import unescape
from typing import Optional, Tuple

import httpx

CDX_URL = "https://web.archive.org/cdx/search/cdx"
FETCH_TIMEOUT = 10.0
REQUEST_DELAY_S = 0.25

EVIDENCE_MAX_LEN = 140


def _parse_number(s: str) -> float:
    """Parse '1.2M', '500K', '1,234,567' to number (float for decimals)."""
    s = s.replace(",", "").replace("\u066c", "").replace("\u066b", ".").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _apply_multiplier(val: float, suffix: Optional[str]) -> int:
    if suffix and suffix.upper() == "M":
        return int(val * 1_000_000)
    if suffix and suffix.upper() == "K":
        return int(val * 1_000)
    return int(val)


def _normalize_url_for_dedup(url: str) -> str:
    """Normalize URL for deduplication: remove scheme, :80, www, trailing slash."""
    u = url.lower().strip()
    # Remove scheme
    for p in ("https://", "http://"):
        if u.startswith(p):
            u = u[len(p) :]
            break
    # Remove :80
    u = re.sub(r":80(?=/|$)", "", u)
    # Remove www.
    if u.startswith("www."):
        u = u[4:]
    # Remove trailing slash
    u = u.rstrip("/") or u
    return u


def _url_preference_score(url: str) -> int:
    """Higher is better for preferring https+www when deduping."""
    score = 0
    if url.startswith("https://"):
        score += 2
    elif url.startswith("http://"):
        score += 1
    if "//www." in url.lower():
        score += 1
    return score


def _build_archived_url(timestamp: str, original_url: str) -> str:
    """Build archived URL from timestamp and CDX original."""
    return f"https://web.archive.org/web/{timestamp}/{original_url}"


def _fetch_cdx(url: str, from_year: Optional[int], to_year: Optional[int], limit: int, match_type: Optional[str] = None) -> list[dict]:
    """Fetch CDX results for a URL (and optional matchType)."""
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
    if from_year is not None:
        params_list.append(("from", str(from_year)))
    if to_year is not None:
        params_list.append(("to", str(to_year)))

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(CDX_URL, params=params_list)
        resp.raise_for_status()
        data = resp.json()

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
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    limit: int = 500,
) -> list[dict]:
    """
    Use Wayback CDX API to return snapshot timestamps + original URL.
    CDX matches canonical URL flexibly (http/https, www/non-www). Returns list of {"timestamp": "...", "original": "..."}.
    """
    if "instagram.com/" not in url:
        return []

    all_snapshots = []
    url = url.strip()
    # Primary: canonical URL (CDX matches this across http/https, www/non-www variants)
    try:
        all_snapshots.extend(_fetch_cdx(url, from_year, to_year, limit))
    except Exception:
        pass

    # Fallback: if nothing found, try alternate URL forms
    if not all_snapshots:
        base = url.split("instagram.com/")[-1].split("?")[0].strip().rstrip("/")
        if base:
            for u in [
                f"https://instagram.com/{base}/",
                f"https://www.instagram.com/{base}",
                f"http://instagram.com/{base}",
            ]:
                if u != url:
                    try:
                        snaps = _fetch_cdx(u, from_year, to_year, limit)
                        if snaps:
                            all_snapshots.extend(snaps)
                            break
                    except Exception:
                        continue

    return all_snapshots


def deduplicate_snapshots(snapshots: list[dict]) -> list[dict]:
    """
    Dedupe by (timestamp, normalized_original_url).
    Prefer https + www when multiple exist for the same timestamp.
    """
    seen: dict[Tuple[str, str], dict] = {}
    for s in snapshots:
        key = (s["timestamp"], _normalize_url_for_dedup(s["original"]))
        if key not in seen or _url_preference_score(s["original"]) > _url_preference_score(seen[key]["original"]):
            seen[key] = s
    return list(seen.values())


def evenly_sample_snapshots(
    snapshots: list[dict],
    sample: int = 30,
) -> list[dict]:
    """Sample evenly across the full date range."""
    if not snapshots:
        return []
    n = min(sample, len(snapshots))
    step = max(1, len(snapshots) // n)
    indices = [i * step for i in range(n)][:n]
    return [snapshots[i] for i in indices if i < len(snapshots)]


def fetch_snapshot_html(timestamp: str, original_url: str) -> Tuple[Optional[str], str]:
    """
    Fetch HTML from archived URL.
    Returns (html, archived_url). html is None on failure.
    """
    archived_url = _build_archived_url(timestamp, original_url)
    try:
        time.sleep(REQUEST_DELAY_S)
        with httpx.Client(timeout=FETCH_TIMEOUT) as client:
            resp = client.get(archived_url)
            resp.raise_for_status()
            return resp.text, archived_url
    except Exception:
        return None, archived_url


def _extract_evidence_candidates(html: str) -> list[Tuple[str, str]]:
    """Extract evidence candidates: (source, content)."""
    candidates = []
    if not html or len(html) > 2_000_000:
        return candidates

    # A) og:description
    m = re.search(
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if m:
        candidates.append(("og:description", unescape(m.group(1))))

    # B) meta description
    m = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if m:
        candidates.append(("description", unescape(m.group(1))))

    # C) surrounding substring around Followers/Following/Posts
    for pattern in [r"followers", r"following", r"posts?"]:
        for m in re.finditer(pattern, html, re.IGNORECASE):
            start = max(0, m.start() - 60)
            end = min(len(html), m.end() + 80)
            snippet = html[start:end].replace("\n", " ").replace("\r", " ").strip()
            snippet = re.sub(r"\s+", " ", snippet)[:EVIDENCE_MAX_LEN]
            if snippet:
                candidates.append(("context", snippet))
            break  # one per pattern

    return candidates


def extract_instagram_metrics(html: str) -> dict:
    """
    Extract followers, following, posts from Instagram profile HTML.
    Require >=2 fields in same evidence string. Return structured metrics.
    """
    empty = {"value": None, "confidence": 0.0, "evidence": None}
    result = {
        "followers": {**empty},
        "following": {**empty},
        "posts": {**empty},
    }

    candidates = _extract_evidence_candidates(html)
    if not candidates:
        return result

    html_lower = html.lower()
    best_evidence: Optional[str] = None
    best_confidence = 0.0
    parsed = {"followers": None, "following": None, "posts": None}

    for source, content in candidates:
        content_lower = content.lower()
        if "follower" not in content_lower and "following" not in content_lower and "post" not in content_lower:
            continue

        # Parse counts
        f_match = re.search(r"([\d.,]+)\s*([MK])?\s*followers", content_lower, re.IGNORECASE)
        g_match = re.search(r"([\d.,]+)\s*([MK])?\s*following", content_lower, re.IGNORECASE)
        p_match = re.search(r"([\d.,]+)\s*([MK])?\s*posts?", content_lower, re.IGNORECASE)

        f_val = _apply_multiplier(_parse_number(f_match.group(1)), f_match.group(2)) if f_match else None
        g_val = _apply_multiplier(_parse_number(g_match.group(1)), g_match.group(2)) if g_match else None
        p_val = _apply_multiplier(_parse_number(p_match.group(1)), p_match.group(2)) if p_match else None

        # Sanity checks
        if f_val is not None and (f_val <= 0 or f_val >= 1_000_000_000):
            f_val = None
        if g_val is not None and (g_val < 0 or g_val >= 100_000_000):
            g_val = None
        if p_val is not None and (p_val < 0 or p_val >= 100_000_000):
            p_val = None

        count_found = sum(1 for v in [f_val, g_val, p_val] if v is not None)
        if count_found < 2:
            continue

        # Determine confidence
        if source == "og:description" and count_found >= 2:
            conf = 0.75
        elif source == "description" and count_found >= 2:
            conf = 0.75
        elif source == "context" and count_found >= 2:
            conf = 0.55
        else:
            conf = 0.2

        if conf > best_confidence:
            best_confidence = conf
            best_evidence = content[:EVIDENCE_MAX_LEN]
            if len(content) > EVIDENCE_MAX_LEN:
                best_evidence += "..."
            parsed = {"followers": f_val, "following": g_val, "posts": p_val}

    if best_evidence:
        result["followers"]["value"] = parsed["followers"]
        result["followers"]["confidence"] = best_confidence
        result["followers"]["evidence"] = best_evidence
        result["following"]["value"] = parsed["following"]
        result["following"]["confidence"] = best_confidence
        result["following"]["evidence"] = best_evidence
        result["posts"]["value"] = parsed["posts"]
        result["posts"]["confidence"] = best_confidence
        result["posts"]["evidence"] = best_evidence

    return result


def get_instagram_archival_metrics(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    sample: int = 30,
    include_evidence: bool = True,
    progress: bool = False,
) -> dict:
    """
    Fetch Instagram profile from Wayback, sample snapshots, extract metrics.
    """
    username = (username or "").strip()
    if not username:
        return {
            "platform": "instagram",
            "username": "",
            "canonical_url": "https://www.instagram.com/",
            "snapshots_total": 0,
            "snapshots_sampled": 0,
            "results": [],
            "notes": "Username is required.",
        }
    canonical_url = f"https://www.instagram.com/{username}/"
    raw_snapshots = list_snapshots(canonical_url, from_year, to_year, limit=500)
    snapshots_total = len(raw_snapshots)

    deduped = deduplicate_snapshots(raw_snapshots)
    sampled = evenly_sample_snapshots(deduped, sample)
    snapshots_sampled = len(sampled)

    results = []
    processed = 0
    total_to_process = len(sampled)
    for s in sampled:
        original_url = s["original"]
        archived_url = _build_archived_url(s["timestamp"], original_url)

        try:
            html, _ = fetch_snapshot_html(s["timestamp"], original_url)
        except Exception:
            html = None

        processed += 1

        entry = {
            "timestamp": s["timestamp"],
            "original_url": original_url,
            "archived_url": archived_url,
        }

        if html:
            metrics = extract_instagram_metrics(html)
            f = metrics["followers"]["value"]
            g = metrics["following"]["value"]
            p = metrics["posts"]["value"]
            if f is not None or g is not None or p is not None:
                entry["followers"] = f
                entry["following"] = g
                entry["posts"] = p
                confs = [m["confidence"] for m in metrics.values() if m["value"] is not None]
                entry["confidence"] = round(max(confs, default=0), 2) if confs else 0.2
                ev = next((m["evidence"] for m in metrics.values() if m["evidence"]), None)
                entry["evidence"] = (ev[:EVIDENCE_MAX_LEN] if ev else None) if include_evidence else None
            else:
                entry["followers"] = None
                entry["following"] = None
                entry["posts"] = None
                entry["confidence"] = 0.2
                entry["evidence"] = None
        else:
            entry["followers"] = None
            entry["following"] = None
            entry["posts"] = None
            entry["confidence"] = 0.0
            entry["evidence"] = None

        results.append(entry)

    out = {
        "platform": "instagram",
        "username": username,
        "canonical_url": canonical_url,
        "snapshots_total": snapshots_total,
        "snapshots_sampled": snapshots_sampled,
        "results": results,
        "notes": "Sparse archival snapshots; missing metrics are expected. Treat as contextual signals only.",
    }
    if progress:
        out["progress"] = {"total": total_to_process, "processed": processed}
    return out

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
REQUEST_DELAY_S = 1.0  # Wayback rate-limits; 1s between fetches to avoid 429

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


def _fetch_cdx(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 500,
    match_type: Optional[str] = None,
) -> list[dict]:
    """Fetch CDX results for a URL. Use from_date/to_date (YYYYMMDD) for precise ranges, else from_year/to_year."""
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

    time.sleep(0.5)  # Be polite to CDX; reduces 429 risk
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(CDX_URL, params=params_list)
        if resp.status_code == 429:
            time.sleep(8.0)
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


def _is_profile_url(original: str, username: str) -> bool:
    """True if URL is the profile page (not /username/photos, etc)."""
    if not original or not username:
        return False
    # Get path (after domain, before ? or #)
    path = original.split("?")[0].split("#")[0]
    if "instagram.com" in path.lower():
        path = path.split("instagram.com")[-1]
    # Strip port (e.g. :80) - older archives use http://instagram.com:80/username
    path = re.sub(r":\d+", "", path)
    path = path.strip("/")
    parts = [p for p in path.split("/") if p and not p.startswith(":")]
    return len(parts) == 1 and parts[0].lower() == username.lower()


def list_snapshots(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 500,
) -> list[dict]:
    """
    Use Wayback CDX API to return snapshot timestamps + original URL.
    Pass from_date/to_date (YYYYMMDD) for precise ranges (e.g. past two weeks).
    Otherwise use from_year/to_year.
    """
    if "instagram.com/" not in url:
        return []

    base = url.split("instagram.com/")[-1].split("?")[0].strip().rstrip("/")
    if not base:
        return []

    all_snapshots = []
    url = url.strip()
    seen_ts: set[str] = set()

    # Try URL forms; put instagram.com:80 first (older archives often use this)
    urls_to_try = [
        (f"instagram.com:80/{base}", "prefix"),
        (f"instagram.com/{base}/", "prefix"),
        (f"http://instagram.com:80/{base}", None),
        (f"https://www.instagram.com/{base}/", None),
    ]
    for u, match_type in urls_to_try:
        try:
            snaps = _fetch_cdx(u, from_year=from_year, to_year=to_year, from_date=from_date, to_date=to_date, limit=limit, match_type=match_type)
            if snaps:
                if match_type == "prefix":
                    filtered = [s for s in snaps if _is_profile_url(s["original"], base)]
                    snaps = filtered if filtered else snaps
                for s in snaps:
                    if s["timestamp"] not in seen_ts:
                        seen_ts.add(s["timestamp"])
                        all_snapshots.append(s)
        except Exception:
            continue

    # Fallback: try alternate URL forms if still empty
    if not all_snapshots:
        for u in [
            f"https://instagram.com/{base}/",
            f"https://www.instagram.com/{base}",
            f"http://instagram.com/{base}",
            f"http://www.instagram.com/{base}/",
        ]:
            if u == url or u.rstrip("/") == url.rstrip("/"):
                continue
            try:
                snaps = _fetch_cdx(u, from_year=from_year, to_year=to_year, from_date=from_date, to_date=to_date, limit=limit)
                if snaps:
                    for s in snaps:
                        if s["timestamp"] not in seen_ts:
                            seen_ts.add(s["timestamp"])
                            all_snapshots.append(s)
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
    """Sample evenly across the full date range, ensuring coverage per year."""
    if not snapshots:
        return []
    sorted_snaps = sorted(snapshots, key=lambda s: s["timestamp"])
    if len(sorted_snaps) <= sample:
        return sorted_snaps

    # Group by year to ensure we get at least 1 per year with data
    by_year: dict[str, list[dict]] = {}
    for s in sorted_snaps:
        ts = s["timestamp"]
        year = ts[:4] if len(ts) >= 4 else "unknown"
        by_year.setdefault(year, []).append(s)

    result: list[dict] = []
    years = sorted(by_year.keys())
    per_year = max(1, sample // len(years))
    remainder = sample - per_year * len(years)

    for i, year in enumerate(years):
        year_snaps = by_year[year]
        n_take = per_year + (1 if i < remainder else 0)
        n_take = min(n_take, len(year_snaps))
        if n_take >= len(year_snaps):
            result.extend(year_snaps)
        else:
            step = max(1, len(year_snaps) // n_take)
            indices = [j * step for j in range(n_take)][:n_take]
            result.extend(year_snaps[j] for j in indices if j < len(year_snaps))

    return sorted(result, key=lambda s: s["timestamp"])


def fetch_snapshot_html(timestamp: str, original_url: str) -> Tuple[Optional[str], str]:
    """
    Fetch HTML from archived URL.
    Returns (html, archived_url). html is None on failure.
    Retries once with longer delay on 429.
    """
    archived_url = _build_archived_url(timestamp, original_url)
    for attempt in range(2):
        try:
            time.sleep(REQUEST_DELAY_S)
            with httpx.Client(timeout=FETCH_TIMEOUT) as client:
                resp = client.get(archived_url)
                if resp.status_code == 429:
                    time.sleep(5.0)  # Back off before retry
                    continue
                resp.raise_for_status()
                return resp.text, archived_url
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt == 0:
                time.sleep(5.0)
                continue
            return None, archived_url
        except Exception:
            return None, archived_url
    return None, archived_url


def _extract_from_shared_data(html: str) -> Optional[dict]:
    """
    Strategy: window._sharedData has ProfilePage with followed_by, follows, media counts.
    2016-era IG uses this format. Returns {followers, following, posts} or None.
    """
    if not html or "followed_by" not in html or "count" not in html:
        return None
    # Match "followed_by":{"count":406462} and "follows":{"count":14} and "media":{"count":164}
    fb = re.search(r'["\']followed_by["\'][\s:]*\{[^}]*?["\']count["\'][\s:]*(\d+)', html, re.I)
    fg = re.search(r'["\']follows["\'][\s:]*\{[^}]*?["\']count["\'][\s:]*(\d+)', html, re.I)
    md = re.search(r'["\']media["\'][\s:]*\{[^}]*?["\']count["\'][\s:]*(\d+)', html, re.I)
    if not fb:
        return None
    followers = int(fb.group(1)) if 0 < int(fb.group(1)) < 1_000_000_000 else None
    following = int(fg.group(1)) if fg and 0 <= int(fg.group(1)) < 100_000_000 else None
    posts = int(md.group(1)) if md and 0 <= int(md.group(1)) < 100_000_000 else None
    if followers is None:
        return None
    return {"followers": followers, "following": following, "posts": posts}


def _extract_followers_from_edge_followed_by(html: str) -> dict:
    """
    Strategy B: Look for edge_followed_by in JSON-ish blobs.
    Older IG sometimes embedded counts. Returns {value, confidence, evidence} or empty.
    """
    if not html or "edge_followed_by" not in html:
        return {}
    m = re.search(
        r'["\']edge_followed_by["\'][\s:]*\{[^}]*["\']count["\'][\s:]*(\d+)',
        html,
        re.IGNORECASE,
    )
    if m:
        val = int(m.group(1))
        if 0 < val < 1_000_000_000:
            snippet = m.group(0)[:EVIDENCE_MAX_LEN]
            if len(m.group(0)) > EVIDENCE_MAX_LEN:
                snippet += "..."
            return {"value": val, "confidence": 0.5, "evidence": snippet}
    return {}


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

    # Strategy B: window._sharedData (2016-era: followed_by, follows, media)
    shared = _extract_from_shared_data(html)
    if shared and not best_evidence:
        result["followers"]["value"] = shared["followers"]
        result["followers"]["confidence"] = 0.75
        result["followers"]["evidence"] = "followed_by from _sharedData"
        if shared.get("following") is not None:
            result["following"]["value"] = shared["following"]
            result["following"]["confidence"] = 0.75
        if shared.get("posts") is not None:
            result["posts"]["value"] = shared["posts"]
            result["posts"]["confidence"] = 0.75
        return result

    # Strategy C: edge_followed_by JSON blob (older GraphQL-style)
    if not best_evidence:
        edge_result = _extract_followers_from_edge_followed_by(html)
        if edge_result:
            result["followers"]["value"] = edge_result["value"]
            result["followers"]["confidence"] = edge_result["confidence"]
            result["followers"]["evidence"] = edge_result["evidence"]
            return result

    # Strategy D: direct scan for "X followers", "X following", "X posts" anywhere in HTML
    # 2015 IG: <span class="number-stat">3,646</span> followers - try span format first
    f_m = re.search(r"([\d.,]+)\s*</[^>]+>\s*followers", html, re.IGNORECASE)
    g_m = re.search(r"([\d.,]+)\s*</[^>]+>\s*following", html, re.IGNORECASE)
    p_m = re.search(r"([\d.,]+)\s*</[^>]+>\s*posts?", html, re.IGNORECASE)
    if not f_m:
        f_m = re.search(r"([\d.,]+)\s*([MK])?\s*followers", html, re.IGNORECASE)
    if not g_m:
        g_m = re.search(r"([\d.,]+)\s*([MK])?\s*following", html, re.IGNORECASE)
    if not p_m:
        p_m = re.search(r"([\d.,]+)\s*([MK])?\s*posts?", html, re.IGNORECASE)
    def _parse_match(m):
        if not m:
            return None
        val = _parse_number(m.group(1))
        try:
            suffix = m.group(2)
        except IndexError:
            suffix = None
        return _apply_multiplier(val, suffix)

    f_direct = _parse_match(f_m)
    g_direct = _parse_match(g_m)
    p_direct = _parse_match(p_m)
    if f_direct is not None and (f_direct <= 0 or f_direct >= 1_000_000_000):
        f_direct = None
    if g_direct is not None and (g_direct < 0 or g_direct >= 100_000_000):
        g_direct = None
    if p_direct is not None and (p_direct < 0 or p_direct >= 100_000_000):
        p_direct = None
    direct_count = sum(1 for v in [f_direct, g_direct, p_direct] if v is not None)
    if direct_count >= 1 and not best_evidence:
        # Use direct scan when meta/candidates didn't find enough (e.g. 2015-style separate list items)
        conf = 0.5 if direct_count >= 2 else 0.35
        ev = (f_m.group(0)[:EVIDENCE_MAX_LEN] if f_m else None) or (g_m.group(0)[:EVIDENCE_MAX_LEN] if g_m else None)
        if f_direct is not None:
            result["followers"]["value"] = f_direct
            result["followers"]["confidence"] = conf
            result["followers"]["evidence"] = f_m.group(0)[:EVIDENCE_MAX_LEN] if f_m else ev
        if g_direct is not None:
            result["following"]["value"] = g_direct
            result["following"]["confidence"] = conf
            result["following"]["evidence"] = g_m.group(0)[:EVIDENCE_MAX_LEN] if g_m else ev
        if p_direct is not None:
            result["posts"]["value"] = p_direct
            result["posts"]["confidence"] = conf
            result["posts"]["evidence"] = p_m.group(0)[:EVIDENCE_MAX_LEN] if p_m else ev
        return result

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
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
    include_evidence: bool = True,
    progress: bool = False,
) -> dict:
    """
    Fetch Instagram profile from Wayback, sample snapshots, extract metrics.
    Use from_date/to_date (YYYYMMDD) for precise ranges, else from_year/to_year.
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
    raw_snapshots = list_snapshots(
        canonical_url,
        from_year=from_year,
        to_year=to_year,
        from_date=from_date,
        to_date=to_date,
        limit=500,
    )
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

    notes = "Sparse archival snapshots; missing metrics are expected. Treat as contextual signals only."
    if snapshots_total == 0:
        notes += " No snapshots found for this profile in the archive—the username may have no historic captures, or the Wayback CDX service may be unreachable."

    out = {
        "platform": "instagram",
        "username": username,
        "canonical_url": canonical_url,
        "snapshots_total": snapshots_total,
        "snapshots_sampled": snapshots_sampled,
        "results": results,
        "notes": notes,
    }
    if progress:
        out["progress"] = {"total": total_to_process, "processed": processed}
    return out


def get_instagram_followers_time_series(
    username: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sample: int = 30,
) -> dict:
    """
    Return a time series of follower counts from Wayback snapshots.
    Only includes points where followers was successfully extracted.
    Points sorted by date ascending.
    """
    data = get_instagram_archival_metrics(
        username=username,
        from_year=from_year,
        to_year=to_year,
        from_date=from_date,
        to_date=to_date,
        sample=sample,
        include_evidence=False,
        progress=False,
    )
    points = []
    for r in data.get("results", []):
        f = r.get("followers")
        if f is None:
            continue
        ts = r.get("timestamp", "")
        if len(ts) >= 8:
            date_str = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"
        else:
            continue
        points.append({
            "date": date_str,
            "followers": f,
            "confidence": round(r.get("confidence", 0.2), 2),
            "archived_url": r.get("archived_url", ""),
        })
    points.sort(key=lambda p: p["date"])
    return {
        "username": data.get("username", username),
        "canonical_url": data.get("canonical_url", f"https://www.instagram.com/{username}/"),
        "points": points,
        "notes": "Sparse archival snapshots; missing points are expected. Interpret as contextual signals only.",
    }

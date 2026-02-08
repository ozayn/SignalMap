"""
Minimal Wayback Machine connector.
Uses CDX API and archived snapshots. Metrics are contextual signals only.
"""

import re
import time
from typing import Optional

import httpx

CDX_URL = "https://web.archive.org/cdx/search/cdx"
FETCH_TIMEOUT = 15.0
# Internet Archive: 15 req/min limit
REQUEST_DELAY_MS = 4500

WAYBACK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignalMap/1.0; research tool)",
}

# Conservative regex patterns for follower/subscriber counts.
# False positives are worse than missing data.
FOLLOWER_PATTERNS = [
    (r"([\d,\.]+)\s*[mM]\s*followers", 1_000_000, 0.7),
    (r"([\d,\.]+)\s*[kK]\s*followers", 1_000, 0.7),
    (r"followers?\s*[:\s]*([\d,\.]+)", 1, 0.6),
    (r"([\d,\.]+)\s*followers?", 1, 0.6),
]
SUBSCRIBER_PATTERNS = [
    (r"([\d,\.]+)\s*[mM]\s*subscribers", 1_000_000, 0.7),
    (r"([\d,\.]+)\s*[kK]\s*subscribers", 1_000, 0.7),
    (r"subscribers?\s*[:\s]*([\d,\.]+)", 1, 0.6),
    (r"([\d,\.]+)\s*subscribers?", 1, 0.6),
]


def _parse_number(s: str) -> int:
    """Parse '1.2M', '500K', '1,234,567' to int."""
    s = s.replace(",", "").strip()
    try:
        return int(float(s))
    except ValueError:
        return 0


def list_snapshots(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    limit: int = 200,
) -> list[dict]:
    """
    Use Wayback CDX API to return snapshot timestamps + original URL.
    Returns list of {"timestamp": "...", "original": "..."}.
    """
    params = {
        "url": url,
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype",
        "filter": "statuscode:200",
        "collapse": "timestamp:8",
        "limit": limit,
    }
    if from_year is not None:
        params["from"] = str(from_year)
    if to_year is not None:
        params["to"] = str(to_year)

    with httpx.Client(timeout=15.0, headers=WAYBACK_HEADERS) as client:
        resp = client.get(CDX_URL, params=params)
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


def fetch_snapshot_html(timestamp: str, url: str) -> Optional[str]:
    """Fetch HTML from archived URL. Returns None on failure."""
    archived = f"https://web.archive.org/web/{timestamp}/{url}"
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT, headers=WAYBACK_HEADERS) as client:
            resp = client.get(archived)
            resp.raise_for_status()
            return resp.text
    except Exception:
        return None


def extract_metric(
    html: str,
    platform_hint: Optional[str] = None,
) -> Optional[dict]:
    """
    Try to extract follower/subscriber counts.
    Returns {"metric_name": str, "metric_value": int, "confidence": float, "evidence_snippet": str}
    or None with low confidence.
    """
    if not html or len(html) > 2_000_000:
        return None

    html_lower = html.lower()
    best: Optional[dict] = None
    best_confidence = 0.0

    for pattern, multiplier, base_conf in FOLLOWER_PATTERNS + SUBSCRIBER_PATTERNS:
        name = "followers" if "follower" in pattern else "subscribers"
        for m in re.finditer(pattern, html_lower, re.IGNORECASE):
            try:
                raw = m.group(1)
                val = _parse_number(raw) * multiplier
                if val <= 0 or val > 10_000_000_000:
                    continue
                snippet = html[max(0, m.start() - 20) : m.end() + 20].replace("\n", " ").strip()
                snippet = snippet[:80] + "..." if len(snippet) > 80 else snippet
                conf = base_conf
                if len(raw) > 4:
                    conf *= 0.9
                if conf > best_confidence:
                    best_confidence = conf
                    best = {
                        "metric_name": name,
                        "metric_value": val,
                        "confidence": round(conf, 2),
                        "evidence_snippet": snippet,
                    }
            except (IndexError, ValueError):
                continue

    return best


def get_snapshots_with_metrics(
    url: str,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    sample: int = 30,
) -> dict:
    """
    List snapshots, sample evenly, fetch HTML, extract metrics.
    Returns the structure expected by the API.
    """
    snapshots_raw = list_snapshots(url, from_year, to_year, limit=500)
    if not snapshots_raw:
        return {
            "url": url,
            "snapshots": [],
            "notes": "Sparse archival snapshots; coverage varies. Metrics are contextual signals only.",
        }

    # Sample evenly across time
    n = min(sample, len(snapshots_raw))
    step = max(1, len(snapshots_raw) // n)
    indices = [i * step for i in range(n)][:n]
    sampled = [snapshots_raw[i] for i in indices if i < len(snapshots_raw)]

    results = []
    for i, s in enumerate(sampled):
        if i > 0:
            time.sleep(REQUEST_DELAY_MS / 1000.0)
        html = fetch_snapshot_html(s["timestamp"], s["original"])
        entry = {
            "timestamp": s["timestamp"],
            "archived_url": f"https://web.archive.org/web/{s['timestamp']}/{s['original']}",
        }
        if html:
            metric = extract_metric(html)
            if metric:
                entry.update(metric)
        results.append(entry)

    return {
        "url": url,
        "snapshots": results,
        "notes": "Sparse archival snapshots; coverage varies. Metrics are contextual signals only.",
    }

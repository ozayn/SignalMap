"""Fetch Brent crude oil price from FRED (DCOILBRENTEU)."""

import csv
import io
import re
import time
from typing import Optional

import httpx

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU"
FRED_TXT_URL = "https://fred.stlouisfed.org/data/DCOILBRENTEU.txt"
CACHE_TTL_SEC = 6 * 60 * 60  # 6 hours
_cache: Optional[tuple[list[dict], float]] = None
_DATA_LINE = re.compile(r"^[|]?(\d{4}-\d{2}-\d{2})\s*[|]\s*([^|]+)")


def _parse_csv(text: str) -> list[dict]:
    """Parse FRED CSV. Columns: observation_date or DATE, DCOILBRENTEU or VALUE."""
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        date = (row.get("observation_date") or row.get("DATE") or "").strip()
        val = (row.get("DCOILBRENTEU") or row.get("VALUE") or "").strip()
        if not date or not val or val == ".":
            continue
        try:
            v = float(val)
        except ValueError:
            continue
        rows.append({"date": date, "value": round(v, 2)})
    return rows


def _parse_txt(text: str) -> list[dict]:
    """Parse FRED data txt. Format: DATE|VALUE (skip metadata and # lines)."""
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "|" not in line:
            continue
        m = _DATA_LINE.match(line)
        if not m:
            continue
        date, val = m.group(1), m.group(2).strip().rstrip("|")
        if not val or val == ".":
            continue
        try:
            v = float(val)
        except ValueError:
            continue
        rows.append({"date": date, "value": round(v, 2)})
    return rows


def _fetch_raw() -> list[dict]:
    """Fetch and parse FRED. Tries CSV first, then TXT fallback."""
    with httpx.Client(timeout=15.0) as client:
        try:
            r = client.get(FRED_CSV_URL)
            r.raise_for_status()
            parsed = _parse_csv(r.text)
        except Exception:
            r = client.get(FRED_TXT_URL)
            r.raise_for_status()
            parsed = _parse_txt(r.text)
    if not parsed:
        raise ValueError("No valid data from FRED")
    return parsed


def get_brent_oil(start: str, end: str) -> list[dict]:
    """Return Brent oil points in [start, end]. Cached 6h."""
    global _cache
    now = time.time()
    if _cache is None or (now - _cache[1]) > CACHE_TTL_SEC:
        try:
            raw = _fetch_raw()
            _cache = (raw, now)
        except Exception:
            raise
    points = _cache[0]
    filtered = [p for p in points if start <= p["date"] <= end]
    return filtered

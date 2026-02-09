"""Fetch U.S. CPI (CPIAUCSL) from FRED for inflation adjustment."""

import csv
import io
import re
from typing import Any

import httpx

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
FRED_TXT_URL = "https://fred.stlouisfed.org/data/CPIAUCSL.txt"
_DATA_LINE = re.compile(r"^[|]?(\d{4}-\d{2}-\d{2})\s*[|]\s*([^|]+)")


def _parse_csv(text: str) -> list[dict[str, Any]]:
    """Parse FRED CSV. Columns: observation_date or DATE, CPIAUCSL or VALUE."""
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        date = (row.get("observation_date") or row.get("DATE") or "").strip()
        val = (row.get("CPIAUCSL") or row.get("VALUE") or "").strip()
        if not date or not val or val == ".":
            continue
        try:
            v = float(val)
        except ValueError:
            continue
        rows.append({"date": date, "value": round(v, 2)})
    return rows


def _parse_txt(text: str) -> list[dict[str, Any]]:
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


def fetch_cpi_series() -> list[dict[str, Any]]:
    """
    Fetch full U.S. CPI series from FRED (CPIAUCSL).
    Returns [{date, value}, ...] sorted by date ascending.
    Monthly frequency. Index 1982-84=100.
    """
    with httpx.Client(timeout=10.0) as client:
        try:
            r = client.get(FRED_CSV_URL)
            r.raise_for_status()
            parsed = _parse_csv(r.text)
        except Exception:
            r = client.get(FRED_TXT_URL)
            r.raise_for_status()
            parsed = _parse_txt(r.text)
    if not parsed:
        raise ValueError("No valid CPI data from FRED")
    return sorted(parsed, key=lambda p: p["date"])

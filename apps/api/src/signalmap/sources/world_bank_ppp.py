"""Fetch Iran PPP conversion factor from World Bank (PA.NUS.PPP)."""

from typing import Any

import httpx

WB_API_URL = "https://api.worldbank.org/v2/country/IRN/indicator/PA.NUS.PPP"
CACHE_TTL = 86400  # 24 hours (annual data, infrequent updates)


def fetch_iran_ppp_series() -> list[dict[str, Any]]:
    """
    Fetch Iran PPP conversion factor (LCU per international $) from World Bank.
    Returns [{year: int, value: float}, ...] for years with non-null data.
    Annual frequency. Data available from 1990.
    """
    with httpx.Client(timeout=15.0) as client:
        r = client.get(f"{WB_API_URL}?format=json&per_page=100")
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("Invalid World Bank API response")
    records = data[1]
    if not isinstance(records, list):
        raise ValueError("No PPP data from World Bank")
    rows: list[dict[str, Any]] = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        date_str = rec.get("date")
        val = rec.get("value")
        if not date_str or val is None:
            continue
        try:
            year = int(date_str)
            value = float(val)
        except (ValueError, TypeError):
            continue
        rows.append({"year": year, "value": round(value, 2)})
    return sorted(rows, key=lambda r: r["year"])

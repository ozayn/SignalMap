"""Fetch PPP conversion factor from World Bank (PA.NUS.PPP)."""

from typing import Any

import httpx

WB_BASE = "https://api.worldbank.org/v2/country"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"
CACHE_TTL = 86400  # 24 hours (annual data, infrequent updates)


def fetch_ppp_series(country_code: str) -> list[dict[str, Any]]:
    """
    Fetch PPP conversion factor (LCU per international $) from World Bank.
    country_code: ISO 3166-1 alpha-3 (e.g. IRN, TUR).
    Returns [{year: int, value: float}, ...] for years with non-null data.
    """
    url = f"{WB_BASE}/{country_code}/indicator/PA.NUS.PPP"
    with httpx.Client(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(f"{url}?format=json&per_page=100")
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("Invalid World Bank API response")
    records = data[1]
    if not isinstance(records, list):
        raise ValueError(f"No PPP data from World Bank for {country_code}")
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


def fetch_iran_ppp_series() -> list[dict[str, Any]]:
    """Fetch Iran PPP conversion factor. Delegates to fetch_ppp_series."""
    return fetch_ppp_series("IRN")


def fetch_turkey_ppp_series() -> list[dict[str, Any]]:
    """Fetch Turkey PPP conversion factor. Delegates to fetch_ppp_series."""
    return fetch_ppp_series("TUR")

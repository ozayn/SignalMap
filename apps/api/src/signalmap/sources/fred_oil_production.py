"""Fetch oil production from FRED (IMF Regional Economic Outlook series).

Series: SAUNGDPMOMBD (Saudi), IRNNGDPMOMBD (Iran), RUSNGDPMOMBD (Russia).
Values in barrels/day; we convert to million barrels/day.
US: no IMF REO series in FRED; use fallback.
"""

import os
from typing import Any

import httpx

FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"

# FRED series: barrels/day (annual). Convert to million bbl/day by / 1e6.
FRED_SERIES = {
    "saudi_arabia": "SAUNGDPMOMBD",
    "iran": "IRNNGDPMOMBD",
    "russia": "RUSNGDPMOMBD",
}


def _require_api_key() -> str:
    key = (os.getenv("FRED_API_KEY") or "").strip()
    if not key:
        raise ValueError("FRED_API_KEY not configured")
    return key


def _fetch_fred_series(series_id: str, start_year: int = 2000) -> dict[int, float]:
    """Fetch FRED series, return {year: million_bbl_per_day}."""
    api_key = _require_api_key()
    start = f"{start_year}-01-01"
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start,
    }
    with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(FRED_OBSERVATIONS_URL, params=params)
        r.raise_for_status()
        data = r.json()
    observations = data.get("observations") or []
    result: dict[int, float] = {}
    for obs in observations:
        val = (obs.get("value") or "").strip()
        if not val or val == ".":
            continue
        try:
            v = float(val)
        except ValueError:
            continue
        date = obs.get("date", "").strip()
        if len(date) >= 4:
            year = int(date[:4])
            # Convert barrels/day to million barrels/day
            result[year] = round(v / 1_000_000, 2)
    return result


def fetch_oil_production_from_fred() -> dict[str, dict[int, float]]:
    """
    Fetch Saudi, Iran, Russia oil production from FRED.
    Returns {saudi_arabia: {year: mbpd}, iran: {...}, russia: {...}}.
    """
    out: dict[str, dict[int, float]] = {}
    for key, series_id in FRED_SERIES.items():
        try:
            out[key] = _fetch_fred_series(series_id)
        except Exception:
            out[key] = {}
    return out

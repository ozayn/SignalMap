"""Fetch Brent crude oil price from FRED (DCOILBRENTEU) via official API."""

import os
from typing import Any

import httpx

FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
SERIES_ID = "DCOILBRENTEU"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"


def _require_api_key() -> str:
    key = (os.getenv("FRED_API_KEY") or "").strip()
    if not key:
        raise ValueError("FRED_API_KEY not configured. Set it in the environment.")
    return key


def fetch_brent_from_fred(start_date: str, end_date: str | None = None) -> list[dict[str, Any]]:
    """
    Fetch Brent oil observations from FRED API.
    Uses observation_start for incremental fetching.
    Returns [{date, value}, ...] sorted by date ascending.
    Ignores "." missing values.
    """
    api_key = _require_api_key()
    params: dict[str, str] = {
        "series_id": SERIES_ID,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start_date,
    }
    if end_date:
        params["observation_end"] = end_date

    with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(FRED_OBSERVATIONS_URL, params=params)
        r.raise_for_status()
        data = r.json()

    observations = data.get("observations") or []
    points: list[dict[str, Any]] = []
    for obs in observations:
        val = (obs.get("value") or "").strip()
        if not val or val == ".":
            continue
        try:
            v = float(val)
        except ValueError:
            continue
        date = obs.get("date", "").strip()
        if date:
            points.append({"date": date, "value": round(v, 2)})
    return sorted(points, key=lambda p: p["date"])


def fetch_brent_series() -> list[dict[str, Any]]:
    """
    Fetch full Brent series from FRED API.
    Used by get_brent_series when DB is empty. Uses BRENT_DAILY_START.
    """
    from signalmap.data.oil_annual import BRENT_DAILY_START
    return fetch_brent_from_fred(BRENT_DAILY_START)

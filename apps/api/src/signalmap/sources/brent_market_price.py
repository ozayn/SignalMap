"""Fetch latest Brent crude market price from Financial Modeling Prep.

Uses FMP Commodities Quote API (BZUSD = ICE Brent crude futures).
"""

import os
from datetime import datetime, timezone
from typing import Any

import httpx

# FMP Commodities Quote (BZUSD = ICE Brent crude futures)
FMP_QUOTE_URL = "https://financialmodelingprep.com/stable/quote"
USER_AGENT = "SignalMap/1.0 (research; +https://github.com/ozayn/SignalMap)"


def _require_api_key() -> str:
    key = (os.getenv("FMP_API_KEY") or "").strip()
    if not key:
        raise ValueError("FMP_API_KEY not configured. Set it in the environment.")
    return key


def fetch_brent_market_price() -> dict[str, Any]:
    """
    Fetch latest Brent crude price from FMP.
    Returns {"price": float, "timestamp": datetime} or raises.
    """
    api_key = _require_api_key()
    params = {"symbol": "BZUSD", "apikey": api_key}

    with httpx.Client(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(FMP_QUOTE_URL, params=params)
        r.raise_for_status()
        data = r.json()

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("FMP returned empty or invalid response")

    item = data[0]
    price = item.get("price") or item.get("last") or item.get("close")
    if price is None:
        raise ValueError("FMP response missing price")

    try:
        price_float = float(price)
    except (TypeError, ValueError):
        raise ValueError("FMP price is not numeric")

    # FMP may return timestamp; fallback to now
    ts = datetime.now(timezone.utc)
    if "timestamp" in item and item["timestamp"]:
        try:
            ts = datetime.fromtimestamp(item["timestamp"], tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            pass

    return {"price": round(price_float, 2), "timestamp": ts}

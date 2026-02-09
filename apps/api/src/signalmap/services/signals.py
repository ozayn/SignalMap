"""
Signal series orchestration.
Uses in-memory TTL cache for now. Can later be switched to read from Postgres
first, then fetch as fallback, with minimal changes to this interface.
"""

from signalmap.sources.fred_brent import fetch_brent_series
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

CACHE_KEY = "fred:DCOILBRENTEU:all"
CACHE_TTL = 21600  # 6 hours


def get_brent_series(start: str, end: str) -> dict:
    """
    Return Brent oil points in [start, end] inclusive.
    Caches full series for 6h; filters at request time.
    """
    full = cache_get(CACHE_KEY)
    if full is None:
        full = fetch_brent_series()
        cache_set(CACHE_KEY, full, CACHE_TTL)
    points = [p for p in full if start <= p["date"] <= end]
    return {
        "signal": "brent_oil_price",
        "unit": "USD/barrel",
        "source": {
            "name": "FRED",
            "series_id": "DCOILBRENTEU",
            "publisher": "Federal Reserve Bank of St. Louis",
            "url": "https://fred.stlouisfed.org/series/DCOILBRENTEU",
        },
        "points": points,
    }

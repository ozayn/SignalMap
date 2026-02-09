"""
Signal series orchestration.
Uses in-memory TTL cache for now. Can later be switched to read from Postgres
first, then fetch as fallback, with minimal changes to this interface.
"""

from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.fred_brent import fetch_brent_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

CACHE_KEY_BRENT = "fred:DCOILBRENTEU:all"
CACHE_KEY_USD_TOMAN = "bonbast:usd_toman:series"
CACHE_KEY_FRED_IRAN_FX = "fred:XRNCUSIRA618NRUG:iran_fx"
CACHE_KEY_RIAL_ARCHIVE = "rial_archive:usd_toman:series"
CACHE_TTL = 21600  # 6 hours


def get_brent_series(start: str, end: str) -> dict:
    """
    Return Brent oil points in [start, end] inclusive.
    Caches full series for 6h; filters at request time.
    """
    full = cache_get(CACHE_KEY_BRENT)
    if full is None:
        full = fetch_brent_series()
        cache_set(CACHE_KEY_BRENT, full, CACHE_TTL)
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


def get_usd_toman_series(start: str, end: str) -> dict:
    """
    Return USD→Toman open-market rate points in [start, end] inclusive.
    Merges: rial-exchange-rates-archive (daily 2012–present) + FRED (annual 1955–2019).
    Prefer Bonbast for overlap to get freshest recent data when archive may lag.
    Caches each source for 6h; filters at request time.
    """
    archive = cache_get(CACHE_KEY_RIAL_ARCHIVE)
    if archive is None:
        try:
            archive = fetch_archive_usd_toman_series()
            cache_set(CACHE_KEY_RIAL_ARCHIVE, archive, CACHE_TTL)
        except Exception:
            archive = []

    bonbast = cache_get(CACHE_KEY_USD_TOMAN)
    if bonbast is None:
        try:
            bonbast = fetch_usd_toman_series()
            cache_set(CACHE_KEY_USD_TOMAN, bonbast, CACHE_TTL)
        except Exception:
            bonbast = []

    fred = cache_get(CACHE_KEY_FRED_IRAN_FX)
    if fred is None:
        try:
            fred = fetch_iran_fx_series()
            cache_set(CACHE_KEY_FRED_IRAN_FX, fred, CACHE_TTL)
        except Exception:
            fred = []

    by_date: dict[str, dict] = {}
    for p in fred:
        by_date[p["date"]] = {**p, "_source": "fred"}
    for p in archive:
        by_date[p["date"]] = {**p, "_source": "archive"}
    for p in bonbast:
        by_date[p["date"]] = {**p, "_source": "bonbast"}

    merged = sorted(by_date.values(), key=lambda x: x["date"])
    points = [
        {"date": p["date"], "value": p["value"]}
        for p in merged
        if start <= p["date"] <= end
    ]

    return {
        "signal": "usd_toman_open_market",
        "unit": "toman_per_usd",
        "source": {
            "name": "rial-exchange-rates-archive + Bonbast + FRED",
            "publisher": "Bonbast archive (2012–present) + FRED (pre-2012)",
            "type": "open_market_proxy",
            "url": "https://github.com/SamadiPour/rial-exchange-rates-archive",
            "notes": "Values in toman (1 toman = 10 rials). Daily: Bonbast archive. Pre-2012: FRED annual.",
        },
        "points": points,
    }

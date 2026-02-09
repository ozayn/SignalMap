"""
Signal series orchestration.
Read path: cache → Postgres → fetcher (with upsert).
"""

from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.fred_brent import fetch_brent_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.store.signals_repo import get_points, upsert_points
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_USD_TOMAN = "usd_toman_open_market"
CACHE_TTL = 21600  # 6 hours

BRENT_SOURCE = {
    "name": "FRED",
    "series_id": "DCOILBRENTEU",
    "publisher": "Federal Reserve Bank of St. Louis",
    "url": "https://fred.stlouisfed.org/series/DCOILBRENTEU",
}

USD_TOMAN_SOURCE = {
    "name": "rial-exchange-rates-archive + Bonbast + FRED",
    "publisher": "Bonbast archive (2012–present) + FRED (pre-2012)",
    "type": "open_market_proxy",
    "url": "https://github.com/SamadiPour/rial-exchange-rates-archive",
    "notes": "Values in toman (1 toman = 10 rials). Daily: Bonbast archive. Pre-2012: FRED annual.",
}


def _cache_key(signal_key: str, start: str, end: str) -> str:
    return f"signal:{signal_key}:{start}:{end}"


def _to_response_points(rows: list[dict]) -> list[dict]:
    """Normalize DB rows to {date, value} for API response."""
    return [{"date": r["date"], "value": r["value"]} for r in rows]


def fetch_usd_toman_merged() -> list[dict]:
    """Fetch from all sources and merge. Returns [{date, value}, ...]."""
    archive = []
    bonbast = []
    fred = []
    try:
        archive = fetch_archive_usd_toman_series()
    except Exception:
        pass
    try:
        bonbast = fetch_usd_toman_series()
    except Exception:
        pass
    try:
        fred = fetch_iran_fx_series()
    except Exception:
        pass

    by_date: dict[str, dict] = {}
    for p in fred:
        by_date[p["date"]] = p
    for p in archive:
        by_date[p["date"]] = p
    for p in bonbast:
        by_date[p["date"]] = p
    return sorted(by_date.values(), key=lambda x: x["date"])


def get_brent_series(start: str, end: str) -> dict:
    """
    Return Brent oil points in [start, end].
    Read path: cache → Postgres → FRED (with upsert).
    """
    ck = _cache_key(SIGNAL_BRENT, start, end)
    cached = cache_get(ck)
    if cached is not None:
        return cached

    db_points = get_points(SIGNAL_BRENT, start, end)
    if db_points:
        result = {
            "signal": SIGNAL_BRENT,
            "unit": "USD/barrel",
            "source": BRENT_SOURCE,
            "points": _to_response_points(db_points),
        }
        cache_set(ck, result, CACHE_TTL)
        return result

    full = fetch_brent_series()
    points = [p for p in full if start <= p["date"] <= end]
    if points:
        upsert_points(
            SIGNAL_BRENT,
            points,
            source="FRED:DCOILBRENTEU",
            metadata={"source": BRENT_SOURCE},
        )

    result = {
        "signal": SIGNAL_BRENT,
        "unit": "USD/barrel",
        "source": BRENT_SOURCE,
        "points": points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_usd_toman_series(start: str, end: str) -> dict:
    """
    Return USD→Toman points in [start, end].
    Read path: cache → Postgres → fetchers (with upsert).
    """
    ck = _cache_key(SIGNAL_USD_TOMAN, start, end)
    cached = cache_get(ck)
    if cached is not None:
        return cached

    db_points = get_points(SIGNAL_USD_TOMAN, start, end)
    if db_points:
        result = {
            "signal": SIGNAL_USD_TOMAN,
            "unit": "toman_per_usd",
            "source": USD_TOMAN_SOURCE,
            "points": _to_response_points(db_points),
        }
        cache_set(ck, result, CACHE_TTL)
        return result

    merged = fetch_usd_toman_merged()
    points = [p for p in merged if start <= p["date"] <= end]
    if points:
        upsert_points(
            SIGNAL_USD_TOMAN,
            points,
            source="bonbast_archive_fred",
            metadata={"source": USD_TOMAN_SOURCE},
        )

    result = {
        "signal": SIGNAL_USD_TOMAN,
        "unit": "toman_per_usd",
        "source": USD_TOMAN_SOURCE,
        "points": points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result

"""
Signal series orchestration.
Read path: cache → Postgres → fetcher (with upsert).
"""

from signalmap.data.oil_annual import BRENT_DAILY_START, OIL_ANNUAL_EIA
from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.fred_brent import fetch_brent_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.store.signals_repo import get_points, upsert_points
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_OIL_GLOBAL_LONG = "oil_global_long"
SIGNAL_USD_TOMAN = "usd_toman_open_market"
CACHE_TTL = 21600  # 6 hours

BRENT_SOURCE = {
    "name": "FRED",
    "series_id": "DCOILBRENTEU",
    "publisher": "Federal Reserve Bank of St. Louis",
    "url": "https://fred.stlouisfed.org/series/DCOILBRENTEU",
}

OIL_ANNUAL_SOURCE = {
    "name": "EIA",
    "series_id": "U.S. Crude Oil First Purchase Price",
    "publisher": "U.S. Energy Information Administration",
    "url": "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=A&n=pet&s=f000000__3",
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


def get_oil_global_long_series(start: str, end: str) -> dict:
    """
    Long-range oil price: annual (EIA) before 1987-05-20, daily (Brent) from then.
    No fabrication of daily data pre-1987. Single point per year at YYYY-01-01.
    """
    ck = _cache_key(SIGNAL_OIL_GLOBAL_LONG, start, end)
    cached = cache_get(ck)
    if cached is not None:
        return cached

    annual_points: list[dict] = []
    brent_points: list[dict] = []

    if start < BRENT_DAILY_START:
        start_year = max(1900, int(start[:4]))
        end_year = min(1986, int(end[:4]))
        for y in range(start_year, end_year + 1):
            if y in OIL_ANNUAL_EIA:
                annual_points.append({
                    "date": f"{y}-01-01",
                    "value": round(OIL_ANNUAL_EIA[y], 2),
                })

    if end >= BRENT_DAILY_START:
        brent_start = start if start >= BRENT_DAILY_START else BRENT_DAILY_START
        brent_result = get_brent_series(brent_start, end)
        brent_points = brent_result.get("points", [])

    points = sorted(annual_points + brent_points, key=lambda p: p["date"])

    result = {
        "signal": SIGNAL_OIL_GLOBAL_LONG,
        "unit": "USD/barrel",
        "source": BRENT_SOURCE,
        "source_annual": OIL_ANNUAL_SOURCE,
        "source_daily": BRENT_SOURCE,
        "resolution_change": "Annual (one point/year) before 1987-05-20; daily Brent from 1987-05-20 onward.",
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

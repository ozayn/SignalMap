"""
Signal series orchestration.
Read path: cache → Postgres → fetcher (with upsert).
"""

from signalmap.data.gold_annual import GOLD_ANNUAL
from signalmap.data.oil_annual import BRENT_DAILY_START, OIL_ANNUAL_EIA
from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.fred_brent import fetch_brent_series
from signalmap.sources.fred_cpi import fetch_cpi_series
from signalmap.sources.world_bank_ppp import fetch_iran_ppp_series, fetch_turkey_ppp_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.store.signals_repo import get_points, upsert_points
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_OIL_GLOBAL_LONG = "oil_global_long"
SIGNAL_REAL_OIL = "real_oil_price"
SIGNAL_OIL_PPP_IRAN = "oil_price_ppp_iran"
SIGNAL_OIL_PPP_TURKEY = "oil_price_ppp_turkey"
SIGNAL_USD_TOMAN = "usd_toman_open_market"
CACHE_TTL = 21600  # 6 hours

# Base year for inflation adjustment (CPI reference month)
CPI_BASE_YEAR = 2015
CPI_BASE_MONTH = "2015-01"

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

GOLD_SOURCE = {
    "name": "LBMA / Treasury",
    "series_id": "Gold price (annual)",
    "publisher": "LBMA, US Treasury, WGC",
    "url": "https://www.gold.org/goldhub/data/historical-data",
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


def _sample_to_monthly(points: list[dict]) -> list[dict]:
    """Keep first observation of each month, normalized to YYYY-MM-01 for axis alignment."""
    by_month: dict[str, dict] = {}
    for p in points:
        month_key = p["date"][:7]
        if month_key not in by_month:
            by_month[month_key] = {"date": f"{month_key}-01", "value": p["value"]}
    return sorted(by_month.values(), key=lambda p: p["date"])


def get_oil_global_long_series(start: str, end: str) -> dict:
    """
    Long-range oil price: annual (EIA) before 1987-05-20, daily (Brent) from then.
    No fabrication of daily data pre-1987. Single point per year at YYYY-01-01.
    For ranges > 10 years, daily Brent is sampled to monthly to reduce payload.
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
        # Sample to monthly for long ranges to reduce payload (~14k -> ~500)
        span_years = int(end[:4]) - int(brent_start[:4]) + 1
        if span_years > 10 and len(brent_points) > 500:
            brent_points = _sample_to_monthly(brent_points)

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


def get_gold_price_global_series(start: str, end: str) -> dict:
    """
    Global gold price (USD/oz). Annual data only; one point per year at YYYY-01-01.
    No daily data; no interpolation.
    """
    ck = f"signal:gold_price_global:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = max(1900, int(start[:4]))
    end_year = min(max(GOLD_ANNUAL.keys()), int(end[:4]))
    points: list[dict] = []
    for y in range(start_year, end_year + 1):
        if y in GOLD_ANNUAL:
            points.append({"date": f"{y}-01-01", "value": round(GOLD_ANNUAL[y], 2)})

    result = {
        "signal": "gold_price_global",
        "unit": "USD/oz",
        "source": GOLD_SOURCE,
        "resolution": "annual",
        "points": points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def _get_cpi_by_month() -> dict[str, float]:
    """Return CPI by month (YYYY-MM). Cached 6h."""
    ck = "signal:cpi:full"
    cached = cache_get(ck)
    if cached is not None:
        return cached
    rows = fetch_cpi_series()
    by_month = {p["date"][:7]: p["value"] for p in rows}
    cache_set(ck, by_month, CACHE_TTL)
    return by_month


def get_real_oil_series(start: str, end: str) -> dict:
    """
    Real oil price: nominal (Brent) / CPI * CPI_base.
    Base year: 2015 (CPI value at 2015-01).
    Returns USD/bbl in constant 2015 dollars.
    """
    ck = f"{_cache_key(SIGNAL_REAL_OIL, start, end)}:base{CPI_BASE_YEAR}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    brent_result = get_brent_series(start, end)
    oil_points = brent_result.get("points", [])
    cpi_by_month = _get_cpi_by_month()
    cpi_base = cpi_by_month.get(CPI_BASE_MONTH)
    if not cpi_base:
        raise ValueError(f"CPI base {CPI_BASE_MONTH} not available")

    real_points: list[dict] = []
    for p in oil_points:
        month_key = p["date"][:7]
        cpi = cpi_by_month.get(month_key)
        if cpi is None or cpi <= 0:
            continue
        real_val = round(p["value"] * cpi_base / cpi, 2)
        real_points.append({"date": p["date"], "value": real_val})

    result = {
        "signal": SIGNAL_REAL_OIL,
        "unit": "USD/bbl (2015 dollars)",
        "base_year": CPI_BASE_YEAR,
        "source": {
            "oil": "FRED DCOILBRENTEU (Brent)",
            "cpi": "FRED CPIAUCSL",
        },
        "metadata": {
            "base_year": CPI_BASE_YEAR,
            "base_month": CPI_BASE_MONTH,
            "formula": "real_oil_price = nominal_oil_price * CPI_base / CPI_date",
        },
        "points": real_points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def _get_oil_annual_avg_by_year(start_year: int, end_year: int) -> dict[int, float]:
    """Return annual average oil price (USD/bbl) by year. Uses EIA for pre-1987, Brent for 1987+."""
    result: dict[int, float] = {}
    for y in range(start_year, end_year + 1):
        if y in OIL_ANNUAL_EIA:
            result[y] = OIL_ANNUAL_EIA[y]
    if end_year >= 1987:
        brent_start = f"{max(start_year, 1987)}-01-01"
        brent_end = f"{end_year}-12-31"
        brent = get_brent_series(brent_start, brent_end)
        pts = brent.get("points", [])
        by_year: dict[int, list[float]] = {}
        for p in pts:
            y = int(p["date"][:4])
            if start_year <= y <= end_year:
                by_year.setdefault(y, []).append(p["value"])
        for y, vals in by_year.items():
            result[y] = round(sum(vals) / len(vals), 2)
    return result


def _get_iran_ppp_by_year() -> dict[int, float]:
    """Return Iran PPP conversion factor by year. Cached 24h."""
    ck = "signal:ppp_iran:by_year"
    cached = cache_get(ck)
    if cached is not None:
        return cached
    rows = fetch_iran_ppp_series()
    by_year = {r["year"]: r["value"] for r in rows}
    cache_set(ck, by_year, 86400)
    return by_year


def _get_turkey_ppp_by_year() -> dict[int, float]:
    """Return Turkey PPP conversion factor by year. Cached 24h."""
    ck = "signal:ppp_turkey:by_year"
    cached = cache_get(ck)
    if cached is not None:
        return cached
    rows = fetch_turkey_ppp_series()
    by_year = {r["year"]: r["value"] for r in rows}
    cache_set(ck, by_year, 86400)
    return by_year


def get_oil_ppp_iran_series(start: str, end: str) -> dict:
    """
    Oil price burden in Iran (PPP-adjusted). Annual only.
    oil_price_ppp_iran(year) = nominal_oil_avg(year) * ppp_conversion_factor(year)
    Returns PPP-adjusted toman per barrel (1 toman = 10 rials). Burden proxy, not market price.
    """
    ck = f"{_cache_key(SIGNAL_OIL_PPP_IRAN, start, end)}:toman"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = max(1990, int(start[:4]))
    end_year = min(int(end[:4]), 2024)
    ppp_by_year = _get_iran_ppp_by_year()
    oil_by_year = _get_oil_annual_avg_by_year(start_year, end_year)

    points: list[dict] = []
    for y in range(start_year, end_year + 1):
        oil_avg = oil_by_year.get(y)
        ppp = ppp_by_year.get(y)
        if oil_avg is None or ppp is None or ppp <= 0:
            continue
        val = round(oil_avg * ppp / 10, 0)  # 1 toman = 10 rials
        points.append({"date": f"{y}-01-01", "value": val})

    result = {
        "signal": SIGNAL_OIL_PPP_IRAN,
        "unit": "PPP-adjusted toman per barrel",
        "country": "Iran",
        "source": {
            "oil": "FRED DCOILBRENTEU (Brent)",
            "ppp": "World Bank / ICP (PA.NUS.PPP)",
        },
        "resolution": "annual",
        "points": points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_oil_ppp_turkey_series(start: str, end: str) -> dict:
    """
    Oil price burden in Turkey (PPP-adjusted). Annual only.
    Same methodology as Iran: oil_price_ppp_turkey(year) = nominal_oil_avg(year) * ppp_conversion_factor(year)
    Returns PPP-adjusted lira per barrel. Burden proxy, not market price.
    """
    ck = f"{_cache_key(SIGNAL_OIL_PPP_TURKEY, start, end)}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = max(1990, int(start[:4]))
    end_year = min(int(end[:4]), 2024)
    ppp_by_year = _get_turkey_ppp_by_year()
    oil_by_year = _get_oil_annual_avg_by_year(start_year, end_year)

    points: list[dict] = []
    for y in range(start_year, end_year + 1):
        oil_avg = oil_by_year.get(y)
        ppp = ppp_by_year.get(y)
        if oil_avg is None or ppp is None or ppp <= 0:
            continue
        val = round(oil_avg * ppp, 0)
        points.append({"date": f"{y}-01-01", "value": val})

    result = {
        "signal": SIGNAL_OIL_PPP_TURKEY,
        "unit": "PPP-adjusted lira per barrel",
        "country": "Turkey",
        "source": {
            "oil": "FRED DCOILBRENTEU (Brent)",
            "ppp": "World Bank / ICP (PA.NUS.PPP)",
        },
        "resolution": "annual",
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

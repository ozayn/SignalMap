"""
Signal series orchestration.
Read path: cache → Postgres → fetcher (with upsert).
"""

from datetime import datetime, timezone

from signalmap.data.gold_annual import GOLD_ANNUAL
from signalmap.data.iran_export_volume import IRAN_EXPORT_VOLUME_EST
from signalmap.data.iran_wage_cpi import (
    IRAN_CPI_2010_BASE,
    IRAN_NOMINAL_MINIMUM_WAGE,
    WAGE_CPI_BASE_YEAR,
)
from signalmap.data.oil_annual import BRENT_DAILY_START, OIL_ANNUAL_EIA
from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.brent_market_price import fetch_brent_market_price
from signalmap.sources.fred_brent import fetch_brent_from_fred
from signalmap.sources.fred_cpi import fetch_cpi_series
from signalmap.sources.world_bank_ppp import fetch_iran_ppp_series, fetch_turkey_ppp_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.data.oil_production_exporters import SOURCE as OIL_PRODUCTION_SOURCE_NAME, UNIT as OIL_PRODUCTION_UNIT
from signalmap.sources.oil_production_exporters import fetch_oil_production_exporters
from signalmap.store.signals_repo import get_points, upsert_points
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_OIL_GLOBAL_LONG = "oil_global_long"
SIGNAL_REAL_OIL = "real_oil_price"
SIGNAL_OIL_PPP_IRAN = "oil_price_ppp_iran"
SIGNAL_OIL_PPP_TURKEY = "oil_price_ppp_turkey"
SIGNAL_IRAN_EXPORT_VOLUME = "iran_oil_export_volume"
SIGNAL_EXPORT_REVENUE_PROXY = "derived_export_revenue_proxy"
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

    points = fetch_brent_from_fred(start, end)
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


BRENT_MARKET_CACHE_KEY = "brent_market_current"
BRENT_MARKET_CACHE_TTL = 3600  # 1 hour


def get_current_brent_price() -> dict | None:
    """
    Return latest Brent crude market price. Uses in-memory TTL cache (1 hour).
    Returns {"price": float, "unit": "USD/barrel", "source": "market", "updated": str} or None on error.
    """
    cached = cache_get(BRENT_MARKET_CACHE_KEY)
    if cached is not None:
        return cached

    try:
        data = fetch_brent_market_price()
        ts = data["timestamp"]
        result = {
            "price": data["price"],
            "unit": "USD/barrel",
            "source": "market",
            "updated": ts.isoformat(),
        }
        cache_set(BRENT_MARKET_CACHE_KEY, result, BRENT_MARKET_CACHE_TTL)
        return result
    except Exception:
        return None


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


IRAN_EXPORT_SOURCE = {
    "name": "EIA / tanker tracking estimates",
    "publisher": "U.S. Energy Information Administration, Vortexa",
    "url": "https://www.eia.gov/international/analysis/country/IRN",
    "notes": "Estimated annual crude oil and condensate exports. Values are estimates; volumes under sanctions are uncertain.",
}


def get_iran_export_volume_series(start: str, end: str) -> dict:
    """
    Return estimated Iran crude oil export volume (million barrels/year). Annual only.
    Values are estimates; clearly marked in metadata.
    """
    ck = f"{_cache_key(SIGNAL_IRAN_EXPORT_VOLUME, start, end)}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = max(2010, int(start[:4]))
    end_year = min(int(end[:4]), 2024)

    points: list[dict] = []
    for y in range(start_year, end_year + 1):
        vol = IRAN_EXPORT_VOLUME_EST.get(y)
        if vol is not None:
            points.append({"date": f"{y}-01-01", "value": vol})

    result = {
        "signal": SIGNAL_IRAN_EXPORT_VOLUME,
        "unit": "million barrels/year",
        "source": IRAN_EXPORT_SOURCE,
        "resolution": "annual",
        "metadata": {"estimated": True, "note": "Export volumes are estimates; uncertain under sanctions."},
        "points": points,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_export_revenue_proxy_series(start: str, end: str) -> dict:
    """
    export_revenue_proxy = oil_price × export_volume. Indexed to first available year = 100.
    Proxy for export earning capacity, not realized revenue.
    """
    ck = f"{_cache_key(SIGNAL_EXPORT_REVENUE_PROXY, start, end)}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = max(2010, int(start[:4]))
    end_year = min(int(end[:4]), 2024)

    oil_by_year = _get_oil_annual_avg_by_year(start_year, end_year)

    raw_points: list[dict] = []
    for y in range(start_year, end_year + 1):
        oil_avg = oil_by_year.get(y)
        vol = IRAN_EXPORT_VOLUME_EST.get(y)
        if oil_avg is not None and vol is not None:
            raw_val = oil_avg * vol
            raw_points.append({"date": f"{y}-01-01", "value": raw_val})

    if not raw_points:
        result = {
            "signal": SIGNAL_EXPORT_REVENUE_PROXY,
            "unit": "Index (base=first year)",
            "source": {
                "oil": "FRED DCOILBRENTEU (Brent)",
                "volume": "EIA / tanker tracking estimates",
            },
            "resolution": "annual",
            "metadata": {
                "note": "Proxy for export earning capacity, not realized revenue.",
                "formula": "oil_price × export_volume",
            },
            "points": [],
            "base_year": None,
        }
        cache_set(ck, result, CACHE_TTL)
        return result

    base_val = raw_points[0]["value"]
    base_year = int(raw_points[0]["date"][:4])

    points: list[dict] = []
    for p in raw_points:
        idx = round((p["value"] / base_val) * 100, 1) if base_val and base_val > 0 else None
        points.append({"date": p["date"], "value": idx})

    result = {
        "signal": SIGNAL_EXPORT_REVENUE_PROXY,
        "unit": "Index (base=first year)",
        "source": {
            "oil": "FRED DCOILBRENTEU (Brent)",
            "volume": "EIA / tanker tracking estimates",
        },
        "resolution": "annual",
        "metadata": {
            "note": "Proxy for export earning capacity, not realized revenue.",
            "formula": "oil_price × export_volume",
            "base_year": base_year,
        },
        "points": points,
        "base_year": base_year,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_oil_export_capacity_study(start: str, end: str) -> dict:
    """
    Combined response for Study 9: oil price (annual), export volume, export revenue proxy.
    """
    start_year = max(2010, int(start[:4]))
    end_year = min(int(end[:4]), 2024)
    oil_by_year = _get_oil_annual_avg_by_year(start_year, end_year)
    oil_points = [
        {"date": f"{y}-01-01", "value": v}
        for y, v in sorted(oil_by_year.items())
        if y in IRAN_EXPORT_VOLUME_EST
    ]

    volume_res = get_iran_export_volume_series(start, end)
    proxy_res = get_export_revenue_proxy_series(start, end)

    return {
        "oil_price": {
            "signal": "oil_price_global",
            "unit": "USD/barrel",
            "source": BRENT_SOURCE,
            "resolution": "annual",
            "points": oil_points,
        },
        "export_volume": volume_res,
        "export_revenue_proxy": proxy_res,
    }


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
    Read path: cache → Postgres (if covers range from start) → fetchers (with upsert).
    If DB has points but only from a later date (e.g. 2022+), we fetch merged so
    open market can show from archive start (2012-10-09) instead of DB start.
    """
    ck = _cache_key(SIGNAL_USD_TOMAN, start, end)
    cached = cache_get(ck)
    if cached is not None:
        return cached

    db_points = get_points(SIGNAL_USD_TOMAN, start, end)
    db_covers_range = (
        db_points
        and db_points[0].get("date")
        and db_points[0]["date"] <= start
    )
    if db_covers_range:
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


OFFICIAL_IRR_SOURCE = {
    "name": "FRED XRNCUSIRA618NRUG",
    "publisher": "Federal Reserve Bank of St. Louis (Penn World Table)",
    "type": "official_proxy",
    "url": "https://fred.stlouisfed.org/series/XRNCUSIRA618NRUG",
    "notes": "Annual data, rials per USD converted to toman (÷10). Series ends 2019.",
}


def get_usd_irr_dual_series(start: str, end: str) -> dict:
    """
    Return official (FRED proxy) and open-market USD/IRR series for dual exchange rate study.
    official: annual, toman per USD (FRED). open_market: daily where available (Bonbast archive).
    """
    official_points = []
    try:
        fred_series = fetch_iran_fx_series()
        official_points = [p for p in fred_series if start <= p["date"] <= end]
    except Exception:
        pass
    open_result = get_usd_toman_series(start, end)
    open_points = open_result.get("points", [])
    return {
        "official": {
            "points": official_points,
            "source": OFFICIAL_IRR_SOURCE,
        },
        "open_market": {
            "points": open_points,
            "source": open_result.get("source", USD_TOMAN_SOURCE),
        },
    }


OIL_PRODUCTION_SOURCE = {
    "name": OIL_PRODUCTION_SOURCE_NAME,
    "publisher": "U.S. Energy Information Administration, International Monetary Fund",
    "url": "https://www.eia.gov/international/data/world",
    "notes": "Annual crude oil production. EIA International Data API (USA, SAU, RUS, IRN). Fallback: static.",
}


SIGNAL_OIL_PRODUCTION_US = "oil_production_us"
SIGNAL_OIL_PRODUCTION_SAUDI = "oil_production_saudi"
SIGNAL_OIL_PRODUCTION_RUSSIA = "oil_production_russia"
SIGNAL_OIL_PRODUCTION_IRAN = "oil_production_iran"


def get_oil_production_exporters_series(start: str, end: str, nocache: bool = False) -> dict:
    """
    Return oil production for United States, Saudi Arabia, Russia, Iran.
    Format: { data: [{date, us, saudi_arabia, russia, iran}, ...], source: {...} }
    Unit: million barrels per day. Annual resolution.
    Read path: cache → DB (if all 4 signals have data) → fetch.
    """
    ck = f"signal:oil_production_exporters:{start}:{end}"
    if not nocache:
        cached = cache_get(ck)
        if cached is not None:
            return cached

    # Try DB first (populated by cron)
    us_rows = get_points(SIGNAL_OIL_PRODUCTION_US, start, end)
    saudi_rows = get_points(SIGNAL_OIL_PRODUCTION_SAUDI, start, end)
    russia_rows = get_points(SIGNAL_OIL_PRODUCTION_RUSSIA, start, end)
    iran_rows = get_points(SIGNAL_OIL_PRODUCTION_IRAN, start, end)
    if us_rows and saudi_rows and russia_rows and iran_rows:
        by_date: dict[str, dict[str, Any]] = {}
        for r in us_rows:
            by_date.setdefault(r["date"], {"date": r["date"]})["us"] = r["value"]
        for r in saudi_rows:
            by_date.setdefault(r["date"], {"date": r["date"]})["saudi_arabia"] = r["value"]
        for r in russia_rows:
            by_date.setdefault(r["date"], {"date": r["date"]})["russia"] = r["value"]
        for r in iran_rows:
            by_date.setdefault(r["date"], {"date": r["date"]})["iran"] = r["value"]
        for row in by_date.values():
            u = row.get("us") or 0
            s = row.get("saudi_arabia") or 0
            ru = row.get("russia") or 0
            ir = row.get("iran") or 0
            row["total_production"] = round(u + s + ru + ir, 2)
        data = sorted(by_date.values(), key=lambda x: x["date"])
        used_db = True
    else:
        # Fetch path
        rows = fetch_oil_production_exporters()
        start_year = int(start[:4])
        end_year = int(end[:4])
        current_year = datetime.now(timezone.utc).year
        effective_end = max(end_year, current_year) if end_year >= current_year - 1 else end_year
        data = [r for r in rows if start_year <= int(r["date"][:4]) <= effective_end]
        used_db = False

    # Ensure current year is included when data ends before (both DB and fetch paths)
    if data:
        current_year = datetime.now(timezone.utc).year
        last_year = int(data[-1]["date"][:4])
        if current_year > last_year:
            last = dict(data[-1])
            last["date"] = f"{current_year}-01-01"
            data = data + [last]

    result = {
        "data": data,
        "source": OIL_PRODUCTION_SOURCE,
        "unit": OIL_PRODUCTION_UNIT,
        "resolution": "annual",
    }
    if nocache:
        result["_debug"] = {
            "path": "db" if used_db else "fetch",
            "years": [r["date"][:4] for r in data] if data else [],
            "last_date": data[-1]["date"] if data else None,
        }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_iran_wage_cpi_series(start: str, end: str) -> dict:
    """
    Return Iran nominal minimum wage and CPI (annual) for real wage study.
    Frontend computes: real_wage = nominal_wage * (CPI_base / CPI_t).
    base_year = 2010 (CPI 2010 = 100).
    """
    start_year = int(start[:4])
    end_year = int(end[:4])
    years = [y for y in range(start_year, end_year + 1) if y in IRAN_NOMINAL_MINIMUM_WAGE and y in IRAN_CPI_2010_BASE]
    cpi_base = IRAN_CPI_2010_BASE.get(WAGE_CPI_BASE_YEAR)
    if not cpi_base or cpi_base <= 0:
        return {
            "nominal": [],
            "cpi": [],
            "base_year": WAGE_CPI_BASE_YEAR,
            "source": {
                "nominal": "ILO ILOSTAT / national sources (million rials/month)",
                "cpi": "World Bank FP.CPI.TOTL (Iran, 2010=100)",
            },
        }
    nominal = [{"date": f"{y}-01-01", "value": IRAN_NOMINAL_MINIMUM_WAGE[y]} for y in years]
    cpi = [{"date": f"{y}-01-01", "value": IRAN_CPI_2010_BASE[y]} for y in years]
    return {
        "nominal": nominal,
        "cpi": cpi,
        "base_year": WAGE_CPI_BASE_YEAR,
        "source": {
            "nominal": "ILO ILOSTAT / national sources (million rials/month)",
            "cpi": "World Bank FP.CPI.TOTL (Iran, 2010=100)",
        },
    }


GDP_COMPOSITION_SIGNAL = "gdp_composition"
GDP_COMPOSITION_CACHE_TTL = 86400

WB_GDP_COMPOSITION_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/",
}


def _filter_indicator_points_by_year(
    points: list[dict], year_start: int, year_end: int
) -> list[dict]:
    out: list[dict] = []
    for p in points:
        y = int(str(p["date"])[:4])
        if year_start <= y <= year_end:
            out.append(p)
    return out


def _gdp_composition_full_for_country(iso: str) -> dict:
    """
    Fetch all available WDI years for the three indicators, build full points on the
    combined natural span (earliest year any series starts through latest year any ends).
    Cached per country (not per date window).
    """
    from signalmap.sources.world_bank_national_accounts import (
        WDI_FINAL_CONSUMPTION_PCT_GDP,
        WDI_GDP_CURRENT_USD,
        WDI_GROSS_CAPITAL_FORMATION_PCT_GDP,
        WDI_LABELS,
        combined_span_from_series,
        fetch_wdi_annual_indicator,
        points_for_chart,
        resolve_national_account_levels_rows,
    )

    cons_raw = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_PCT_GDP)
    inv_raw = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_PCT_GDP)
    gdp_raw = fetch_wdi_annual_indicator(iso, WDI_GDP_CURRENT_USD)

    level_pack = resolve_national_account_levels_rows(iso, gdp_raw)
    lvl_rows = level_pack["rows"]
    cons_lvl_raw = lvl_rows["consumption"]
    gdp_lvl_raw = lvl_rows["gdp"]
    inv_lvl_raw = lvl_rows["investment"]
    lvl_ids = level_pack["ids"]

    natural_start, natural_end, per_series = combined_span_from_series(
        [
            ("final_consumption_pct_gdp", cons_raw),
            ("gross_capital_formation_pct_gdp", inv_raw),
            ("gdp_current_usd", gdp_raw),
            ("consumption_level", cons_lvl_raw),
            ("gdp_level", gdp_lvl_raw),
            ("investment_level", inv_lvl_raw),
        ]
    )
    if natural_start is None or natural_end is None:
        return {
            "signal": GDP_COMPOSITION_SIGNAL,
            "country": {"iso3": iso},
            "resolution": "annual",
            "source": WB_GDP_COMPOSITION_SOURCE,
            "data_span": {
                "first_year_any": None,
                "last_year_any": None,
                "per_series": per_series,
            },
            "indicators": {
                "final_consumption_pct_gdp": {
                    "id": WDI_FINAL_CONSUMPTION_PCT_GDP,
                    "label": WDI_LABELS[WDI_FINAL_CONSUMPTION_PCT_GDP],
                    "display_label": "Final consumption expenditure",
                    "unit": "% of GDP",
                    "points": [],
                },
                "gross_capital_formation_pct_gdp": {
                    "id": WDI_GROSS_CAPITAL_FORMATION_PCT_GDP,
                    "label": WDI_LABELS[WDI_GROSS_CAPITAL_FORMATION_PCT_GDP],
                    "display_label": "Gross capital formation",
                    "unit": "% of GDP",
                    "points": [],
                },
                "gdp_current_usd": {
                    "id": WDI_GDP_CURRENT_USD,
                    "label": WDI_LABELS[WDI_GDP_CURRENT_USD],
                    "display_label": "GDP (nominal)",
                    "unit": "current US$",
                    "points": [],
                },
            },
            "levels": {
                "price_basis": None,
                "unit": None,
                "indicators": {
                    "consumption": {"id": None, "label": "", "display_label": "Consumption", "unit": "", "points": []},
                    "gdp": {"id": None, "label": "", "display_label": "GDP", "unit": "", "points": []},
                    "investment": {"id": None, "label": "", "display_label": "Investment", "unit": "", "points": []},
                },
            },
        }

    cons_pts = points_for_chart(cons_raw, natural_start, natural_end)
    inv_pts = points_for_chart(inv_raw, natural_start, natural_end)
    gdp_pts = points_for_chart(gdp_raw, natural_start, natural_end)

    cons_lvl_pts = points_for_chart(cons_lvl_raw, natural_start, natural_end)
    gdp_lvl_pts = points_for_chart(gdp_lvl_raw, natural_start, natural_end)
    inv_lvl_pts = points_for_chart(inv_lvl_raw, natural_start, natural_end)

    return {
        "signal": GDP_COMPOSITION_SIGNAL,
        "country": {"iso3": iso},
        "resolution": "annual",
        "source": WB_GDP_COMPOSITION_SOURCE,
        "data_span": {
            "first_year_any": natural_start,
            "last_year_any": natural_end,
            "per_series": per_series,
        },
        "indicators": {
            "final_consumption_pct_gdp": {
                "id": WDI_FINAL_CONSUMPTION_PCT_GDP,
                "label": WDI_LABELS[WDI_FINAL_CONSUMPTION_PCT_GDP],
                "display_label": "Final consumption expenditure",
                "unit": "% of GDP",
                "points": cons_pts,
            },
            "gross_capital_formation_pct_gdp": {
                "id": WDI_GROSS_CAPITAL_FORMATION_PCT_GDP,
                "label": WDI_LABELS[WDI_GROSS_CAPITAL_FORMATION_PCT_GDP],
                "display_label": "Gross capital formation",
                "unit": "% of GDP",
                "points": inv_pts,
            },
            "gdp_current_usd": {
                "id": WDI_GDP_CURRENT_USD,
                "label": WDI_LABELS[WDI_GDP_CURRENT_USD],
                "display_label": "GDP (nominal)",
                "unit": "current US$",
                "points": gdp_pts,
            },
        },
        "levels": {
            "price_basis": level_pack["price_basis"],
            "unit": level_pack["unit"],
            "indicators": {
                "consumption": {
                    "id": lvl_ids["consumption"],
                    "label": WDI_LABELS.get(lvl_ids["consumption"], lvl_ids["consumption"]),
                    "display_label": "Consumption",
                    "underlying_label": "Final consumption expenditure",
                    "unit": level_pack["unit"],
                    "points": cons_lvl_pts,
                },
                "gdp": {
                    "id": lvl_ids["gdp"],
                    "label": WDI_LABELS.get(lvl_ids["gdp"], lvl_ids["gdp"]),
                    "display_label": "GDP",
                    "underlying_label": "Gross domestic product",
                    "unit": level_pack["unit"],
                    "points": gdp_lvl_pts,
                },
                "investment": {
                    "id": lvl_ids["investment"],
                    "label": WDI_LABELS.get(lvl_ids["investment"], lvl_ids["investment"]),
                    "display_label": "Investment",
                    "underlying_label": "Gross capital formation",
                    "unit": level_pack["unit"],
                    "points": inv_lvl_pts,
                },
            },
        },
    }


def _annual_average_open_market_toman_per_usd(year_start: int, year_end: int) -> tuple[dict[int, float], dict]:
    """
    Simple arithmetic mean of daily open-market toman-per-USD rates per Gregorian year,
    same merged series as ``get_usd_toman_series`` (Bonbast archive + FRED pre-2012).
    """
    from collections import defaultdict

    start = f"{year_start}-01-01"
    end = f"{year_end}-12-31"
    try:
        fx = get_usd_toman_series(start, end)
    except Exception:
        return {}, USD_TOMAN_SOURCE
    pts = fx.get("points") or []
    src = fx.get("source", USD_TOMAN_SOURCE)
    if isinstance(src, dict):
        fx_meta = src
    else:
        fx_meta = {"name": str(src)} if src else USD_TOMAN_SOURCE
    by_year: dict[int, list[float]] = defaultdict(list)
    for p in pts:
        try:
            y = int(str(p["date"])[:4])
        except (TypeError, ValueError):
            continue
        if y < year_start or y > year_end:
            continue
        v = p.get("value")
        if v is None:
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv > 0:
            by_year[y].append(fv)
    out = {y: sum(vals) / len(vals) for y, vals in by_year.items() if vals}
    return out, fx_meta


def _levels_points_to_billion_toman(
    meta: dict, annual_avg_toman_per_usd: dict[int, float]
) -> dict:
    """Multiply WDI USD level by calendar-year average toman/USD; values in billions of tomans."""
    pts_in = meta.get("points") or []
    new_pts: list[dict] = []
    for p in pts_in:
        if not isinstance(p, dict):
            continue
        ds = p.get("date")
        v = p.get("value")
        if ds is None or v is None:
            continue
        try:
            y = int(str(ds)[:4])
            fv = float(v)
        except (TypeError, ValueError):
            continue
        rate = annual_avg_toman_per_usd.get(y)
        if rate is None:
            continue
        new_pts.append({"date": str(ds), "value": round(fv * rate / 1e9, 4)})
    return {
        **{k: v for k, v in meta.items() if k not in ("points", "unit")},
        "unit": "billion tomans (approx.)",
        "points": new_pts,
    }


def get_gdp_composition_series(
    country_iso3: str, start: str, end: str, levels_currency: str = "usd"
) -> dict:
    """
    Annual GDP composition: final consumption and gross capital formation as % of GDP,
    nominal GDP in current US$, and absolute levels for consumption / GDP / investment
    (constant 2015 US$ when all WDI *KD series exist, else current US$ *CD).

    Country via ISO 3166-1 alpha-3 (e.g. IRN, TUR). Full history is fetched once per
    country (TTL cache). ``start``/``end`` clip returned points; if ``start`` is earlier
    than WDI coverage, points begin at the earliest year any bundled series has data.
    """
    iso = (country_iso3 or "IRN").strip().upper()
    if len(iso) != 3 or not iso.isalpha():
        raise ValueError("country must be a 3-letter ISO 3166-1 alpha-3 code")

    requested_start_year = int(start[:4])
    requested_end_year = int(end[:4])

    ck_full = f"signal:{GDP_COMPOSITION_SIGNAL}:{iso}:full_v2"
    full = cache_get(ck_full)
    if full is None:
        full = _gdp_composition_full_for_country(iso)
        cache_set(ck_full, full, GDP_COMPOSITION_CACHE_TTL)

    span = full.get("data_span") or {}
    natural_start = span.get("first_year_any")
    natural_end = span.get("last_year_any")
    if natural_start is None or natural_end is None:
        return {**full, "levels_conversion": None}

    slice_start = max(int(natural_start), requested_start_year)
    slice_end = min(int(natural_end), requested_end_year)
    if slice_start > slice_end:
        slice_start, slice_end = int(natural_start), int(natural_end)

    indicators_full = full.get("indicators") or {}
    out_indicators: dict = {}
    for key, meta in indicators_full.items():
        if not isinstance(meta, dict):
            continue
        pts = meta.get("points") or []
        out_indicators[key] = {
            **{k: v for k, v in meta.items() if k != "points"},
            "points": _filter_indicator_points_by_year(pts, slice_start, slice_end),
        }

    levels_full = full.get("levels") or {}
    out_levels: dict = {k: v for k, v in levels_full.items() if k != "indicators"}
    lvl_indicators = levels_full.get("indicators") or {}
    out_lvl_indicators: dict = {}
    for key, meta in lvl_indicators.items():
        if not isinstance(meta, dict):
            continue
        pts = meta.get("points") or []
        out_lvl_indicators[key] = {
            **{k: v for k, v in meta.items() if k != "points"},
            "points": _filter_indicator_points_by_year(pts, slice_start, slice_end),
        }
    out_levels["indicators"] = out_lvl_indicators

    result = {
        **{k: v for k, v in full.items() if k not in ("indicators", "data_span", "levels")},
        "data_span": {
            **span,
            "requested_start_year": requested_start_year,
            "requested_end_year": requested_end_year,
            "returned_start_year": slice_start,
            "returned_end_year": slice_end,
        },
        "indicators": out_indicators,
        "levels": out_levels,
        "levels_conversion": None,
    }

    lc = (levels_currency or "usd").strip().lower()
    if lc == "toman" and iso == "IRN":
        annual, fx_src = _annual_average_open_market_toman_per_usd(slice_start, slice_end)
        lvl = result.get("levels") or {}
        ind = lvl.get("indicators") or {}
        new_ind: dict = {}
        for key, meta in ind.items():
            if isinstance(meta, dict):
                new_ind[key] = _levels_points_to_billion_toman(meta, annual)
            else:
                new_ind[key] = meta
        result["levels"] = {**lvl, "indicators": new_ind}
        result["levels_conversion"] = {
            "currency": "toman",
            "display_unit": "billion tomans (approx.)",
            "basis": "open_market_annual_average",
            "description": (
                "Each level point in US dollars is multiplied by the arithmetic mean of daily "
                "open-market toman-per-USD rates in that Gregorian year (same merged series as "
                "GET /api/signals/fx/usd-toman). Shown in billions of tomans. Missing FX years "
                "omit points. Applying nominal FX to constant-2015-USD WDI levels is a hybrid, "
                "illustrative local-currency view—not an official national-accounts series."
            ),
            "fx_source": fx_src,
        }

    return result

"""
Signal series orchestration.
Read path: cache → Postgres → fetcher (with upsert).
"""

import json
import logging
import os
import time
from collections.abc import Callable
from datetime import datetime, timezone

from signalmap.data.gold_annual import GOLD_ANNUAL
from signalmap.data.iran_export_volume import IRAN_EXPORT_VOLUME_EST
from signalmap.data.iran_wage_cpi import (
    IRAN_CPI_2010_BASE,
    IRAN_NOMINAL_MINIMUM_WAGE,
    WAGE_CPI_BASE_YEAR,
)
from signalmap.data.iran_oil_production_annual_historical import (
    HISTORICAL_EARLIEST_YEAR,
    HISTORICAL_EXT_SOURCE,
    apply_iran_historical_gaps,
    merge_iran_historical_into_exporters_data,
)
from signalmap.data.oil_annual import BRENT_DAILY_START, OIL_ANNUAL_EIA
from signalmap.sources.bonbast_usd_toman import fetch_usd_toman_series
from signalmap.sources.brent_market_price import fetch_brent_market_price
from signalmap.sources.fred_brent import fetch_brent_from_fred
from signalmap.sources.fred_cpi import fetch_cpi_series
from signalmap.sources.world_bank_ppp import fetch_iran_ppp_series, fetch_turkey_ppp_series
from signalmap.sources.fred_iran_fx import fetch_iran_fx_series
from signalmap.sources.rial_archive_usd_toman import fetch_archive_usd_toman_series
from signalmap.sources.world_bank_iran_fcrf import (
    OFFICIAL_FX_WDI_FCRF_SOURCE,
    build_iran_official_annual_toman_merged,
)

logger = logging.getLogger(__name__)
from signalmap.data.oil_production_exporters import SOURCE as OIL_PRODUCTION_SOURCE_NAME, UNIT as OIL_PRODUCTION_UNIT
from signalmap.sources.oil_production_exporters import fetch_oil_production_exporters
from signalmap.store.signals_repo import get_points, upsert_points
from signalmap.utils.ttl_cache import get as cache_get, set as cache_set

_SIGNAL_TIMING_LOG = os.environ.get("SIGNAL_TIMING_LOG")

SIGNAL_BRENT = "brent_oil_price"
SIGNAL_OIL_GLOBAL_LONG = "oil_global_long"
SIGNAL_REAL_OIL = "real_oil_price"
SIGNAL_OIL_PPP_IRAN = "oil_price_ppp_iran"
SIGNAL_OIL_PPP_TURKEY = "oil_price_ppp_turkey"
SIGNAL_IRAN_EXPORT_VOLUME = "iran_oil_export_volume"
SIGNAL_EXPORT_REVENUE_PROXY = "derived_export_revenue_proxy"
SIGNAL_USD_TOMAN = "usd_toman_open_market"
CACHE_TTL = 21600  # 6 hours
# Merged open-market series (FRED + rial archive + live Bonbast): expensive; cache separately from per-range keys.
_FX_USD_TOMAN_MERGED_CACHE = "internal:fx_merged:usd_toman_open:v1"
_IRAN_OFFICIAL_FX_ANNUAL_CACHE = "internal:ira_official_fx_annual_toman:v1"
_FX_INTERNAL_TTL = float(CACHE_TTL)

# Base year for inflation adjustment (CPI reference month)
CPI_BASE_YEAR = 2015
CPI_BASE_MONTH = "2015-01"

# Oil-economy overview: real (constant) USD via US annual CPI; base calendar year (fallback if missing)
OIL_ECONOMY_CPI_BASE_YEAR = 2020

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


def get_usd_toman_merged_cached() -> list[dict]:
    """In-memory full merged series; avoids refetching GitHub archive + FRED + Bonbast on every (start,end) cache miss."""
    hit = cache_get(_FX_USD_TOMAN_MERGED_CACHE)
    if hit is not None:
        return hit
    t0 = time.perf_counter()
    merged = fetch_usd_toman_merged()
    cache_set(_FX_USD_TOMAN_MERGED_CACHE, merged, _FX_INTERNAL_TTL)
    logger.info(
        "fx_merged usd_toman: built n=%d merge_s=%.2f (archive+bonbast+fred); cached for %s h",
        len(merged),
        time.perf_counter() - t0,
        _FX_INTERNAL_TTL / 3600,
    )
    return merged


def set_usd_toman_merged_cache(merged: list[dict]) -> None:
    """Set merged cache (e.g. after ingest) so the next read avoids redundant remote fetches."""
    cache_set(_FX_USD_TOMAN_MERGED_CACHE, merged, _FX_INTERNAL_TTL)


def _get_iran_official_annual_toman_cached() -> list[dict]:
    hit = cache_get(_IRAN_OFFICIAL_FX_ANNUAL_CACHE)
    if hit is not None:
        return hit
    t0 = time.perf_counter()
    full = build_iran_official_annual_toman_merged()
    cache_set(_IRAN_OFFICIAL_FX_ANNUAL_CACHE, full, _FX_INTERNAL_TTL)
    logger.info("ira_official_fx_annual: n=%d build_s=%.2f", len(full), time.perf_counter() - t0)
    return full


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


def _cpi_annual_average_by_year() -> dict[int, float]:
    """Calendar-year average of US CPIAUCSL (monthly index, 1982-84=100)."""
    cpi_by_month = _get_cpi_by_month()
    buckets: dict[int, list[float]] = {}
    for mk, v in cpi_by_month.items():
        if v is None or v <= 0:
            continue
        y = int(mk[:4])
        buckets.setdefault(y, []).append(float(v))
    return {y: sum(vals) / len(vals) for y, vals in sorted(buckets.items()) if vals}


def get_us_cpi_monthly_series(start: str, end: str) -> dict:
    """
    US CPIAUCSL monthly index (1982-84=100), trimmed to [start, end] for client-side deflation.
    """
    rows = fetch_cpi_series()
    s = start[:10]
    e = end[:10]
    out = [p for p in rows if isinstance(p.get("date"), str) and s <= p["date"][:10] <= e]
    return {
        "signal": "fred_us_cpi_monthly",
        "unit": "index (1982-84=100)",
        "index_basis": "1982-84=100",
        "source": {
            "name": "FRED",
            "series_id": "CPIAUCSL",
            "publisher": "Federal Reserve Bank of St. Louis",
            "url": "https://fred.stlouisfed.org/series/CPIAUCSL",
        },
        "points": out,
    }


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


def _parallel_ppp_and_oil_averages(
    ppp_by_year_fn: Callable[[], dict[int, float]],
    start_year: int,
    end_year: int,
) -> tuple[dict[int, float], dict[int, float]]:
    """Overlap World Bank PPP fetch with Brent annualization (two independent I/O paths)."""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_ppp = pool.submit(ppp_by_year_fn)
        fut_oil = pool.submit(_get_oil_annual_avg_by_year, start_year, end_year)
        return fut_ppp.result(), fut_oil.result()


def get_oil_ppp_iran_series(start: str, end: str) -> dict:
    """
    Oil price burden in Iran (PPP-adjusted). Annual only.
    oil_price_ppp_iran(year) = nominal_oil_avg(year) * ppp_conversion_factor(year)
    Returns PPP-adjusted toman per barrel (1 toman = 10 rials). Burden proxy, not market price.
    """
    start_year = max(1990, int(start[:4]))
    end_year = min(int(end[:4]), 2024)
    ck = f"signal:{SIGNAL_OIL_PPP_IRAN}:v2:{start_year}:{end_year}:toman"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    ppp_by_year, oil_by_year = _parallel_ppp_and_oil_averages(_get_iran_ppp_by_year, start_year, end_year)

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


def get_oil_economy_overview_iran(start: str, end: str) -> dict:
    """
    Iran production (mb/d), global oil price (USD/bbl), revenue = production * days * price.
    Primary: EIA/IMF bundle; gaps filled from embedded EI (1965–1979) + EIA/BP (1980–1999) annuals.
    1980–86 price: EIA annual; 1987+ FRED DCOILBRENTEU. Revenue: stylized back-of-envelope.
    """
    ck = f"signal:oil_economy_overview:v4:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = int(start[:4])
    end_year = int(end[:4])
    prod_bundle = get_oil_production_exporters_series(start, end)
    iran_by_year: dict[int, float] = {}
    for row in prod_bundle.get("data", []):
        v = row.get("iran")
        if v is not None and isinstance(v, (int, float)) and float(v) > 0:
            iran_by_year[int(row["date"][:4])] = round(float(v), 4)
    apply_iran_historical_gaps(iran_by_year, start_year, end_year)
    iran_prod = [
        {"date": f"{y}-01-01", "value": v}
        for y, v in sorted(iran_by_year.items())
        if start_year <= y <= end_year and v and v > 0
    ]

    oil_by_year = _get_oil_annual_avg_by_year(start_year, end_year)
    price_pts = [
        {"date": f"{y}-01-01", "value": v} for y, v in sorted(oil_by_year.items()) if start_year <= y <= end_year
    ]
    price_methodology = {
        "pre_1987": (
            "EIA U.S. crude first-purchase price (USD/bbl, annual) as global price proxy; "
            "not Dated Brent. Same as other SignalMap pre-Brent annuals."
        ),
        "brent_1987_plus": f"FRED {BRENT_SOURCE['series_id']}: mean of daily USD/bbl; series starts {BRENT_DAILY_START}.",
    }

    by_p = {int(p["date"][:4]): float(p["value"]) for p in iran_prod}
    by_r = {int(p["date"][:4]): float(p["value"]) for p in price_pts}
    revenue: list[dict] = []
    for y in range(start_year, end_year + 1):
        mbd = by_p.get(y)
        pr = by_r.get(y)
        if mbd is None or pr is None or mbd <= 0:
            continue
        usd = mbd * 1_000_000.0 * 365.25 * pr
        revenue.append({"date": f"{y}-01-01", "value": round(usd, 0)})

    cpi_annual = _cpi_annual_average_by_year()
    cpi_base_val = cpi_annual.get(OIL_ECONOMY_CPI_BASE_YEAR)
    base_year_used = OIL_ECONOMY_CPI_BASE_YEAR
    if cpi_base_val is None or cpi_base_val <= 0:
        for alt in (2019, 2021, 2018, 2015):
            cpi_base_val = cpi_annual.get(alt)
            if cpi_base_val and cpi_base_val > 0:
                base_year_used = alt
                break
    price_real: list[dict] = []
    revenue_real: list[dict] = []
    if cpi_base_val and cpi_base_val > 0:
        for p in price_pts:
            y = int(p["date"][:4])
            cpi_y = cpi_annual.get(y)
            if cpi_y is None or cpi_y <= 0:
                continue
            nom = float(p["value"])
            price_real.append(
                {"date": p["date"], "value": round(nom * cpi_base_val / cpi_y, 4)}
            )
        for y in range(start_year, end_year + 1):
            mbd = by_p.get(y)
            pr_nom = by_r.get(y)
            cpi_y = cpi_annual.get(y)
            if mbd is None or pr_nom is None or mbd <= 0 or cpi_y is None or cpi_y <= 0:
                continue
            pr_r = float(pr_nom) * cpi_base_val / cpi_y
            usd_r = mbd * 1_000_000.0 * 365.25 * pr_r
            revenue_real.append({"date": f"{y}-01-01", "value": round(usd_r, 0)})

    inflation = {
        "deflator": "CPIAUCSL",
        "deflator_name": "US Consumer Price Index for All Urban Consumers",
        "base_year": base_year_used,
        "cpi_at_base_year": round(cpi_base_val, 4) if cpi_base_val and cpi_base_val > 0 else None,
        "source": {
            "name": "FRED CPIAUCSL",
            "url": "https://fred.stlouisfed.org/series/CPIAUCSL",
            "publisher": "BLS (via FRED)",
        },
        "methodology": {
            "cpi_aggregation": "Annual average of monthly CPIAUCSL for each calendar year",
            "base_note": f"CPI in base year = annual average; index level (1982-84=100) not re-normalized to 100",
            "price_formula": "real_price = nominal_price × (CPI_base / CPI_year)",
            "revenue_formula": "real_revenue ≈ mbd × 1e6 × 365.25 × real_price",
        },
    }
    if not (cpi_base_val and cpi_base_val > 0):
        inflation["methodology"]["unavailable"] = "US CPI not available; real series omitted"

    first_prod_y = min(iran_by_year) if iran_by_year else None
    cpi_ok = bool(cpi_base_val and cpi_base_val > 0)
    const_usd = f"constant {base_year_used} USD"
    out = {
        "country": "IRN",
        "production": {
            "unit": "million bbl/day",
            "source": OIL_PRODUCTION_SOURCE,
            "source_historical_fill": HISTORICAL_EXT_SOURCE,
            "resolution": "annual",
            "metadata": {
                "earliest_year_achievable": HISTORICAL_EARLIEST_YEAR,
                "earliest_year_in_range": first_prod_y,
            },
            "points": iran_prod,
        },
        "price": {
            "unit": "USD/barrel",
            "source": BRENT_SOURCE,
            "resolution": "annual",
            "methodology": price_methodology,
            "points": price_pts,
        },
        "revenue": {
            "unit": "USD/year (estimated)",
            "source": {
                "name": (
                    "Derived: Energy Institute / EIA production (1965+ where filled) × annual oil price (EIA 1980–86; Brent 1987+)"
                ),
                "publisher": "SignalMap",
                "url": "https://fred.stlouisfed.org/series/DCOILBRENTEU",
            },
            "points": revenue,
            "methodology": {
                "formula": "revenue_usd ≈ iran_mbd * 1e6 * 365.25 * annual_price_usd_per_bbl",
                "note": (
                    "Stylized gross: annual barrels × annual price. 1980–86 price = EIA proxy. "
                    "Not government revenue, not realized export value, not net of cost or quality discounts."
                ),
            },
        },
        "inflation": inflation,
        "price_real": {
            "unit": f"USD/barrel ({const_usd})" if cpi_ok else "USD/barrel (CPI-adjusted)",
            "base_year": base_year_used,
            "source": BRENT_SOURCE,
            "cpi": {"name": "FRED CPIAUCSL", "url": "https://fred.stlouisfed.org/series/CPIAUCSL"},
            "points": price_real,
        },
        "revenue_real": {
            "unit": f"USD/year ({const_usd}, estimated)" if cpi_ok else "USD/year (CPI-adjusted, estimated)",
            "base_year": base_year_used,
            "source": {
                "name": "Derived: production × real oil price; CPI: FRED CPIAUCSL",
                "publisher": "SignalMap",
                "url": "https://fred.stlouisfed.org/series/CPIAUCSL",
            },
            "points": revenue_real,
        },
    }
    cache_set(ck, out, CACHE_TTL)
    return out


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
    start_year = max(1990, int(start[:4]))
    end_year = min(int(end[:4]), 2024)
    ck = f"signal:{SIGNAL_OIL_PPP_TURKEY}:v2:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    ppp_by_year, oil_by_year = _parallel_ppp_and_oil_averages(_get_turkey_ppp_by_year, start_year, end_year)

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
    Return USD→Toman **open-market proxy** points in [start, end] plus optional **official** annual.

    Always built from the live merge (FRED PWT annual pre-archive + rial archive + Bonbast) so a Postgres
    slice that only covered recent years cannot hide 1950s+ history. The merged series is best-effort
    upserted for caching/offline use.

    ``official_annual`` is WDI FCRF (+ FRED fill) — use to compare with the open line when they diverge.
    """
    ck = f"signal:{SIGNAL_USD_TOMAN}:v2:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    t_req = time.perf_counter()
    merged = get_usd_toman_merged_cached()
    by_date: dict[str, dict] = {}
    for p in merged:
        if start <= p["date"] <= end:
            by_date[p["date"]] = p
    points = sorted(by_date.values(), key=lambda x: x["date"])

    official_annual: list[dict] = []
    try:
        full = _get_iran_official_annual_toman_cached()
        official_annual = [p for p in full if start <= p["date"] <= end]
    except Exception:
        official_annual = []

    if points:
        logger.info(
            "usd_toman: %s..%s points=%d earliest=%s latest=%s; prep_s=%.2f; merged_len=%d",
            start,
            end,
            len(points),
            points[0]["date"],
            points[-1]["date"],
            time.perf_counter() - t_req,
            len(merged),
        )
    else:
        logger.info("usd_toman: no open-market points in %s..%s", start, end)

    if points:
        try:
            upsert_points(
                SIGNAL_USD_TOMAN,
                points,
                source="bonbast_archive_fred",
                metadata={"source": USD_TOMAN_SOURCE},
            )
        except Exception:
            pass

    result = {
        "signal": SIGNAL_USD_TOMAN,
        "unit": "toman_per_usd",
        "source": USD_TOMAN_SOURCE,
        "points": points,
        "official_annual": official_annual,
        "official_source": OFFICIAL_FX_WDI_FCRF_SOURCE,
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_usd_irr_dual_series(start: str, end: str) -> dict:
    """
    **Official** annual: World Bank WDI `PA.NUS.FCRF` in toman/USD, with FRED (PWT) for years WDI omits.

    **Open market** uses the **same** merged build as `GET /api/signals/fx/usd-toman` — FRED annual
    (pre-2012) + rial archive + Bonbast — so dual-rate and single-rate studies share time coverage
    and stitching. Official years without open data still show a full open line where the merge
    has points; spread (%) is computed per calendar year only when that year has both an official
    value and at least one open observation (client).

    The two level series are **not** truncated to their date intersection.
    """
    ck = f"signal:fx_usd_irr_dual:v4:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    t_req = time.perf_counter()
    full_official = _get_iran_official_annual_toman_cached()
    official_points = [p for p in full_official if start <= p["date"] <= end]

    open_merged: list[dict] = []
    try:
        open_merged = get_usd_toman_merged_cached()
    except Exception:
        open_merged = []
    open_by: dict[str, dict] = {}
    for p in open_merged:
        if start <= p["date"] <= end:
            open_by[p["date"]] = p
    open_points = sorted(open_by.values(), key=lambda x: x["date"])

    off_years = [int(p["date"][:4]) for p in official_points]
    open_days = [p["date"] for p in open_points] if open_points else []
    metadata = {
        "official_earliest_year": min(off_years) if off_years else None,
        "official_latest_year": max(off_years) if off_years else None,
        "open_earliest_date": min(open_days) if open_days else None,
        "open_latest_date": max(open_days) if open_days else None,
        "unit": "toman per 1 USD (1 toman = 10 rials)",
    }

    out = {
        "official": {
            "points": official_points,
            "source": OFFICIAL_FX_WDI_FCRF_SOURCE,
            "metadata": {
                "official_earliest_year": metadata.get("official_earliest_year"),
                "official_latest_year": metadata.get("official_latest_year"),
                "unit": metadata.get("unit"),
                "resolution": "annual",
            },
        },
        "open_market": {
            "points": open_points,
            "source": USD_TOMAN_SOURCE,
            "metadata": {
                "open_earliest_date": metadata.get("open_earliest_date"),
                "open_latest_date": metadata.get("open_latest_date"),
                "unit": metadata.get("unit"),
                "resolution": "merged (FRED annual pre-archive; daily when archive+Bonbast)",
            },
        },
    }
    cache_set(ck, out, CACHE_TTL)
    logger.info(
        "fx_usd_irr_dual: n_official=%d n_open=%d build_s=%.2f",
        len(official_points),
        len(open_points),
        time.perf_counter() - t_req,
    )
    return out


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
    ck = f"signal:oil_production_exporters:v2:{start}:{end}"
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

    # Iran: fill pre-primary years (1965+ when missing) and gaps from embedded EI/EIA table; primary overwrites
    # when it has a positive value. Run even if ``data`` is empty (static/API can yield no rows; Iran-only years).
    start_year_ex = int(start[:4])
    end_year_ex = int(end[:4])
    data = merge_iran_historical_into_exporters_data(data, start_year_ex, end_year_ex)

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
        "source_iran_historical": HISTORICAL_EXT_SOURCE,
        "earliest_iran_historical_year": HISTORICAL_EARLIEST_YEAR,
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


GINI_INEQUALITY_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/indicator/SI.POV.GINI",
}


def get_gini_inequality_comparison(start: str, end: str) -> dict:
    """
    Annual Gini coefficient (income inequality) for Iran, United States, Germany, Turkey,
    China, and Saudi Arabia.
    Values on a 0–100 scale (World Bank convention); 0 = perfect equality, 100 = maximum inequality.
    """
    from signalmap.sources.world_bank_gini import WDI_GINI_COEFFICIENT, fetch_gini_series_for_countries

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:gini_inequality:v3:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    iso3_to_key = {
        "IRN": "iran",
        "USA": "united_states",
        "DEU": "germany",
        "TUR": "turkey",
        "CHN": "china",
        "SAU": "saudi_arabia",
    }
    bundle = fetch_gini_series_for_countries(iso3_to_key, start_year, end_year)
    series = bundle["series"]
    result = {
        "series": series,
        "source": GINI_INEQUALITY_SOURCE,
        "indicator_id": WDI_GINI_COEFFICIENT,
        "value_scale": "0-100",
        "resolution": "annual",
    }
    if bundle.get("series_warnings"):
        result["series_warnings"] = bundle["series_warnings"]
        result["partial"] = True
    cache_set(ck, result, CACHE_TTL)
    return result


CPI_INFLATION_YOY_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
}


def get_cpi_inflation_yoy_comparison(start: str, end: str) -> dict:
    """
    Annual consumer price inflation (% change from a year earlier) for Iran, United States,
    Germany, Turkey, China, and Saudi Arabia. WDI indicator FP.CPI.TOTL.ZG (same source as Gini comparator studies).
    """
    from signalmap.sources.world_bank_cpi_inflation import WDI_CPI_INFLATION_ANNUAL_PCT, fetch_cpi_inflation_yoy_for_countries

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:cpi_inflation_yoy:v3:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    iso3_to_key = {
        "IRN": "iran",
        "USA": "united_states",
        "DEU": "germany",
        "TUR": "turkey",
        "CHN": "china",
        "SAU": "saudi_arabia",
    }
    bundle = fetch_cpi_inflation_yoy_for_countries(iso3_to_key, start_year, end_year)
    series = bundle["series"]
    result = {
        "series": series,
        "source": CPI_INFLATION_YOY_SOURCE,
        "indicator_id": WDI_CPI_INFLATION_ANNUAL_PCT,
        "resolution": "annual",
    }
    if bundle.get("series_warnings"):
        result["series_warnings"] = bundle["series_warnings"]
        result["partial"] = True
    cache_set(ck, result, CACHE_TTL)
    return result


GDP_GLOBAL_COMPARISON_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD",
}


def get_gdp_global_comparison(start: str, end: str) -> dict:
    """
    Annual GDP (levels) for the United States, China, Iran, Turkey, Saudi Arabia, and world aggregate.
    Prefers constant 2015 US$ (NY.GDP.MKTP.KD) per economy; falls back to current US$ (NY.GDP.MKTP.CD) when KD is empty.
    """
    from signalmap.sources.world_bank_gdp_totals import fetch_gdp_global_comparison_bundle

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:gdp_global_comparison:v2:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    bundle = fetch_gdp_global_comparison_bundle(start_year, end_year)
    result = {
        **bundle,
        "source": GDP_GLOBAL_COMPARISON_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    return result


ISI_DIAGNOSTICS_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/",
}


def get_isi_diagnostics(start: str, end: str) -> dict:
    """
    Annual WDI trade/industry shares and GDP growth for Brazil, Argentina, India, Turkey, and Iran
    (ISI diagnostics — descriptive indicators only).
    """
    from signalmap.sources.world_bank_isi_diagnostics import fetch_isi_diagnostics_bundle

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:isi_diagnostics:v2:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    bundle = fetch_isi_diagnostics_bundle(start_year, end_year)
    result = {
        **bundle,
        "source": ISI_DIAGNOSTICS_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    return result


POVERTY_HEADCOUNT_IRAN_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/indicator/SI.POV.DDAY",
}


def get_poverty_headcount_iran(start: str, end: str) -> dict:
    """
    Iran: poverty headcount ratio (% of population) at two WDI international lines.
    Series SI.POV.DDAY and SI.POV.LMIC; dollar thresholds follow World Bank metadata (PPP revisions).
    """
    from signalmap.sources.world_bank_poverty import build_iran_poverty_headcount_bundle

    ck = f"signal:poverty_headcount_iran:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = int(start[:4])
    end_year = int(end[:4])
    bundle = build_iran_poverty_headcount_bundle(start_year, end_year)
    result = {
        **bundle,
        "source": POVERTY_HEADCOUNT_IRAN_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    return result


IRAN_MONEY_SUPPLY_M2_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/indicator/FM.LBL.BMNY.ZG",
}


def get_iran_money_supply_m2(start: str, end: str) -> dict:
    """
    Iran: WDI FM.LBL.BMNY.ZG through 2016; 2017+ = YoY from CBI-liquidity levels (static). CPI FP.CPI.TOTL.ZG (Iran) for comparison.
    """
    from signalmap.sources.world_bank_iran_money_supply import build_iran_money_supply_m2_bundle

    ck = f"signal:iran_money_supply_m2:v2:{start}:{end}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    start_year = int(start[:4])
    end_year = int(end[:4])
    bundle = build_iran_money_supply_m2_bundle(start_year, end_year)
    result = {
        **bundle,
        "source": IRAN_MONEY_SUPPLY_M2_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    return result


DUTCH_DISEASE_DIAGNOSTICS_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/country/iran",
}


IRAN_DEMAND_NOMINAL_USD_SOURCE = {
    "name": "World Bank World Development Indicators",
    "publisher": "World Bank",
    "url": "https://data.worldbank.org/country/iran",
}


def get_iran_demand_nominal_usd(start: str, end: str) -> dict:
    """
    Iran: annual demand aggregates — nominal (.CD) and real constant-price (.KD) from WDI.
    Descriptive only.

    GDP decomposition inputs (``NY.GDP.MKTP.CD``, ``NY.GDP.PETR.RT.ZS``) are fetched inside the bundle builder
    with per-indicator row caching; this function adds a whole-bundle cache key on top.
    """
    from signalmap.sources.world_bank_iran_demand_nominal import fetch_iran_demand_nominal_usd_bundle

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:iran_demand_nominal_usd:v5:{start_year}:{end_year}"
    cached = cache_get(ck)
    if cached is not None:
        return cached

    bundle = fetch_iran_demand_nominal_usd_bundle(start_year, end_year)
    result = {
        **bundle,
        "source": IRAN_DEMAND_NOMINAL_USD_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    return result


def get_dutch_disease_diagnostics_iran(start: str, end: str) -> dict:
    """
    Iran-only annual WDI bundle for exploratory structural diagnostics (not a composite “Dutch disease index”):

    - NY.GDP.PETR.RT.ZS — oil rents (% of GDP)
    - NY.GDP.NGAS.RT.ZS — natural gas rents (% of GDP)
    - NY.GDP.TOTL.RT.ZS — total natural resources rents (% of GDP)
    - NV.IND.MANF.ZS — manufacturing value added (% of GDP)
    - NE.IMP.GNFS.ZS — imports of goods and services (% of GDP)
    """
    from signalmap.sources.world_bank_dutch_disease import fetch_iran_dutch_disease_bundle

    start_year = int(start[:4])
    end_year = int(end[:4])
    ck = f"signal:dutch_disease_diagnostics_iran:v3:{start_year}:{end_year}"
    t0 = time.perf_counter()
    cached = cache_get(ck)
    if cached is not None:
        if _SIGNAL_TIMING_LOG:
            logger.info(
                "dutch_disease_diagnostics_iran cache=hit key=%s elapsed_ms=%.1f",
                ck,
                (time.perf_counter() - t0) * 1000,
            )
        return cached

    t_bundle = time.perf_counter()
    bundle = fetch_iran_dutch_disease_bundle(start_year, end_year)
    bundle_ms = (time.perf_counter() - t_bundle) * 1000
    result = {
        **bundle,
        "source": DUTCH_DISEASE_DIAGNOSTICS_SOURCE,
        "resolution": "annual",
    }
    cache_set(ck, result, CACHE_TTL)
    if _SIGNAL_TIMING_LOG:
        payload = json.dumps(result)
        logger.info(
            "dutch_disease_diagnostics_iran cache=miss key=%s bundle_ms=%.1f total_ms=%.1f bytes=%d",
            ck,
            bundle_ms,
            (time.perf_counter() - t0) * 1000,
            len(payload.encode("utf-8")),
        )
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
    Fetch all available WDI years for the bundled indicators, build full points on the
    combined natural span. Absolute levels are stored in ``levels_variants``:

    - ``real``: NE.CON.TOTL.KD, NY.GDP.MKTP.KD, NE.GDI.TOTL.KD (constant 2015 US$).
    - ``usd``: NE.CON.TOTL.CD, NY.GDP.MKTP.CD, NE.GDI.TOTL.CD (current US$).

    Cached per country (not per date window). ``get_gdp_composition_series`` picks one
    variant (and optionally applies IRN Toman FX to the current-USD bundle).
    """
    from signalmap.sources.world_bank_national_accounts import (
        CURRENT_USD_LEVEL_IDS,
        REAL_LEVEL_IDS,
        WDI_FINAL_CONSUMPTION_CONST_USD,
        WDI_FINAL_CONSUMPTION_CURRENT_USD,
        WDI_FINAL_CONSUMPTION_PCT_GDP,
        WDI_GDP_CONST_USD,
        WDI_GDP_CURRENT_USD,
        WDI_GROSS_CAPITAL_FORMATION_CONST_USD,
        WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD,
        WDI_GROSS_CAPITAL_FORMATION_PCT_GDP,
        WDI_LABELS,
        build_wdi_levels_pack,
        combined_span_from_series,
        fetch_wdi_annual_indicator,
        points_for_chart,
    )

    cons_raw = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_PCT_GDP)
    inv_raw = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_PCT_GDP)
    gdp_raw = fetch_wdi_annual_indicator(iso, WDI_GDP_CURRENT_USD)

    cons_kd = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_CONST_USD)
    gdp_kd = fetch_wdi_annual_indicator(iso, WDI_GDP_CONST_USD)
    inv_kd = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_CONST_USD)
    cons_cd = fetch_wdi_annual_indicator(iso, WDI_FINAL_CONSUMPTION_CURRENT_USD)
    inv_cd = fetch_wdi_annual_indicator(iso, WDI_GROSS_CAPITAL_FORMATION_CURRENT_USD)

    natural_start, natural_end, per_series = combined_span_from_series(
        [
            ("final_consumption_pct_gdp", cons_raw),
            ("gross_capital_formation_pct_gdp", inv_raw),
            ("gdp_current_usd", gdp_raw),
            ("consumption_kd", cons_kd),
            ("gdp_kd", gdp_kd),
            ("investment_kd", inv_kd),
            ("consumption_cd", cons_cd),
            ("investment_cd", inv_cd),
        ]
    )
    empty_levels_variants = {"real": None, "usd": None}
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
            "levels_variants": empty_levels_variants,
        }

    cons_pts = points_for_chart(cons_raw, natural_start, natural_end)
    inv_pts = points_for_chart(inv_raw, natural_start, natural_end)
    gdp_pts = points_for_chart(gdp_raw, natural_start, natural_end)

    real_pack = build_wdi_levels_pack(
        natural_start,
        natural_end,
        cons_kd,
        gdp_kd,
        inv_kd,
        REAL_LEVEL_IDS,
        "constant_2015_usd",
        "constant 2015 US$",
    )
    usd_pack = build_wdi_levels_pack(
        natural_start,
        natural_end,
        cons_cd,
        gdp_raw,
        inv_cd,
        CURRENT_USD_LEVEL_IDS,
        "current_usd",
        "current US$",
    )

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
        "levels_variants": {"real": real_pack, "usd": usd_pack},
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


def _levels_pack_has_points(pack: dict | None) -> bool:
    if not pack or not isinstance(pack, dict):
        return False
    ind = pack.get("indicators") or {}
    for key in ("consumption", "gdp", "investment"):
        meta = ind.get(key)
        if not isinstance(meta, dict):
            return False
        pts = meta.get("points")
        if not isinstance(pts, list) or len(pts) == 0:
            return False
    return True


def _slice_levels_pack(pack: dict, slice_start: int, slice_end: int) -> dict:
    """Return a copy of a levels variant with points clipped to [slice_start, slice_end]."""
    ind_in = pack.get("indicators") or {}
    new_ind: dict = {}
    for key, meta in ind_in.items():
        if isinstance(meta, dict):
            pts = meta.get("points") or []
            new_ind[key] = {
                **{k: v for k, v in meta.items() if k != "points"},
                "points": _filter_indicator_points_by_year(pts, slice_start, slice_end),
            }
        else:
            new_ind[key] = meta
    return {**{k: v for k, v in pack.items() if k != "indicators"}, "indicators": new_ind}


def _empty_levels_out() -> dict:
    return {
        "price_basis": None,
        "unit": None,
        "indicators": {
            "consumption": {"id": None, "label": "", "display_label": "Consumption", "unit": "", "points": []},
            "gdp": {"id": None, "label": "", "display_label": "GDP", "unit": "", "points": []},
            "investment": {"id": None, "label": "", "display_label": "Investment", "unit": "", "points": []},
        },
    }


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
    country_iso3: str,
    start: str,
    end: str,
    levels_value_type: str = "real",
    *,
    force_refresh: bool = False,
) -> dict:
    """
    Annual GDP composition: final consumption and gross capital formation as % of GDP,
    nominal GDP in current US$, and absolute levels for consumption / GDP / investment.

    ``levels_value_type`` selects the levels bundle (before optional IRN Toman conversion):

    - ``real``: WDI constant 2015 US$ (*KD) for all three aggregates.
    - ``usd``: WDI current US$ (*CD / NY.GDP.MKTP.CD).
    - ``toman``: IRN only; current-US$ levels converted to billion tomans via per-year
      mean open-market toman/USD (same merged series as ``get_usd_toman_series``).

    If ``real`` is requested but constant-price rows are incomplete, the API falls back
    to ``usd`` and sets ``levels_display_note``.

    Country via ISO 3166-1 alpha-3 (e.g. IRN, TUR). Full history is cached per country;
    ``start``/``end`` clip returned points. When ``force_refresh`` is True, the per-country
    WDI bundle is refetched and the cache entry is replaced (used by weekly cron).
    """
    iso = (country_iso3 or "IRN").strip().upper()
    if len(iso) != 3 or not iso.isalpha():
        raise ValueError("country must be a 3-letter ISO 3166-1 alpha-3 code")

    requested_start_year = int(start[:4])
    requested_end_year = int(end[:4])

    lvt = (levels_value_type or "real").strip().lower()
    if lvt not in ("real", "usd", "toman"):
        raise ValueError("levels_value_type must be one of: real, usd, toman")
    if lvt == "toman" and iso != "IRN":
        raise ValueError("levels_value_type=toman is only supported for country=IRN")

    ck_full = f"signal:{GDP_COMPOSITION_SIGNAL}:{iso}:full_v3"
    full = None if force_refresh else cache_get(ck_full)
    if full is None:
        full = _gdp_composition_full_for_country(iso)
        cache_set(ck_full, full, GDP_COMPOSITION_CACHE_TTL)

    span = full.get("data_span") or {}
    natural_start = span.get("first_year_any")
    natural_end = span.get("last_year_any")
    if natural_start is None or natural_end is None:
        base = {**full, "levels_conversion": None}
        base.pop("levels_variants", None)
        base["levels"] = _empty_levels_out()
        base["levels_value_type_requested"] = lvt
        base["levels_value_type"] = lvt
        return base

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

    variants = full.get("levels_variants") or {}
    real_pack = variants.get("real")
    usd_pack = variants.get("usd")

    requested = lvt
    display_note: str | None = None
    effective = lvt
    base_pack: dict | None = None

    if lvt == "real":
        base_pack = real_pack if _levels_pack_has_points(real_pack) else None
        if base_pack is None:
            base_pack = usd_pack if _levels_pack_has_points(usd_pack) else None
            effective = "usd"
            display_note = (
                "Constant-price WDI levels are not all available for this country; "
                "showing current US$ levels instead."
            )
    elif lvt == "usd":
        base_pack = usd_pack if _levels_pack_has_points(usd_pack) else None
    else:
        # toman (IRN): always convert current-US$ bundle
        base_pack = usd_pack if _levels_pack_has_points(usd_pack) else None

    if base_pack is None:
        out_levels = _empty_levels_out()
    else:
        out_levels = _slice_levels_pack(base_pack, slice_start, slice_end)

    result = {
        **{k: v for k, v in full.items() if k not in ("indicators", "data_span", "levels_variants")},
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
        "levels_value_type_requested": requested,
        "levels_value_type": effective,
    }
    if display_note:
        result["levels_display_note"] = display_note

    if effective == "toman" and iso == "IRN":
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
                "Each level point in current US dollars (NE.CON.TOTL.CD, NY.GDP.MKTP.CD, "
                "NE.GDI.TOTL.CD) is multiplied by the arithmetic mean of daily open-market "
                "toman-per-USD rates in that Gregorian year (same merged series as "
                "GET /api/signals/fx/usd-toman). Shown in billions of tomans. Missing FX "
                "years omit points. Illustrative local-currency view—not official "
                "national-accounts tomans."
            ),
            "fx_source": fx_src,
        }

    return result

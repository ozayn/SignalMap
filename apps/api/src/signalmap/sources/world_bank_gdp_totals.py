"""World Bank WDI: total GDP (annual) for cross-country comparison."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import (
    WDI_GDP_CONST_USD,
    WDI_GDP_CURRENT_USD,
    fetch_wdi_annual_indicator,
)

_logger = logging.getLogger(__name__)

# Order matches the global GDP study: major economies + world aggregate.
GDP_COMPARISON_ISO3_TO_KEY: dict[str, str] = {
    "USA": "united_states",
    "CHN": "china",
    "JPN": "japan",
    "DEU": "germany",
    "IND": "india",
    "RUS": "russia",
    "WLD": "world",
}


def rows_to_gdp_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        try:
            v = float(r["value"])
        except (TypeError, ValueError):
            continue
        out.append({"date": f"{y}-01-01", "value": v})
    return out


def fetch_gdp_total_series_for_country(iso3: str, start_year: int, end_year: int) -> tuple[list[dict[str, float | str]], str, str]:
    """
    Prefer GDP in constant 2015 US$ (NY.GDP.MKTP.KD); fall back to current US$ (NY.GDP.MKTP.CD).
    Returns (chart_points, price_basis, indicator_id_used).
    """
    kd_rows = fetch_wdi_annual_indicator(iso3, WDI_GDP_CONST_USD)
    if kd_rows:
        return rows_to_gdp_points(kd_rows, start_year, end_year), "constant_2015_usd", WDI_GDP_CONST_USD
    cd_rows = fetch_wdi_annual_indicator(iso3, WDI_GDP_CURRENT_USD)
    return rows_to_gdp_points(cd_rows, start_year, end_year), "current_usd", WDI_GDP_CURRENT_USD


def fetch_gdp_current_usd_series_for_country(iso3: str, start_year: int, end_year: int) -> list[dict[str, float | str]]:
    cd_rows = fetch_wdi_annual_indicator(iso3, WDI_GDP_CURRENT_USD)
    return rows_to_gdp_points(cd_rows, start_year, end_year)


def _fetch_country_bundle_safe(
    iso3: str,
    key: str,
    start_year: int,
    end_year: int,
) -> tuple[str, list[dict[str, float | str]], list[dict[str, float | str]], str, str, str | None]:
    try:
        pts, basis, ind_id = fetch_gdp_total_series_for_country(iso3, start_year, end_year)
        pts_current = fetch_gdp_current_usd_series_for_country(iso3, start_year, end_year)
        return key, pts, pts_current, basis, ind_id, None
    except Exception as e:
        _logger.warning("GDP comparison fetch failed %s: %s", iso3, e)
        return key, [], [], "unavailable", WDI_GDP_CURRENT_USD, str(e)


def fetch_gdp_global_comparison_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    series: dict[str, list[dict[str, float | str]]] = {}
    series_current_usd: dict[str, list[dict[str, float | str]]] = {}
    price_basis: dict[str, str] = {}
    indicator_ids: dict[str, str] = {}
    warnings: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [
            pool.submit(_fetch_country_bundle_safe, iso3, key, start_year, end_year)
            for iso3, key in GDP_COMPARISON_ISO3_TO_KEY.items()
        ]
        for fut in futures:
            key, pts, pts_current, basis, ind_id, err = fut.result()
            series[key] = pts
            series_current_usd[key] = pts_current
            price_basis[key] = basis
            indicator_ids[key] = ind_id
            if err:
                warnings[key] = err

    out: dict[str, Any] = {
        "series": series,
        "series_current_usd": series_current_usd,
        "per_country_price_basis": price_basis,
        "per_country_indicator_id": indicator_ids,
    }
    if warnings:
        out["series_warnings"] = warnings
        out["partial"] = True
    return out

"""World Bank WDI: Gini coefficient (income inequality), annual."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

# World Development Indicators — Gini index (income inequality)
WDI_GINI_COEFFICIENT = "SI.POV.GINI"


def _normalize_gini_to_0_100(value: float) -> float:
    """WDI normally reports 0–100; if a value is clearly on a 0–1 scale, scale up."""
    if value <= 0:
        return value
    if value <= 1.0:
        return round(value * 100.0, 2)
    return round(value, 2)


def rows_to_chart_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = _normalize_gini_to_0_100(float(r["value"]))
        out.append({"date": f"{y}-01-01", "value": v})
    return out


def _fetch_one_country_safe(
    iso3: str,
    series_key: str,
    start_year: int,
    end_year: int,
) -> tuple[str, list[dict[str, float | str]], str | None]:
    try:
        rows = fetch_wdi_annual_indicator(iso3, WDI_GINI_COEFFICIENT)
        return series_key, rows_to_chart_points(rows, start_year, end_year), None
    except Exception as e:
        _logger.warning("Gini WDI fetch failed %s %s: %s", iso3, WDI_GINI_COEFFICIENT, e)
        return series_key, [], str(e)


def fetch_gini_series_for_countries(
    iso3_to_key: dict[str, str],
    start_year: int,
    end_year: int,
) -> dict[str, Any]:
    """
    Fetch SI.POV.GINI for each ISO3 code.

    Returns ``{"series": {country_key: points, ...}, optional series_warnings, partial}``.
    Failed countries get empty point lists instead of raising.
    """
    out: dict[str, list[dict[str, float | str]]] = {}
    warnings: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [
            pool.submit(_fetch_one_country_safe, iso3, sk, start_year, end_year)
            for iso3, sk in iso3_to_key.items()
        ]
        for fut in futures:
            series_key, pts, err = fut.result()
            out[series_key] = pts
            if err:
                warnings[series_key] = err

    bundle: dict[str, Any] = {"series": out}
    if warnings:
        bundle["series_warnings"] = warnings
        bundle["partial"] = True
    return bundle

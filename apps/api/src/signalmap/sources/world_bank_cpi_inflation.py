"""World Bank WDI: consumer price inflation (annual %)."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

# Inflation, consumer prices (annual %)
WDI_CPI_INFLATION_ANNUAL_PCT = "FP.CPI.TOTL.ZG"


def rows_to_chart_points(rows: list[dict[str, Any]], start_year: int, end_year: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        v = float(r["value"])
        out.append({"date": f"{y}-01-01", "value": round(v, 2)})
    return out


def _fetch_country_safe(
    iso3: str,
    series_key: str,
    start_year: int,
    end_year: int,
) -> tuple[str, list[dict[str, float | str]], str | None]:
    try:
        rows = fetch_wdi_annual_indicator(iso3, WDI_CPI_INFLATION_ANNUAL_PCT)
        return series_key, rows_to_chart_points(rows, start_year, end_year), None
    except Exception as e:
        _logger.warning("CPI YoY WDI fetch failed %s %s: %s", iso3, WDI_CPI_INFLATION_ANNUAL_PCT, e)
        return series_key, [], str(e)


def fetch_cpi_inflation_yoy_for_countries(
    iso3_to_key: dict[str, str],
    start_year: int,
    end_year: int,
) -> dict[str, Any]:
    """Parallel fetch per country; failures become empty series + ``series_warnings``."""
    out: dict[str, list[dict[str, float | str]]] = {}
    warnings: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [
            pool.submit(_fetch_country_safe, iso3, sk, start_year, end_year)
            for iso3, sk in iso3_to_key.items()
        ]
        for fut in futures:
            sk, pts, err = fut.result()
            out[sk] = pts
            if err:
                warnings[sk] = err

    bundle: dict[str, Any] = {"series": out}
    if warnings:
        bundle["series_warnings"] = warnings
        bundle["partial"] = True
    return bundle

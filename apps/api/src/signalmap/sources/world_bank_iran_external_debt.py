"""World Bank WDI: Iran external debt (annual) with %GDP derived series."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

WDI_EXTERNAL_DEBT_STOCKS_USD = "DT.DOD.DECT.CD"
WDI_GDP_CURRENT_USD = "NY.GDP.MKTP.CD"


def _fetch_indicator_safe(country_iso3: str, indicator_id: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        return fetch_wdi_annual_indicator(country_iso3, indicator_id), None
    except Exception as e:
        _logger.warning("Iran external debt WDI fetch failed %s %s: %s", country_iso3, indicator_id, e)
        return [], f"{indicator_id}: {e}"


def _rows_to_points(rows: list[dict[str, Any]], start_year: int, end_year: int, *, decimals: int) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        out.append({"date": f"{y}-01-01", "value": round(float(r["value"]), decimals)})
    return out


def _derive_pct_of_gdp_points(
    debt_rows: list[dict[str, Any]], gdp_rows: list[dict[str, Any]], start_year: int, end_year: int
) -> list[dict[str, float | str]]:
    gdp_by_year = {int(r["year"]): float(r["value"]) for r in gdp_rows}
    out: list[dict[str, float | str]] = []
    for r in debt_rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        gdp = gdp_by_year.get(y)
        if gdp is None or gdp <= 0:
            continue
        debt = float(r["value"])
        out.append({"date": f"{y}-01-01", "value": round((debt / gdp) * 100.0, 3)})
    return out


def fetch_iran_external_debt_bundle(start_year: int, end_year: int) -> dict[str, Any]:
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_debt, f_gdp = (
            pool.submit(_fetch_indicator_safe, "IRN", WDI_EXTERNAL_DEBT_STOCKS_USD),
            pool.submit(_fetch_indicator_safe, "IRN", WDI_GDP_CURRENT_USD),
        )
        debt_rows, err_debt = f_debt.result()
        gdp_rows, err_gdp = f_gdp.result()

    series_warnings: dict[str, str] = {}
    if err_debt:
        series_warnings["external_debt_usd"] = err_debt
    if err_gdp:
        series_warnings["gdp_usd_for_debt_pct"] = err_gdp

    debt_usd_points = _rows_to_points(debt_rows, start_year, end_year, decimals=2)
    debt_pct_gdp_points = _derive_pct_of_gdp_points(debt_rows, gdp_rows, start_year, end_year)

    out: dict[str, Any] = {
        "series": {
            "external_debt_pct_gdp": debt_pct_gdp_points,
            "external_debt_usd": debt_usd_points,
        },
        "indicator_ids": {
            "external_debt_usd": WDI_EXTERNAL_DEBT_STOCKS_USD,
            "gdp_usd_for_debt_pct": WDI_GDP_CURRENT_USD,
            "external_debt_pct_gdp": "derived:DT.DOD.DECT.CD/NY.GDP.MKTP.CD*100",
        },
        "coverage": {
            "external_debt_pct_gdp_points": len(debt_pct_gdp_points),
            "external_debt_usd_points": len(debt_usd_points),
        },
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out

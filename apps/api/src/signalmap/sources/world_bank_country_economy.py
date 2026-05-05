"""World Bank WDI: generic country economy bundle (annual)."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from signalmap.sources.world_bank_national_accounts import fetch_wdi_annual_indicator

_logger = logging.getLogger(__name__)

INDICATORS: dict[str, str] = {
    "cpi_inflation_yoy_pct": "FP.CPI.TOTL.ZG",
    "gdp_growth_yoy_pct": "NY.GDP.MKTP.KD.ZG",
    "gdp_current_usd": "NY.GDP.MKTP.CD",
    "gdp_constant_2015_usd": "NY.GDP.MKTP.KD",
    "consumption_current_usd": "NE.CON.TOTL.CD",
    "investment_current_usd": "NE.GDI.TOTL.CD",
    "consumption_constant_2015_usd": "NE.CON.TOTL.KD",
    "investment_constant_2015_usd": "NE.GDI.TOTL.KD",
    "oil_rents_pct_gdp": "NY.GDP.PETR.RT.ZS",
    "natural_gas_rents_pct_gdp": "NY.GDP.NGAS.RT.ZS",
    "imports_pct_gdp": "NE.IMP.GNFS.ZS",
    "exports_pct_gdp": "NE.EXP.GNFS.ZS",
    "manufacturing_pct_gdp": "NV.IND.MANF.ZS",
    "industry_pct_gdp": "NV.IND.TOTL.ZS",
    "broad_money_growth_pct": "FM.LBL.BMNY.ZG",
    "gini": "SI.POV.GINI",
    "poverty_extreme": "SI.POV.DDAY",
    "poverty_lmic": "SI.POV.LMIC",
    # Official exchange rate (LCU per US$, period average)
    "fx_official_lcu_per_usd": "PA.NUS.FCRF",
}


def _fetch_indicator_safe(country_iso3: str, indicator_id: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        return fetch_wdi_annual_indicator(country_iso3, indicator_id), None
    except Exception as e:
        _logger.warning("Country economy WDI fetch failed %s %s: %s", country_iso3, indicator_id, e)
        return [], f"{indicator_id}: {e}"


def _rows_to_points(rows: list[dict[str, Any]], start_year: int, end_year: int, decimals: int = 3) -> list[dict[str, float | str]]:
    out: list[dict[str, float | str]] = []
    for r in rows:
        y = int(r["year"])
        if y < start_year or y > end_year:
            continue
        out.append({"date": f"{y}-01-01", "value": round(float(r["value"]), decimals)})
    return out


def fetch_country_economy_bundle(country_iso3: str, start_year: int, end_year: int) -> dict[str, Any]:
    iso3 = country_iso3.strip().upper()
    series: dict[str, list[dict[str, float | str]]] = {}
    series_warnings: dict[str, str] = {}

    tasks: list[tuple[Any, str, str]] = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        for key, indicator_id in INDICATORS.items():
            fut = pool.submit(_fetch_indicator_safe, iso3, indicator_id)
            tasks.append((fut, key, indicator_id))

        for fut, key, indicator_id in tasks:
            rows, err = fut.result()
            decimals = 2 if key.endswith("_usd") else 3
            series[key] = _rows_to_points(rows, start_year, end_year, decimals=decimals)
            if err:
                series_warnings[key] = err

    out: dict[str, Any] = {
        "series": series,
        "indicator_ids": INDICATORS,
        "country_iso3": iso3,
    }
    if series_warnings:
        out["series_warnings"] = series_warnings
        out["partial"] = True
    return out
